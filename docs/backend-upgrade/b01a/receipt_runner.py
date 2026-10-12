import datetime,hashlib,json,os,pathlib,subprocess,sys,time
root=pathlib.Path.cwd();folder=root/'.artifacts/backend-b01a';folder.mkdir(parents=True,exist_ok=True)
name=sys.argv[1];cmd=sys.argv[2:];env=os.environ.copy()
env['PATH']='/opt/homebrew/opt/node@24/bin:'+env['PATH'];env['NODE_OPTIONS']='--no-experimental-webstorage'
env['TMPDIR']=env.get('TAKOSAN_B01A_TMPDIR','/private/tmp');env['CI']='true';env['WRANGLER_SEND_METRICS']='false'
env.pop('CHECK_REMOTE_SCHEMA',None);env.pop('CHECK_WEEK_PARITY_REMOTE',None)
start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
p=subprocess.run(cmd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
log=folder/(name+'.log')
def write(path,raw):subprocess.run(['sh','-c','cat > "$1"','write',str(path)],input=raw,check=True)
write(log,p.stdout)
r={'name':name,'command':cmd,'startedAtUtc':start,'durationSeconds':round(time.monotonic()-t,3),'exitCode':p.returncode,'status':'PASS' if p.returncode==0 else 'FAIL','logPath':str(log.relative_to(root)),'logSha256':hashlib.sha256(p.stdout).hexdigest(),'environment':{k:env[k] for k in ['PATH','NODE_OPTIONS','TMPDIR','CI','WRANGLER_SEND_METRICS']},'remoteFlags':'unset'}
write(folder/(name+'.json'),(json.dumps(r,indent=2)+'\n').encode())
print(p.stdout.decode(errors='replace')[-10000:]);print(json.dumps(r));sys.exit(p.returncode)
