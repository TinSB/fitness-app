import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-2C AppData Real Export Parity — TS-side static guards.
//
// Locks that the redacted real export at the canonical iOS-0 path is
// reachable from Swift tests via `#filePath` resolution, that the
// iOS-0 golden hash for that fixture exists, and that iOS-2C did NOT
// duplicate the 805 KB file into the Swift package.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const REDACTED_REAL_EXPORT =
  'tests/fixtures/data-health/ironpath-2026-05-27-redacted.json';
const REAL_EXPORT_GOLDEN =
  'tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json';
const SWIFT_TEST_FIXTURES_DIR =
  'ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures';
const REAL_EXPORT_TEST =
  'ios/packages/IronPathDomain/Tests/IronPathDomainTests/AppDataRealExportParityTests.swift';

describe('iosAppDataRealExportParity — canonical real export is reachable + un-duplicated', () => {
  it('iosAppDataRealExportParity redacted real export exists at canonical path', () => {
    const path = resolve(repoRoot, REDACTED_REAL_EXPORT);
    expect(existsSync(path)).toBe(true);
    // The file is large (~805 KB); the guard fails fast if it shrank
    // unexpectedly. 500 KB lower bound is a safety margin.
    expect(statSync(path).size).toBeGreaterThan(500_000);
  });

  it('iosAppDataRealExportParity iOS-0 real-export golden exists with snapshotHash field', () => {
    const path = resolve(repoRoot, REAL_EXPORT_GOLDEN);
    expect(existsSync(path)).toBe(true);
    const golden = JSON.parse(readFileSync(path, 'utf8'));
    expect(typeof golden.snapshotHash).toBe('string');
    expect(golden.snapshotHash).toMatch(/^phase19b-[0-9a-f]{8}$/);
  });

  it('iosAppDataRealExportParity Swift test bundle does NOT carry a redacted real export copy (805 KB savings)', () => {
    // The Swift test reads the canonical path via `#filePath` walk-up
    // rather than via `Bundle.module`. The iOS-2C deliberate decision
    // is to NOT duplicate the 805 KB file into the Swift package.
    const redactedCopy = resolve(
      repoRoot,
      SWIFT_TEST_FIXTURES_DIR,
      'ironpath-2026-05-27-redacted.json',
    );
    expect(existsSync(redactedCopy), 'redacted real export must NOT be copied into the Swift Fixtures bundle').toBe(false);
  });

  it('iosAppDataRealExportParity AppDataRealExportParityTests uses #filePath walk-up to reach the canonical path', () => {
    const path = resolve(repoRoot, REAL_EXPORT_TEST);
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('#filePath');
    expect(text).toContain('tests/fixtures/data-health/ironpath-2026-05-27-redacted.json');
    expect(text).toContain('tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json');
  });

  it('iosAppDataRealExportParity AppDataRealExportParityTests asserts FNV-1a hash matches iOS-0 golden', () => {
    const path = resolve(repoRoot, REAL_EXPORT_TEST);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('phase19b-');
    expect(text).toContain('snapshotHash');
    expect(text).toContain('testRealExportFnv1aHashMatchesIos0Golden');
  });

  it('iosAppDataRealExportParity AppDataRealExportParityTests covers Agent 3 §6 deferred gaps (a) + (b)', () => {
    const path = resolve(repoRoot, REAL_EXPORT_TEST);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('testRealExportRestTimerStateTypedNonNilAtLeastOnce');
    expect(text).toContain('testRealExportHealthMetricSamplesRawTypedNonNilAtLeastOnce');
  });
});

describe('iosAppDataRealExportParity — Swift snapshot-hash fixture copies stay byte-equal to canonical (iOS-2B carryover)', () => {
  it('iosAppDataRealExportParity snapshot-hash input fixture copy is unchanged', () => {
    const canonical = readFileSync(
      resolve(
        repoRoot,
        'tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json',
      ),
    );
    const swiftCopy = readFileSync(
      resolve(
        repoRoot,
        SWIFT_TEST_FIXTURES_DIR,
        'snapshot-hash-stable-v1-input.json',
      ),
    );
    expect(swiftCopy.equals(canonical)).toBe(true);
  });

  it('iosAppDataRealExportParity snapshot-hash golden fixture copy is unchanged', () => {
    const canonical = readFileSync(
      resolve(
        repoRoot,
        'tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json',
      ),
    );
    const swiftCopy = readFileSync(
      resolve(
        repoRoot,
        SWIFT_TEST_FIXTURES_DIR,
        'snapshot-hash-stable-v1-golden.json',
      ),
    );
    expect(swiftCopy.equals(canonical)).toBe(true);
  });
});
