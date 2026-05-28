import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-2B AppData Swift Models V1 — Fixture-sync byte-equality guard.
//
// Per iOS-2A plan §12 and Agent 4 §10, the iOS-2B implementation
// copies the snapshot-hash input + golden parity fixtures into the
// IronPathDomain test resource bundle so the Swift tests can load
// them via `Bundle.module`. The copy is a one-time, byte-for-byte
// duplicate. This guard ensures the Swift-side copies cannot drift
// from the canonical parity tree without CI shouting.
//
// The canonical parity tree at `tests/fixtures/parity/inputs/app-data/`
// is the source of truth for iOS-0; any future PR that edits the
// canonical bytes MUST regenerate the Swift-side copies in the same
// PR, or this test fails.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const PAIRS: ReadonlyArray<{ canonical: string; swiftCopy: string }> = [
  {
    canonical: 'tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json',
    swiftCopy:
      'ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/snapshot-hash-stable-v1-input.json',
  },
  {
    canonical: 'tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json',
    swiftCopy:
      'ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/snapshot-hash-stable-v1-golden.json',
  },
];

describe('iosAppDataFixtureParityDocsGuard — Swift fixture copies match canonical bytes', () => {
  for (const { canonical, swiftCopy } of PAIRS) {
    it(`iosAppDataFixtureParityDocsGuard ${swiftCopy} matches ${canonical} byte-for-byte`, () => {
      const canonicalBytes = readFileSync(resolve(repoRoot, canonical));
      const copyBytes = readFileSync(resolve(repoRoot, swiftCopy));
      expect(
        copyBytes.equals(canonicalBytes),
        `${swiftCopy} drifted from ${canonical} — re-copy and commit.`,
      ).toBe(true);
    });
  }

  it('iosAppDataFixtureParityDocsGuard the Swift `Fixtures/` directory exists', () => {
    for (const { swiftCopy } of PAIRS) {
      const path = resolve(repoRoot, swiftCopy);
      // readFileSync throws if missing — this is implicit via the
      // previous iteration but kept explicit here to surface a
      // friendlier error when the bundle is removed.
      const bytes = readFileSync(path);
      expect(bytes.length).toBeGreaterThan(0);
    }
  });
});
