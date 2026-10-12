import datetime, hashlib, json, pathlib, subprocess, tempfile, urllib.request
root=pathlib.Path.cwd();out=root/'.artifacts/backend-b01a-a2';base='8f55a745e08c800898555be829b93c8f1a7a5d18'
def write(p,b):
 p.parent.mkdir(parents=True,exist_ok=True);subprocess.run(['sh','-c','cat > "$1"','write',str(p)],input=b,check=True)
def freeze(paths):return [{'path':s,'bytes':len((root/s).read_bytes()),'sha256':hashlib.sha256((root/s).read_bytes()).hexdigest()} for s in sorted(paths)]
changed=subprocess.check_output(['git','diff','--name-only',base]).decode().splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard']).decode().splitlines()
source=[s for s in changed if s.startswith(('src/','packages/','tests/'))]
assert len(source)==23,(len(source),source)
allowed=set(source)
tracked=subprocess.check_output(['git','ls-files']).decode().splitlines()
protected=[s for s in tracked if s not in allowed and s.startswith(('src/worker/','packages/','migrations/','scripts/','.github/'))]
protected += [s for s in ['package.json','pnpm-lock.yaml','wrangler.jsonc','vite.config.ts','vitest.config.ts','tsconfig.json','tsconfig.worker.json'] if s in tracked]
for s in protected:
 assert (root/s).read_bytes()==subprocess.check_output(['git','show',f'{base}:{s}']),s
master=pathlib.Path('/Users/tunbee27/Downloads/TAKOSAN_BACKEND_MASTERPLAN_2026-10-11.md')
assert hashlib.sha256(master.read_bytes()).hexdigest()=='13809f0874ae357707fc6a37a16f5e8b3164674eeb194dff0adc3ae7f530b44b'
write(out/'source-freeze-recovery.json',(json.dumps({'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseSha':base,'files':freeze(source)},indent=2)+'\n').encode())
write(out/'protected-freeze-recovery.json',(json.dumps({'baseSha':base,'files':freeze(set(protected)),'masterplanUnchanged':True,'migrationCount':len(list((root/'migrations').glob('*.sql')))},indent=2)+'\n').encode())
print(f'source-freeze=ok: {len(source)} source records; {len(set(protected))} protected records; all40 migrations unchanged; masterplan unchanged',flush=True)
