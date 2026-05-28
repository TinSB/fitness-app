import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-0 Contract Fixture Export V1 — privacy guard re-validation.
//
// Re-runs the privacy guard pattern list (same shape as the in-script
// guard in scripts/parityGoldensEntry.ts) against every fixture under
// tests/fixtures/parity/. Catches accidental token / email / userId /
// deviceLabel commits independently of the generator.
//
// This file does NOT scan the existing redacted real export at
// tests/fixtures/data-health/ironpath-2026-05-27-redacted.json — that file
// has its own existing tests and was already redacted by the original
// fixture authoring.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const PARITY_ROOT = resolve(repoRoot, 'tests/fixtures/parity');

const PRIVACY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'supabase_service_role_key', pattern: /SUPABASE_SERVICE_ROLE_KEY/i },
  { name: 'sb_secret_prefix', pattern: /sb_secret_/ },
  { name: 'service_role_literal', pattern: /service_role/i },
  { name: 'jwt_prefix', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXV/ },
  { name: 'stripe_or_api_key', pattern: /sk_(live|test)_/ },
  { name: 'api_key_literal', pattern: /api[_-]?key\s*[:=]/i },
  { name: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: 'bearer_token', pattern: /\bbearer\s+[A-Za-z0-9._\-=+]+/i },
  { name: 'authorization_header', pattern: /authorization\s*:/i },
  { name: 'cookie_header', pattern: /(set-cookie|cookie)\s*:/i },
];

const PRIVACY_ALLOWLIST_VALUES = new Set([
  '<redacted>',
  'synthetic-user',
  'iPhone',
  'iPad',
  'redacted-device',
]);

const walk = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.json')) out.push(full);
  }
};

const collectFiles = (): string[] => {
  const files: string[] = [];
  walk(PARITY_ROOT, files);
  return files.sort();
};

describe('parityFixturesPrivacyGuard', () => {
  const files = collectFiles();

  it('parityFixturesPrivacyGuard found fixtures to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(10); // 5 inputs + 5 goldens
    for (const f of files) {
      expect(statSync(f).isFile()).toBe(true);
    }
  });

  for (const file of files) {
    const relative = file.replace(`${repoRoot}/`, '');
    it(`parityFixturesPrivacyGuard scans ${relative} for tokens / PII`, () => {
      const text = readFileSync(file, 'utf8');
      const hits: string[] = [];
      for (const { name, pattern } of PRIVACY_PATTERNS) {
        const match = text.match(pattern);
        if (match) hits.push(`${name}: ${match[0].slice(0, 80)}`);
      }
      // userId / deviceLabel allow-list guard.
      const idPair = /"(userId|deviceLabel)"\s*:\s*"([^"]+)"/g;
      for (const m of text.matchAll(idPair)) {
        const value = m[2];
        if (PRIVACY_ALLOWLIST_VALUES.has(value)) continue;
        if (value.startsWith('synthetic-')) continue;
        if (value === '<redacted>') continue;
        hits.push(`${m[1]}=${value.slice(0, 40)} not in allowlist`);
      }
      expect(hits, hits.join('; ')).toEqual([]);
    });
  }

  it('parityFixturesPrivacyGuard pattern list mirrors the in-script guard surface', () => {
    // Sanity: the in-script guard in scripts/parityGoldensEntry.ts must
    // cover at least the same pattern set as this test. If the test
    // grows a new pattern, the in-script guard MUST grow it too so the
    // generator fails before commit.
    const inScript = readFileSync(
      resolve(repoRoot, 'scripts/parityGoldensEntry.ts'),
      'utf8',
    );
    for (const { name } of PRIVACY_PATTERNS) {
      expect(inScript, `missing in-script pattern: ${name}`).toContain(name);
    }
  });
});
