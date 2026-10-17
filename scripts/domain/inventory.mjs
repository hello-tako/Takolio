import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean).filter((path, index, all) => all.indexOf(path) === index);
const rows = [];
for (const path of files) {
  if (path.startsWith('docs/domain-integration/')) continue;
  if (!/\.(?:[cm]?[jt]sx?|jsonc?|html|md|txt|ya?ml|toml|sh|css|sql)$/.test(path)) continue;
  const source = readFileSync(path, 'utf8');
  if (source.includes('\0')) continue;
  source.split('\n').forEach((line, index) => {
    const matches = line.match(/https?:\/\/[^\s<>"'`\\)\]]+/g) || [];
    for (const raw of new Set(matches)) {
      let value;
      try {
        const url = new URL(raw);
        value = `${url.origin}${url.pathname}${url.search ? '?[QUERY_REDACTED]' : ''}`;
      } catch { value = '[TEMPLATED_URL]'; }
      const classification = path.startsWith('tests/') || /fixtures?\//.test(path) ? 'TEST_FIXTURE'
        : path.startsWith('docs/') || path.endsWith('.md') || path.startsWith('frigo_frontend_prompt_kit') ? 'DOCUMENTATION'
          : path.startsWith('scripts/') ? 'LEGACY_COMPATIBILITY'
            : /oauth|auth/.test(path) ? 'AUTH_CALLBACK'
              : /payos|billing|payment/.test(path) ? 'PAYMENT_CALLBACK'
                : /email/.test(path) ? 'EMAIL_LINK'
                  : /manifest|sw\.js/.test(path) ? 'PWA_CONFIG'
                    : path === 'index.html' ? 'SEO_URL'
                      : /unsplash|cloudflare|google|resend|aliyuncs|vietqr/.test(value) ? 'EXTERNAL_INTEGRATION' : 'RUNTIME_DEPENDENCY';
      rows.push({ path, line: index + 1, currentValue: value, classification,
        environment: /staging/.test(path + value) ? 'staging' : /localhost|127\.0\.0\.1/.test(value) ? 'local' : 'source-context',
        proposedValue: /^(DOCUMENTATION|TEST_FIXTURE|LEGACY_COMPATIBILITY|EXTERNAL_INTEGRATION)$/.test(classification) ? 'retain' : 'review via environment profile; no blanket replacement',
        risk: classification === 'AUTH_CALLBACK' || classification === 'PAYMENT_CALLBACK' ? 'high; provider registration required' : 'context-dependent',
        requiredTest: /DOCUMENTATION|TEST_FIXTURE/.test(classification) ? 'retain historical provenance' : 'domain/auth/payment/PWA matrix as applicable',
        rollback: 'retain original source and prior Worker version; restore via approved release gate' });
    }
  });
}
writeFileSync('docs/domain-integration/evidence/url-inventory.json.gz', gzipSync(JSON.stringify({ filesScanned: files.length, urlEntries: rows.length, classificationMethod: 'path-assisted inventory; runtime findings reviewed in 00-source-inventory.md; query values deliberately redacted', rows }), { level: 9 }));
process.stdout.write(`Inventoried ${rows.length} URL occurrences across ${files.length} tracked paths.\n`);
