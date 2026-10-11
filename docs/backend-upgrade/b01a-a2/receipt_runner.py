import datetime,hashlib,json,os,pathlib,subprocess,sys,time
root=pathlib.Path.cwd();out=root/'.artifacts/backend-b01a-a2';out.mkdir(parents=True,exist_ok=True)
name=sys.argv[1];cmd=sys.argv[2:];assert not (out/(name+'.json')).exists(),name
hash_bytes=lambda b:hashlib.sha256(b).hexdigest()
def write(p,b):subprocess.run(['sh','-c','cat > "$1"','write',str(p)],input=b,check=True)
def snapshot():
 return {'workingDirectory':str(root),'headSha':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'status':subprocess.check_output(['git','status','--porcelain']).decode()}
env=os.environ.copy();env['PATH']='/opt/homebrew/opt/node@24/bin:'+env['PATH'];env['NODE_OPTIONS']='--no-experimental-webstorage';env['CI']='true';env['WRANGLER_SEND_METRICS']='false';env['TMPDIR']=env.get('TAKOSAN_A2_TMPDIR','/private/tmp');env.pop('CHECK_REMOTE_SCHEMA',None);env.pop('CHECK_WEEK_PARITY_REMOTE',None)
before=snapshot();start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic();p=subprocess.run(cmd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);duration=round(time.monotonic()-t,3)
log=out/(name+'.log');write(log,p.stdout)
r={'name':name,'command':cmd,'startedAtUtc':start,'durationSeconds':duration,'exitCode':p.returncode,'status':'PASS' if p.returncode==0 else 'FAIL','sourceBefore':before,'sourceAfter':snapshot(),'logPath':str(log.relative_to(root)),'logSha256':hash_bytes(p.stdout),'environment':{k:env[k] for k in ['NODE_OPTIONS','CI','WRANGLER_SEND_METRICS','TMPDIR']},'nodePath':'/opt/homebrew/opt/node@24/bin','remoteFlags':'unset'}
write(out/(name+'.json'),(json.dumps(r,indent=2)+'\n').encode());print(p.stdout.decode(errors='replace')[-16000:]);print(json.dumps(r));sys.exit(p.returncode)
