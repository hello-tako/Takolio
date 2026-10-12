import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
describe('exact-context scanner adjudication', () => {
  it('blocks new, duplicate, changed-source, changed-provenance and unredacted findings', () => {
    const result = execFileSync('python3', ['-c', `
import hashlib, importlib.util, pathlib, tempfile
spec = importlib.util.spec_from_file_location('gate', 'scripts/security-context-gate.py')
gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
with tempfile.TemporaryDirectory(prefix='offline-gate-') as directory:
 root=pathlib.Path(directory); (root/'fixture.txt').write_text('TEST_ONLY synthetic fixture')
 digest=hashlib.sha256((root/'fixture.txt').read_bytes()).hexdigest()
 context={'schemaVersion':1,'noCredentialOrMatchBytes':True,'entries':[{'path':'fixture.txt','coordinates':[1,1,1,10,'generic-api-key'],'classification':'SYNTHETIC_TEST_FIXTURE','sourceFileSha256':digest,'provenanceInputHashes':[]}]}
 finding={'File':'fixture.txt','StartLine':1,'StartColumn':1,'EndLine':1,'EndColumn':10,'RuleID':'generic-api-key','Secret':'REDACTED','Match':'REDACTED'}
 assert gate.adjudicate(root,[finding],context)['status']=='ADJUDICATED'
 assert gate.adjudicate(root,[finding,finding],context)['unresolvedCount']==1
 assert gate.adjudicate(root,[dict(finding,StartLine=2)],context)['status']=='BLOCKED'
 (root/'fixture.txt').write_text('Changed context')
 assert gate.adjudicate(root,[finding],context)['status']=='BLOCKED'
 try: gate.adjudicate(root,[dict(finding,Secret='not-redacted')],context)
 except ValueError: pass
 else: raise AssertionError('unredacted finding accepted')
 (root/'fixture.txt').write_text('TEST_ONLY synthetic fixture')
 context['entries'][0]['provenanceInputHashes']=[{'path':'missing.txt','sha256':digest}]
 assert gate.adjudicate(root,[finding],context)['status']=='BLOCKED'
print('security-context-fixtures=PASS')
`], { encoding: 'utf8' });
    expect(result.trim()).toBe('security-context-fixtures=PASS');
  });
});
