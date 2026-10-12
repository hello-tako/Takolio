import hashlib,json,os,pathlib,subprocess,tempfile
root=pathlib.Path.cwd(); artifact=root/'.artifacts/backend-b01a'
def write(p,raw):
    p.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['sh','-c','cat > "$1"','write',str(p)],input=raw,check=True)
local=pathlib.Path(tempfile.mkdtemp(prefix='takosan-b01a-local-d1-',dir='/private/tmp')).resolve()
config={'name':'takosan-b01a-local','compatibility_date':'2024-11-01','d1_databases':[{'binding':'DB','database_name':'takosan-b01a-local','database_id':'00000000-0000-4000-8000-000000000040','migrations_dir':str(root/'migrations')}]}
write(local/'wrangler.local.jsonc',(json.dumps(config,indent=2)+'\n').encode())
env={k:v for k,v in os.environ.items() if not k.startswith(('CLOUDFLARE_','CF_','WRANGLER_API_'))}
base=['pnpm','exec','wrangler','d1']
flags=['--local','--persist-to',str(local/'state'),'--config',str(local/'wrangler.local.jsonc')]
commands=[]
def run(name,args):
    name = name.replace('d1-', 'd1-rerun-', 1)
    result=subprocess.run(args,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    write(artifact/(name+'.raw'),result.stdout)
    commands.append({'name':name,'command':args,'exitCode':result.returncode,'rawPath':str((artifact/(name+'.raw')).relative_to(root)),'rawSha256':hashlib.sha256(result.stdout).hexdigest()})
    print(json.dumps(commands[-1]),flush=True)
    print(result.stdout.decode(errors='replace')[-3000:],flush=True)
    assert result.returncode==0,name
    return result.stdout
run('d1-apply',base+['migrations','apply','takosan-b01a-local']+flags)
repeat=run('d1-reapply',base+['migrations','apply','takosan-b01a-local']+flags)
assert b'No migrations to apply' in repeat
run('d1-pending',base+['migrations','list','takosan-b01a-local']+flags)
gate=subprocess.check_output(['node','scripts/d1-schema-gate.mjs','render'],env=env,cwd=root)
write(local/'schema-gate.sql',gate)
gateout=json.loads(run('d1-gate',base+['execute','takosan-b01a-local']+flags+['--yes','--file',str(local/'schema-gate.sql'),'--json']))
assert gateout and all(x['success'] and x['results']==[] for x in gateout),gateout
sql="SELECT name FROM d1_migrations ORDER BY name; PRAGMA foreign_key_check; PRAGMA quick_check; SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 9) = 'auth_otp_' ORDER BY name;"
state=json.loads(run('d1-integrity',base+['execute','takosan-b01a-local']+flags+['--yes','--command',sql,'--json']))
assert len(state)==4 and all(x['success'] for x in state)
expected=sorted(p.name for p in (root/'migrations').iterdir() if p.suffix=='.sql')
actual=[x['name'] for x in state[0]['results']]
assert actual==expected and len(actual)==40,(actual,expected)
assert state[1]['results']==[]
assert state[2]['results']==[{'quick_check':'ok'}]
assert [x['name'] for x in state[3]['results']]==['auth_otp_assertions','auth_otp_claims','auth_otp_issuances','auth_otp_requests','auth_otp_scopes','auth_otp_tickets']
receipt={'status':'LOCAL_VERIFIED','localDirectory':str(local),'config':config,'commands':commands,'ledger':actual,'migrationCount':len(actual),'schemaGateIssues':[],'foreignKeyIssues':[],'quickCheck':'ok','otpTables':state[3]['results'],'remote':False,'productionCertified':False}
write(artifact/'local-d1.json',(json.dumps(receipt,indent=2)+'\n').encode())
print('isolated-local-d1=ok: 40 exact migrations, additive0040, gate[], FK[], quick_checkok, sixOTP tables',flush=True)
