import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { StrictOtpCoordinator, type OtpIssueInput, type OtpVerifyInput } from '../../src/worker/services/auth-otp';
import * as digests from '../../src/worker/utils/otp-digest';
import { createOtpRequestKey } from '../../src/worker/config/otp-policy';
import { finishOtpVerification, readOtpDatabaseTime } from '../../packages/db/src/auth-otp';
import { SqliteD1, createBarrier } from '../helpers/sqlite-d1';

const EPOCH = 1791684000;
const SECRET = 'strict-test-secret-opaque';
const EMAIL = 'otp-user@example.test';
class ClockD1 extends SqliteD1 {
  now = EPOCH;
  override prepare(sql: string) { return super.prepare(sql.replaceAll('unixepoch()', String(this.now))); }
}
let db: ClockD1;
let kernel: StrictOtpCoordinator;
let compare: MockInstance<typeof digests.verifyOtpDigest>;
const key = () => createOtpRequestKey(db.now * 1000);
function verifyInput(operation: OtpVerifyInput['operation'] = 'register_verify', code = '123456'): OtpVerifyInput {
  return { email: EMAIL, purpose: operation.startsWith('reset_') ? 'forgot_password' : operation === 'login_verify' ? 'login' : 'register',
    operation, code, requestKey: key(), ...(operation === 'reset_final' ? { newPassword: 'new-password-strong' } : {}) };
}
async function issue(operation: OtpIssueInput['operation'] = 'issue_register', email = EMAIL, state: 'accepted' | 'rejected' | 'delivery_unknown' | 'pending' = 'accepted') {
  const input: OtpIssueInput = { email, operation, purpose: operation === 'issue_forgot' ? 'forgot_password' : operation === 'issue_login' ? 'login' : 'register', code: '123456', requestKey: key() };
  const result = await kernel.reserveIssuance(input);
  expect(result.kind).toBe('reserved');
  if (result.kind !== 'reserved') throw new Error('Fixture issuance');
  if (state !== 'pending') expect(await kernel.recordDelivery(result.issuanceId, state)).toBe(true);
  return { input, result };
}
const count = (table: string) => db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0].n;
const sessions = () => db.query('SELECT id, token_hash, revoked_at FROM sessions_v2 ORDER BY id');
function idle() { expect(count('auth_otp_claims')).toBe(0); expect(count('auth_otp_assertions')).toBe(0); }

beforeEach(() => {
  db = new ClockD1(); kernel = new StrictOtpCoordinator(db, SECRET);
  db.seed(`INSERT INTO users(id, email) VALUES ('otp-user', '${EMAIL}');
    INSERT INTO households(id, name, created_by) VALUES ('hh_otp-user', 'OTP test household', 'otp-user');
    INSERT INTO household_members(household_id, user_id, role) VALUES ('hh_otp-user','otp-user','owner');
    INSERT INTO auth_accounts(id, user_id, email, is_verified, password_hash, salt)
      VALUES ('otp-account','otp-user','${EMAIL}',0,'old-hash','old-salt');`);
  compare = vi.spyOn(digests, 'verifyOtpDigest');
});
afterEach(() => { vi.restoreAllMocks(); db.close(); });

describe('dormant strict OTP actual comparison boundary', () => {
  it.each([20, 100])('bounds %i distinct concurrent candidates to five comparisons/admissions', async (racers) => {
    await issue();
    const barrier = createBarrier(racers);
    db.hooks.beforeBatch = async (statements) => {
      if (statements[0].sql.includes("'reserve'")) await barrier.wait();
    };
    const results = await Promise.all(Array.from({ length: racers }, () => kernel.verify(verifyInput('register_verify', '000000'))));
    expect(compare).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => r.kind === 'invalid')).toHaveLength(5);
    expect(results.filter((r) => r.kind === 'budget')).toHaveLength(racers - 5);
    expect(count('auth_otp_tickets')).toBe(5); idle();
  });
  it('same-key twenty racers grant one actual comparison and one durable effect', async () => {
    await issue(); const input = verifyInput(); const barrier = createBarrier(20);
    db.hooks.beforeBatch = async (statements) => { if (statements[0].sql.includes("'reserve'")) await barrier.wait(); };
    const results = await Promise.all(Array.from({ length: 20 }, () => kernel.verify(input)));
    expect(compare).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.kind === 'completed')).toHaveLength(1);
    expect(results.filter((r) => r.kind === 'in_progress')).toHaveLength(19);
    expect(count('auth_otp_tickets')).toBe(1); expect(count('sessions_v2')).toBe(1); idle();
  });
  it('candidate five finalizes despite the lock; candidate six never compares', async () => {
    await issue();
    for (let n = 0; n < 4; n++) expect((await kernel.verify(verifyInput('register_verify','000000'))).kind).toBe('invalid');
    const fifth = await kernel.verify(verifyInput());
    expect(fifth.kind).toBe('completed'); expect(compare).toHaveBeenCalledTimes(5);
    expect((await kernel.verify(verifyInput())).kind).toBe('budget'); expect(compare).toHaveBeenCalledTimes(5);
    expect(db.query<{ locked_until: number }>('SELECT locked_until FROM auth_otp_scopes')[0].locked_until).toBe(EPOCH + 900);
  });
  it('login verification consumes without a session', async () => {
    await issue('issue_login');
    const result = await kernel.verify(verifyInput('login_verify'));
    expect(result).toEqual({kind:'completed',replayed:false,sessionRequired:false});
    expect(count('sessions_v2')).toBe(0); expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{used:1}]);
  });
  it('binds operation, purpose, code, password and semantic context across replay', async () => {
    await issue('issue_forgot'); const input = verifyInput('reset_final','000000');
    expect((await kernel.verify(input)).kind).toBe('invalid');
    for (const changed of [ {...input,code:'123456'}, {...input,newPassword:'different-password'},
      {...input,operation:'reset_preliminary' as const}, {...input,operation:'register_verify' as const,purpose:'register' as const},
      {...input,semanticBody:{context:'changed'}} ]) {
      expect((await kernel.verify(changed)).kind).toBe('conflict');
    }
    expect(compare).toHaveBeenCalledTimes(1); expect(count('auth_otp_tickets')).toBe(1); expect(count('sessions_v2')).toBe(0);
  });
  it('same issuance key conflicts across issuance and verification and never sends twice', async () => {
    const issued = await issue();
    expect((await kernel.reserveIssuance({...issued.input,code:'999999'})).kind).toBe('in_progress');
    expect((await kernel.verify({...verifyInput(),requestKey:issued.input.requestKey})).kind).toBe('conflict');
    expect(count('auth_otp_issuances')).toBe(1); expect(compare).not.toHaveBeenCalled();
  });
  it('captures caller input before awaits so password/code changes cannot escape fingerprint binding', async () => {
    await issue('issue_forgot'); const input = verifyInput('reset_final');
    db.hooks.beforeStatement = (event) => { if(event.sql.includes('AS now_sec')) { input.code='000000';input.newPassword='mutated-password'; } };
    expect((await kernel.verify(input)).kind).toBe('completed');
    expect(compare.mock.calls[0][2]).toBe('123456');
    expect(db.query<{password_hash:string}>('SELECT password_hash FROM auth_accounts')[0].password_hash).not.toBe('old-hash');
  });
});

describe('strict issuance lifecycle and account-neutral budget', () => {
  it.each(['pending','accepted','rejected','delivery_unknown'] as const)('preserves known/unknown candidate accounting for %s delivery', async (state) => {
    for (const email of [EMAIL, 'unknown@example.test']) {
      await issue('issue_forgot',email,state);
      const results=[];
      for(let n=0;n<6;n++) results.push(await kernel.verify({...verifyInput('reset_preliminary','000000'),email}));
      expect(results.filter(r=>r.kind==='budget')).toHaveLength(1);
      expect(results.slice(0,5).every(r=>r.kind===(state==='accepted'?'invalid':'unavailable'))).toBe(true);
    }
    expect(count('auth_otp_tickets')).toBe(10);
    expect(compare).toHaveBeenCalledTimes(state==='accepted'?10:0); idle();
  });
  it('unknown matching code can never issue a proof or session', async () => {
    await issue('issue_forgot','unknown@example.test');
    expect((await kernel.verify({...verifyInput('reset_final'),email:'unknown@example.test'})).kind).toBe('invalid');
    expect(compare).toHaveBeenCalledTimes(1); expect(count('sessions_v2')).toBe(0);
  });
  it('retains cooldown and rejects late acceptance from superseded unknown generation', async () => {
    const first=await issue('issue_register',EMAIL,'delivery_unknown');
    expect((await kernel.reserveIssuance({...first.input,requestKey:key()})).kind).toBe('cooldown');
    db.now+=60; const second=await issue(); expect(second.result.generation).toBe(2);
    expect(await kernel.recordDelivery(first.result.issuanceId,'accepted')).toBe(false);
    expect(db.query<{state:string}>('SELECT state FROM auth_otp_issuances WHERE id = ?',first.result.issuanceId)[0].state).toBe('superseded');
    expect((await kernel.verify(verifyInput())).kind).toBe('completed');
  });
  it('cooldown denial is immutable on retry after time passes; new key can issue', async () => {
    await issue(); const input:OtpIssueInput={email:EMAIL,purpose:'register',operation:'issue_register',code:'123456',requestKey:key()};
    expect((await kernel.reserveIssuance(input)).kind).toBe('cooldown'); db.now+=60;
    expect((await kernel.reserveIssuance(input)).kind).toBe('cooldown');
    expect((await kernel.reserveIssuance({...input,requestKey:key()})).kind).toBe('reserved');
  });
  it('resend preserves failures and fifth lock rather than resetting abuse history', async () => {
    await issue(); for(let n=0;n<4;n++) await kernel.verify(verifyInput('register_verify','000000'));
    db.now+=60; await issue(); expect((await kernel.verify(verifyInput())).kind).toBe('completed');
    expect(compare).toHaveBeenCalledTimes(5);
    db.now+=60; expect((await kernel.reserveIssuance({email:EMAIL,purpose:'register',operation:'issue_register',code:'123456',requestKey:key()})).kind).toBe('budget');
  });
  it('without a challenge candidates still spend the same budget without comparisons', async()=>{
    for(let n=0;n<5;n++) expect((await kernel.verify(verifyInput())).kind).toBe('unavailable');
    expect((await kernel.verify(verifyInput())).kind).toBe('budget');expect(compare).not.toHaveBeenCalled();
  });
});

describe('atomic fault, replay and time boundaries',()=>{
  it('lost admission response never regains comparison ownership and expires without refund',async()=>{
    await issue(); const input=verifyInput();let once=true;
    db.hooks.afterBatch=()=>{if(once){once=false;throw new Error('lost response private');}};
    expect((await kernel.verify(input)).kind).toBe('unavailable');expect(compare).not.toHaveBeenCalled();
    expect((await kernel.verify(input)).kind).toBe('in_progress');db.now+=30;
    expect((await kernel.verify(input)).kind).toBe('stale');expect(count('auth_otp_tickets')).toBe(1);expect(compare).not.toHaveBeenCalled();
  });
  it('lost finalization response replays completion without another session/cookie credential',async()=>{
    await issue();const input=verifyInput();
    db.hooks.afterBatch=()=>{if(count('sessions_v2')===1)throw new Error('lost final response');};
    expect((await kernel.verify(input)).kind).toBe('unavailable'); db.hooks.afterBatch=undefined;
    expect(await kernel.verify(input)).toEqual({kind:'completed',replayed:true,sessionRequired:true});
    expect(count('sessions_v2')).toBe(1);expect(compare).toHaveBeenCalledTimes(1);idle();
  });
  it('preliminary replay retains original proof expiry and final reset spends its own admission',async()=>{
    await issue('issue_forgot');const input=verifyInput('reset_preliminary');
    const first=await kernel.verify(input);expect(first.kind).toBe('proof');db.now+=60;
    const replay=await kernel.verify(input);expect(replay.kind).toBe('proof');
    if(first.kind==='proof'&&replay.kind==='proof') expect(replay.proofExpiresAt).toBe(first.proofExpiresAt);
    expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{used:0}]);
    expect((await kernel.verify(verifyInput('reset_final'))).kind).toBe('completed');
    expect(compare).toHaveBeenCalledTimes(2);expect(count('auth_otp_tickets')).toBe(2);
  });
  it.each(['sessions_v2','auth_accounts','auth_otp_requests','auth_otp_issuances'] as const)('constraint failure in %s rolls back all required effects',async(table)=>{
    await issue('issue_forgot');
    db.seed(`INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at) VALUES('old-session','otp-user','hh_otp-user','old-token','2030-01-01');
      CREATE TRIGGER fail_effect BEFORE ${table==='sessions_v2'?'INSERT':'UPDATE'} ON ${table}
      BEGIN SELECT RAISE(ABORT, 'forced private fault'); END;`);
    expect((await kernel.verify(verifyInput('reset_final'))).kind).toBe('unavailable');
    expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{used:0}]);
    expect(db.query('SELECT password_hash,salt FROM auth_accounts')).toEqual([{password_hash:'old-hash',salt:'old-salt'}]);
    expect(sessions()).toEqual([{id:'old-session',token_hash:'old-token',revoked_at:null}]);idle();
  });
  it.each(['auth_accounts','sessions_v2'] as const)('required %s zero-write aborts consume/password/revocation',async(table)=>{
    await issue('issue_forgot');
    db.seed(`CREATE TRIGGER ignore_effect BEFORE ${table==='sessions_v2'?'INSERT':'UPDATE'} ON ${table} BEGIN SELECT RAISE(IGNORE); END;`);
    expect((await kernel.verify(verifyInput('reset_final'))).kind).toBe('unavailable');
    expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{used:0}]);
    expect(db.query('SELECT password_hash FROM auth_accounts')).toEqual([{password_hash:'old-hash'}]);expect(count('sessions_v2')).toBe(0);idle();
  });
  it('required fifth-ticket lock zero-write rolls back admission',async()=>{
    await issue();for(let n=0;n<4;n++)await kernel.verify(verifyInput('register_verify','000000'));
    db.seed('CREATE TRIGGER ignore_lock BEFORE UPDATE OF locked_until ON auth_otp_scopes BEGIN SELECT RAISE(IGNORE); END;');
    expect((await kernel.verify(verifyInput())).kind).toBe('unavailable');expect(compare).toHaveBeenCalledTimes(4);expect(count('auth_otp_tickets')).toBe(4);idle();
  });
  it('revocation postcondition aborts if any old session survived ignored writes',async()=>{
    await issue('issue_forgot'); db.seed(`INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at) VALUES('old','otp-user','hh_otp-user','old','2030-01-01');
      CREATE TRIGGER ignore_revoke BEFORE UPDATE ON sessions_v2 BEGIN SELECT RAISE(IGNORE); END;`);
    expect((await kernel.verify(verifyInput('reset_final'))).kind).toBe('unavailable');
    expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{used:0}]);expect(count('sessions_v2')).toBe(1);idle();
  });
  it.each([0,2])('reset revocation allows %i old sessions and creates exactly one new session',async(old)=>{
    await issue('issue_forgot');
    for(let n=0;n<old;n++)db.execute("INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at) VALUES(?,'otp-user','hh_otp-user',?,'2030-01-01')",['old'+n,'hash'+n]);
    expect((await kernel.verify(verifyInput('reset_final'))).kind).toBe('completed');
    expect(count('sessions_v2')).toBe(old+1);expect(db.query<{n:number}>('SELECT COUNT(*) n FROM sessions_v2 WHERE revoked_at IS NULL')[0].n).toBe(1);idle();
  });
  it('supersession between comparison and finalization prevents all effects',async()=>{
    await issue();compare.mockImplementationOnce(async()=>{db.now+=60;await issue();return true;});
    expect((await kernel.verify(verifyInput())).kind).toBe('stale');expect(count('sessions_v2')).toBe(0);
    expect(db.query('SELECT is_verified FROM auth_accounts')).toEqual([{is_verified:0}]);idle();
  });
  it('ticket deadline equality denies finalize without refund',async()=>{
    await issue();compare.mockImplementationOnce(async()=>{db.now+=30;return true;});
    expect((await kernel.verify(verifyInput())).kind).toBe('stale');expect(count('auth_otp_tickets')).toBe(1);expect(count('sessions_v2')).toBe(0);
  });
  it('challenge expiry equality denies comparison while preserving accounting',async()=>{
    await issue();db.now+=600;expect((await kernel.verify(verifyInput())).kind).toBe('unavailable');expect(compare).not.toHaveBeenCalled();expect(count('auth_otp_tickets')).toBe(1);
  });
  it('window/lock equality permits new admission; exactly900old tickets are excluded',async()=>{
    await issue();for(let n=0;n<5;n++)await kernel.verify(verifyInput('register_verify','000000'));
    db.now+=899;expect((await kernel.verify(verifyInput())).kind).toBe('budget');db.now++;
    await issue();expect((await kernel.verify(verifyInput())).kind).toBe('completed');expect(compare).toHaveBeenCalledTimes(6);
  });
  it('reservation rechecks key expiry even for completion replay after a valid clock read',async()=>{
    await issue();const input=verifyInput();await kernel.verify(input);db.now+=1800;
    db.hooks.beforeBatch=()=>{db.now++;};
    // Prepared SQL captures the earlier epoch in this controlled-clock test; replace only claim clock at the batch boundary.
    db.hooks.beforeStatement=()=>{db.now++;};
    expect((await kernel.verify(input)).kind).toBe('expired');expect(compare).toHaveBeenCalledTimes(1);
  });
  it('missing keys create new admissions and database/secret uncertainty never compares',async()=>{
    await issue();const input=verifyInput();delete input.requestKey;
    await kernel.verify({...input,code:'000000'});await kernel.verify({...input,code:'000000'});expect(compare).toHaveBeenCalledTimes(2);
    expect((await new StrictOtpCoordinator(db,'').verify(input)).kind).toBe('unavailable');
    db.hooks.beforeStatement=()=>{throw new Error('D1 unavailable');};expect((await kernel.verify(input)).kind).toBe('unavailable');expect(compare).toHaveBeenCalledTimes(2);
  });
  it('rejects login session escalation at the typed repository runtime boundary',async()=>{
    await issue('issue_login');const input=verifyInput('login_verify');
    compare.mockImplementationOnce(async()=>{throw new Error('pause after admission');});await kernel.verify(input);
    const ticket=db.query<{id:string;owner_id:string}>('SELECT id,owner_id FROM auth_otp_tickets')[0];
    expect(await finishOtpVerification(db,{ticketId:ticket.id,ownerId:ticket.owner_id,commandId:crypto.randomUUID(),valid:true,
      effects:{sessionId:'evil',sessionHash:'a'.repeat(64),householdId:'hh_otp-user',sessionExpiresAt:EPOCH+100}})).toEqual({status:'stale',proofExpiresAt:null});
    expect(count('sessions_v2')).toBe(0);
  });
});

describe('legacy accounting and durable identity',()=>{
  it('imports all retained failures once, including used/expired rows and preserves lock/cooldown',async()=>{
    db.execute(`INSERT INTO auth_otps(id,email,purpose,code_digest,digest_version,expires_at,used,attempt_count,locked_until,created_at)
      VALUES('legacy1',?,'register',?,2,'2020-01-01',1,2,datetime(?,'unixepoch'),datetime(?,'unixepoch'))`,[EMAIL,'a'.repeat(64),EPOCH+1200,EPOCH-10]);
    db.execute(`INSERT INTO auth_otps(id,email,purpose,code_digest,digest_version,expires_at,used,attempt_count,created_at)
      VALUES('legacy2',?,'register',?,1,'2020-01-01',0,3,'2020-01-01')`,[EMAIL.toUpperCase(),'b'.repeat(64)]);
    expect((await kernel.verify(verifyInput())).kind).toBe('budget');expect(compare).not.toHaveBeenCalled();
    expect(db.query('SELECT legacy_weight,locked_until,cooldown_until FROM auth_otp_scopes')).toEqual([{legacy_weight:5,locked_until:EPOCH+1200,cooldown_until:EPOCH+50}]);
    expect(count('auth_otp_tickets')).toBe(1);db.seed('DELETE FROM auth_otps');
    expect((await kernel.verify(verifyInput())).kind).toBe('budget');expect(count('auth_otp_tickets')).toBe(1);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);expect(db.query('PRAGMA quick_check')).toEqual([{quick_check:'ok'}]);
  });
  it('account deletion/recreation retains budget and cannot authorize old principal',async()=>{
    await issue();await kernel.verify(verifyInput('register_verify','000000'));
    db.seed(`DELETE FROM auth_accounts; INSERT INTO auth_accounts(id,user_id,email,is_verified) VALUES('replacement','otp-user','${EMAIL}',0);`);
    expect((await kernel.verify(verifyInput())).kind).toBe('unavailable');expect(compare).toHaveBeenCalledTimes(1);expect(count('auth_otp_tickets')).toBe(2);
    expect(db.query('SELECT is_verified FROM auth_accounts')).toEqual([{is_verified:0}]);
  });
  it('persists no raw email/code/password/body/session credential in authority tables',async()=>{
    await issue('issue_forgot');const result=await kernel.verify(verifyInput('reset_final'));
    const authority=JSON.stringify(['auth_otp_requests','auth_otp_scopes','auth_otp_tickets','auth_otp_issuances'].flatMap(t=>db.query(`SELECT * FROM ${t}`)));
    expect(authority).not.toContain(EMAIL);expect(authority).not.toContain('123456');expect(authority).not.toContain('new-password-strong');
    if(result.kind==='completed'&&result.sessionToken)expect(authority).not.toContain(result.sessionToken);
  });
  it('reads a database clock and leaves legacy OTP bytes untouched in dormant schema',async()=>{
    expect(await readOtpDatabaseTime(db)).toBe(EPOCH);
    expect(db.migrations.at(-1)).toBe('0040_strict_otp_foundation.sql');idle();
  });
});

// Additional review regressions exercise storage faults and replay freshness.
describe('review regressions',()=>{
  it('readiness-outcome zero-write rolls back the admitted accounting/request',async()=>{
    await issue('issue_register',EMAIL,'pending');
    db.seed("CREATE TRIGGER ignore_readiness BEFORE UPDATE OF status ON auth_otp_requests WHEN NEW.status = 'unavailable' BEGIN SELECT RAISE(IGNORE); END;");
    expect((await kernel.verify(verifyInput())).kind).toBe('unavailable');
    expect(count('auth_otp_tickets')).toBe(0);expect(count('auth_otp_requests')).toBe(1);expect(compare).not.toHaveBeenCalled();idle();
  });
  it('a delayed admission acknowledgement expires before any comparison',async()=>{
    await issue();let once=true;
    db.hooks.afterBatch=()=>{if(once){once=false;db.now+=30;}};
    expect((await kernel.verify(verifyInput())).kind).toBe('stale');
    expect(compare).not.toHaveBeenCalled();expect(count('auth_otp_tickets')).toBe(1);idle();
  });
  it('wrong comparison crossing deadline records stale with budget retained',async()=>{
    await issue();compare.mockImplementationOnce(async()=>{db.now+=30;return false;});
    expect((await kernel.verify(verifyInput('register_verify','000000'))).kind).toBe('stale');
    expect(count('auth_otp_tickets')).toBe(1);idle();
  });
  it('proof replay is stale after supersession and cannot renew expiry',async()=>{
    await issue('issue_forgot');const input=verifyInput('reset_preliminary');
    expect((await kernel.verify(input)).kind).toBe('proof');db.now+=60;await issue('issue_forgot');
    expect((await kernel.verify(input)).kind).toBe('stale');expect(compare).toHaveBeenCalledTimes(1);
  });
  it('proof replay becomes stale when final reset consumes its challenge',async()=>{
    await issue('issue_forgot');const input=verifyInput('reset_preliminary');await kernel.verify(input);
    await kernel.verify(verifyInput('reset_final'));expect((await kernel.verify(input)).kind).toBe('stale');
    expect(count('sessions_v2')).toBe(1);expect(compare).toHaveBeenCalledTimes(2);
  });
  it('proof expiry equality is stale without a new proof or comparison',async()=>{
    await issue('issue_forgot');const input=verifyInput('reset_preliminary');const result=await kernel.verify(input);
    if(result.kind!=='proof')throw new Error('Fixture proof');db.now=result.proofExpiresAt;
    expect((await kernel.verify(input)).kind).toBe('stale');expect(compare).toHaveBeenCalledTimes(1);
  });
  it('legacy challenge remains byte-identical while its accounting is imported',async()=>{
    db.execute("INSERT INTO auth_otps(id,email,purpose,code_digest,expires_at,attempt_count,created_at) VALUES('legacy',?,'register',?,'2030-01-01',1,'2020-01-01')",[EMAIL,'a'.repeat(64)]);
    const before=db.query('SELECT * FROM auth_otps');await kernel.verify(verifyInput());
    expect(db.query('SELECT * FROM auth_otps')).toEqual(before);expect(compare).not.toHaveBeenCalled();
    expect(db.query("SELECT weight FROM auth_otp_tickets WHERE operation='legacy_import'")).toEqual([{weight:1}]);
  });
});


describe('final review regressions', () => {
  it('defers registration with guest transfer before comparison or activation', async () => {
    await issue();
    expect((await kernel.verify({ ...verifyInput(), semanticBody: { migrateFromHouseholdId: 'guest-household' } })).kind).toBe('unavailable');
    expect(compare).not.toHaveBeenCalled(); expect(count('sessions_v2')).toBe(0);
    expect(db.query('SELECT is_verified FROM auth_accounts')).toEqual([{ is_verified: 0 }]);
    expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{ used: 0 }]);
    expect(count('auth_otp_tickets')).toBe(0); idle();
  });
  it('recreated account after admission makes the ticket stale before comparison without refund', async () => {
    await issue(); let once = true;
    db.hooks.afterBatch = () => {
      if (once) {
        once = false;
        db.seed(`DELETE FROM auth_accounts WHERE id = 'otp-account';
          INSERT INTO auth_accounts(id, user_id, email, is_verified, password_hash, salt)
          VALUES ('replacement-account', 'otp-user', '${EMAIL}', 0, 'replacement-hash', 'replacement-salt');`);
      }
    };
    expect((await kernel.verify(verifyInput())).kind).toBe('stale');
    expect(compare).not.toHaveBeenCalled(); expect(count('sessions_v2')).toBe(0);
    expect(db.query('SELECT state, weight FROM auth_otp_tickets')).toEqual([{ state: 'stale', weight: 1 }]); idle();
  });
  it.each(['issuance', 'principal'] as const)('missing %s makes preliminary proof replay stale', async (missing) => {
    await issue('issue_forgot'); const input = verifyInput('reset_preliminary');
    expect((await kernel.verify(input)).kind).toBe('proof');
    db.seed(missing === 'issuance' ? 'DELETE FROM auth_otp_issuances;' : "DELETE FROM auth_accounts WHERE id = 'otp-account';");
    expect((await kernel.verify(input)).kind).toBe('stale');
    expect(compare).toHaveBeenCalledTimes(1); expect(count('sessions_v2')).toBe(0); idle();
  });
  it('ignored legacy import rolls back initialization and issuance rather than refunding failures', async () => {
    db.execute("INSERT INTO auth_otps(id,email,purpose,code_digest,expires_at,attempt_count,created_at) VALUES('legacy',?,'register',?,'2030-01-01',4,'2020-01-01')", [EMAIL, 'a'.repeat(64)]);
    db.seed("CREATE TRIGGER ignore_import BEFORE INSERT ON auth_otp_tickets WHEN NEW.operation = 'legacy_import' BEGIN SELECT RAISE(IGNORE); END;");
    expect((await kernel.reserveIssuance({ email: EMAIL, purpose: 'register', operation: 'issue_register', code: '123456', requestKey: key() })).kind).toBe('unavailable');
    expect(count('auth_otp_scopes')).toBe(0); expect(count('auth_otp_requests')).toBe(0); expect(count('auth_otp_issuances')).toBe(0);
    expect(count('auth_otp_tickets')).toBe(0); expect(compare).not.toHaveBeenCalled(); idle();
    db.seed('DROP TRIGGER ignore_import;'); await issue();
    expect((await kernel.verify(verifyInput('register_verify', '000000'))).kind).toBe('invalid');
    expect((await kernel.verify(verifyInput())).kind).toBe('budget'); expect(compare).toHaveBeenCalledTimes(1);
  });
  it.each(['auth_otp_tickets', 'auth_otp_requests'] as const)('ignored expiration on %s rolls back the paired stale outcome', async (table) => {
    await issue(); const input = verifyInput(); let once = true;
    db.hooks.afterBatch = () => { if (once) { once = false; throw new Error('lost admission response'); } };
    expect((await kernel.verify(input)).kind).toBe('unavailable'); db.hooks.afterBatch = undefined; db.now += 30;
    const column = table === 'auth_otp_tickets' ? 'state' : 'status';
    db.seed(`CREATE TRIGGER ignore_expiration BEFORE UPDATE OF ${column} ON ${table} WHEN NEW.${column} = 'stale' BEGIN SELECT RAISE(IGNORE); END;`);
    expect((await kernel.verify(input)).kind).toBe('unavailable');
    expect(db.query('SELECT state, weight FROM auth_otp_tickets')).toEqual([{ state: 'admitted', weight: 1 }]);
    expect(db.query("SELECT status FROM auth_otp_requests WHERE operation = 'register_verify'")).toEqual([{ status: 'pending' }]); idle();
    db.seed('DROP TRIGGER ignore_expiration;'); expect((await kernel.verify(input)).kind).toBe('stale');
    expect(db.query('SELECT state, weight FROM auth_otp_tickets')).toEqual([{ state: 'stale', weight: 1 }]);
    expect((await kernel.verify(input)).kind).toBe('stale'); expect(compare).not.toHaveBeenCalled(); expect(count('auth_otp_tickets')).toBe(1); idle();
  });
});
