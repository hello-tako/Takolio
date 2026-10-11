import gzip,hashlib,json,pathlib,re,subprocess,sys
root=pathlib.Path.cwd();d=root/'docs/backend-upgrade/b01a-a2';art=root/'.artifacts/backend-b01a-a2';sha=lambda b:hashlib.sha256(b).hexdigest()
def obj(p):return json.loads(p.read_text())
v=obj(d/'validation.json');m=obj(d/'git-verification.json');impl=v['implementationSha'];exported={}
for record in v['rawLogs']:exported[record['rawPath']]=gzip.decompress((root/record['gzipPath']).read_bytes())
for p in d.rglob('*.json'):obj(p)
for f in m['frozenSource']:
 raw=(root/f['path']).read_bytes();assert sha(raw)==f['sha256'];assert raw==subprocess.check_output(['git','show',f"{impl}:{f['path']}"])
for f in m['protectedSource']:
 raw=(root/f['path']).read_bytes();assert sha(raw)==f['sha256'];assert raw==subprocess.check_output(['git','show',f"{v['baseSha']}:{f['path']}"])
for f in m['receiptPayload']:
 raw=(root/f['path']).read_bytes();assert len(raw)==f['bytes'] and sha(raw)==f['sha256'],f['path']
for l in v['rawLogs']:
 packed=(root/l['gzipPath']).read_bytes();raw=gzip.decompress(packed);assert sha(packed)==l['gzipSha256'] and len(packed)==l['gzipBytes'];assert sha(raw)==l['rawSha256'] and len(raw)==l['rawBytes'];
 if (root/l['rawPath']).exists():assert raw==(root/l['rawPath']).read_bytes()
for r in v['rootCommandReceipts']:
 raw=exported[r['logPath']];assert sha(raw)==r['logSha256']
for a in v['attachments']:assert sha((root/a['path']).read_bytes())==a['sha256']
for name in ['full-tests-final','build-sequential']:
 r=next(r for r in v['rootCommandReceipts'] if r['name']==name);assert r['exitCode']==0 and r['sourceBefore']['headSha']==r['sourceAfter']['headSha']==impl;assert r['sourceBefore']['status']==r['sourceAfter']['status']==''
assert next(r for r in v['rootCommandReceipts'] if r['name']=='full-tests-committed')['exitCode']==1
assert next(r for r in v['rootCommandReceipts'] if r['name']=='typecheck-recovery')['exitCode']==2
assert next(r for r in v['rootCommandReceipts'] if r['name']=='typecheck-recovery-final')['exitCode']==0
for name in ['audit-full','audit-prod']:assert next(r for r in v['rootCommandReceipts'] if r['name']==name)['exitCode']==1
sync=obj(d/'plan-sync.json')
for rec in sync['canonicalHistoricalSuffixes']:
 raw=(root/rec['path']).read_bytes();old=subprocess.check_output(['git','show',f"{impl}:{rec['path']}"]);assert raw.endswith(old) and sha(raw)==rec['afterSha256'];assert sha(old)==rec['sha256'];assert old==subprocess.check_output(['git','show',f"{impl}:{rec['path']}"])
legacy=pathlib.Path(sync['originalPlanPath'])
if legacy.exists():
 raw=legacy.read_bytes();old=raw[-sync['originalPlanHistoricalBytesPreserved']:];assert sha(old)==sync['originalPlanBeforeSha256'] and sha(raw)==sync['originalPlanAfterSha256']
else:print('Original workspace plan absent: only its recorded synchronization hashes are available')
assert sync['masterplanSha256']=='13809f0874ae357707fc6a37a16f5e8b3164674eeb194dff0adc3ae7f530b44b'
master=pathlib.Path(sync['masterplanPath'])
if master.exists():assert sha(master.read_bytes())==sync['masterplanSha256']
else:print('Masterplan input absent: only its recorded checksum is available')
for p in d.glob('*.md'):
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if link.startswith(('https://','http://','#')):continue
  target=link.split('#')[0];assert (p.parent/target).exists(),(str(p),link)
subprocess.run(['git','diff','--check'],check=True)
if '--committed' in sys.argv:
 head=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip();assert subprocess.check_output(['git','status','--porcelain']).decode()==''
 changed=subprocess.check_output(['git','diff','--name-only',impl,head]).decode().splitlines();assert changed and all(s.startswith('docs/') for s in changed),changed
 for s in changed:assert (root/s).read_bytes()==subprocess.check_output(['git','show',f'{head}:{s}'])
 print(f'final receipt commit={head}; clean tree; docs-only delta={len(changed)} paths; all committed blobs match')
print(f"packet=PASS: source{len(m['frozenSource'])}/protected{len(m['protectedSource'])}; gzip{len(v['rawLogs'])}/commands{len(v['rootCommandReceipts'])}; histories/masterplan/sourceblobs/hashlinks valid")
