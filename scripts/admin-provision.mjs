#!/usr/bin/env node
// Local-only enrollment and three-operator atomic bootstrap. No customer D1 access.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalProvisioningAllowed, buildBootstrapAdminSql, hashPassword, localWranglerEnv, sql } from './admin-local-lib.mjs';
const argv = process.argv.slice(2);
function values(flag) { return argv.flatMap((v,i)=>v===flag?[argv[i+1]]:[]); }
try {
  assertLocalProvisioningAllowed({argv});
  const emails=values('--email').map(v=>String(v).trim().toLowerCase());
  const approval=values('--approval-ref')[0];
  const password=process.env.ADMIN_LOCAL_PASSWORD;
  if(emails.length!==3 || new Set(emails).size!==3 || emails.some(v=>!/^[a-z0-9._+-]+@[a-z0-9.-]+\.test$/.test(v))) throw new Error('Three distinct reserved .test emails are required');
  if(!approval || approval.length<8 || approval.length>200)throw new Error('Explicit --approval-ref is required');
  if(!password || password.length<12)throw new Error('Set ADMIN_LOCAL_PASSWORD (at least 12 characters)');
  const env=localWranglerEnv();
  const directory=mkdtempSync(path.join(tmpdir(),'takosan-admin-local-enrollment-'));
  const file=path.join(directory,'ceremony.sql');
  const now=new Date().toISOString();
  const ceremony='ceremony_'+randomBytes(12).toString('hex');
  const ids=emails.map(()=> 'local_'+randomBytes(12).toString('hex'));
  const statements=emails.map((email,i)=>{
    const id=ids[i],operator='operator_'+randomBytes(12).toString('hex'),salt=randomBytes(16).toString('hex');
    return `INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at) VALUES(${sql(operator)},${sql(approval)},${sql(now)});
      INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name)
        VALUES(${sql(id)},${sql(operator)},'https://local.cloudflareaccess.com',${sql(id)},${sql(now)},${sql(approval)},${sql(email)},${sql(email.split('@')[0])});
      INSERT INTO admin_local_credentials(user_id,email,display_name,password_hash,salt)
        VALUES(${sql(id)},${sql(email)},${sql(email.split('@')[0])},${sql(hashPassword(password,salt))},${sql(salt)});`;
  });
  statements.push(buildBootstrapAdminSql({userIds:ids,ceremonyId:ceremony,independentApprovalRef:approval,createdAt:now}));
  writeFileSync(file,statements.join('\n'),{mode:0o600});
  const persist=values('--persist-to')[0];
  const result=spawnSync('pnpm',['exec','wrangler','d1','execute','takosan-admin-db','--local','-c','wrangler.admin-local.jsonc','--file',file,...(persist?['--persist-to',persist]:[])],{encoding:'utf8',env});
  // Keep the private SQL available for inspection; never echo credentials.
  if(result.status!==0)throw new Error('Local ceremony failed; inspect local D1 state before retrying');
  console.log('Local Admin enrollment and atomic three-operator bootstrap applied. Synthetic local authority only.');
} catch(error) { console.error(error instanceof Error?error.message:String(error));process.exitCode=1; }
