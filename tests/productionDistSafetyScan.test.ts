import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanProductionDistSafety } from '../scripts/scan-production-dist-safety.mjs';

describe('production dist safety scan', () => {
  it('passes clean built browser output fixtures', () => {
    const root = mkdtempSync(join(tmpdir(), 'ironpath-dist-scan-clean-'));
    try {
      writeFileSync(join(root, 'index.js'), 'console.log("本地数据仍可使用");');

      const result = scanProductionDistSafety({ root, distDir: '.' });

      expect(result.skipped).toBe(false);
      expect(result.findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('flags forbidden visible copy and secret-like values in dist fixtures', () => {
    const root = mkdtempSync(join(tmpdir(), 'ironpath-dist-scan-finding-'));
    try {
      writeFileSync(
        join(root, 'index.js'),
        [
          'console.log("background sync");',
          'const key = "eyJaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccccc";',
          'const url = "/auth?service_role=unsafe";',
          'const session = { access_token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", refresh_token: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" };',
        ].join('\n'),
      );

      const result = scanProductionDistSafety({ root, distDir: '.' });

      expect(result.findings.map((finding) => finding.id)).toEqual(
        expect.arrayContaining([
          'forbidden-visible-copy',
          'jwt-like-value',
          'service-role-assignment',
          'literal-access-token-value',
          'literal-refresh-token-value',
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
