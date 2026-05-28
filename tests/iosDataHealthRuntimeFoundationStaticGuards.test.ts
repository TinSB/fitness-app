import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-3A Data Health Runtime Foundation V1 — static guards.
//
// Locks the Swift surface area of iOS-3A:
//   * Expected Swift files exist at the expected paths.
//   * DataHealthConstants.swift values match the TS source-of-truth at
//     `src/dataHealth/appDataRepairTypes.ts`. Drift in either side
//     fails this test BEFORE any runtime parity divergence shows up.
//   * Repair-recipe surface is NOT shipped in iOS-3A (
//     `AutoRepairOrchestrator`, `processIncomingAppData` and the 9 V1
//     recipes are explicitly deferred to iOS-3B).
//   * IronPathDataHealth/IronPathPersistence Package.swift files
//     declare the local-path dependency on IronPathDomain.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const DATA_HEALTH_SOURCES = 'ios/packages/IronPathDataHealth/Sources/IronPathDataHealth';
const PERSISTENCE_SOURCES = 'ios/packages/IronPathPersistence/Sources/IronPathPersistence';
const DATA_HEALTH_TESTS = 'ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests';
const PERSISTENCE_TESTS = 'ios/packages/IronPathPersistence/Tests/IronPathPersistenceTests';

const expectedSwiftFiles: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  { path: `${DATA_HEALTH_SOURCES}/DataHealthConstants.swift`, reason: '8 constants ported from TS' },
  { path: `${DATA_HEALTH_SOURCES}/DataHealthRuntimeGuard.swift`, reason: '6 pure guard functions + RuntimeGuardClock' },
  { path: `${DATA_HEALTH_SOURCES}/CleanAppDataView.swift`, reason: 'read-only projection struct + diagnostics' },
  { path: `${DATA_HEALTH_SOURCES}/CleanAppDataViewBuilder.swift`, reason: 'buildCleanAppDataView entry point' },
  { path: `${DATA_HEALTH_SOURCES}/RepairTypes.swift`, reason: 'enum + struct skeleton (no apply)' },
  { path: `${DATA_HEALTH_SOURCES}/RepairLedger.swift`, reason: 'read/write/append + idempotency contract' },
  { path: `${PERSISTENCE_SOURCES}/AppDataStore.swift`, reason: 'protocol contract' },
  { path: `${PERSISTENCE_SOURCES}/JSONFileAppDataStore.swift`, reason: 'atomic write + backup-file implementation' },
  { path: `${DATA_HEALTH_TESTS}/DataHealthRuntimeGuardTests.swift`, reason: 'guard function unit tests' },
  { path: `${DATA_HEALTH_TESTS}/CleanAppDataViewRealExportTests.swift`, reason: 'real-export consumption test' },
  { path: `${DATA_HEALTH_TESTS}/RepairLedgerTests.swift`, reason: 'ledger contract tests' },
  { path: `${DATA_HEALTH_TESTS}/RepairTypesTests.swift`, reason: 'enum rawValue + constants tests' },
  { path: `${PERSISTENCE_TESTS}/JSONFileAppDataStoreTests.swift`, reason: 'atomic write / backup / schema guard tests' },
];

describe('iosDataHealthRuntimeFoundation — Swift file surface', () => {
  for (const { path, reason } of expectedSwiftFiles) {
    it(`iosDataHealthRuntimeFoundation ${path} exists (${reason})`, () => {
      expect(existsSync(resolve(repoRoot, path)), `expected Swift file missing: ${path}`).toBe(true);
    });
  }
});

describe('iosDataHealthRuntimeFoundation — TS↔Swift constants parity', () => {
  const tsSource = readFileSync(resolve(repoRoot, 'src/dataHealth/appDataRepairTypes.ts'), 'utf8');
  const swiftSource = readFileSync(resolve(repoRoot, `${DATA_HEALTH_SOURCES}/DataHealthConstants.swift`), 'utf8');

  const extractTsConstant = (name: string): number => {
    const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(\\d+)`);
    const match = tsSource.match(re);
    if (!match) throw new Error(`TS constant ${name} not found in src/dataHealth/appDataRepairTypes.ts`);
    return Number(match[1]);
  };

  const extractSwiftConstant = (name: string): number => {
    const re = new RegExp(`static\\s+let\\s+${name}\\s*:\\s*Int\\s*=\\s*(\\d+)`);
    const match = swiftSource.match(re);
    if (!match) throw new Error(`Swift constant ${name} not found in DataHealthConstants.swift`);
    return Number(match[1]);
  };

  const pairs: ReadonlyArray<{ readonly ts: string; readonly swift: string }> = [
    { ts: 'DATA_HEALTH_TODAY_STATUS_STALE_DAYS', swift: 'todayStatusStaleDays' },
    { ts: 'DATA_HEALTH_HEALTH_DATA_STALE_DAYS', swift: 'healthDataStaleDays' },
    { ts: 'DATA_HEALTH_ISSUE_SCORE_HARD_CAP', swift: 'issueScoreHardCap' },
    { ts: 'DATA_HEALTH_ISSUE_SCORE_SOFT_CAP', swift: 'issueScoreSoftCap' },
    { ts: 'DATA_HEALTH_IMPOSSIBLE_DURATION_MIN', swift: 'impossibleDurationMin' },
    { ts: 'DATA_HEALTH_FALLBACK_DURATION_MIN', swift: 'fallbackDurationMin' },
    { ts: 'DATA_HEALTH_LEDGER_MAX_ENTRIES', swift: 'ledgerMaxEntries' },
    { ts: 'DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS', swift: 'ledgerIdempotentWindowHours' },
  ];

  for (const pair of pairs) {
    it(`iosDataHealthRuntimeFoundation ${pair.ts} === Swift ${pair.swift}`, () => {
      expect(extractSwiftConstant(pair.swift)).toEqual(extractTsConstant(pair.ts));
    });
  }
});

describe('iosDataHealthRuntimeFoundation — iOS-3B surface is deferred (not in iOS-3A)', () => {
  // Walks every Swift file under ios/packages to confirm the
  // iOS-3B-owned symbols haven't accidentally landed in iOS-3A. These
  // checks are NARROWER than iosBootstrapNoBusinessLogic — they target
  // identifiers that iOS-3A's task brief explicitly defers.
  const iosRoot = resolve(repoRoot, 'ios');
  const collectSwift = (dir: string, out: string[] = []): string[] => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.build' || entry.name === 'DerivedData') continue;
        collectSwift(full, out);
      } else if (entry.name.endsWith('.swift')) {
        out.push(full);
      }
    }
    return out;
  };

  const swiftFiles = collectSwift(iosRoot);

  // iOS-3B landed AutoRepairOrchestrator inside IronPathDataHealth, so
  // it is removed from this guard's deferred list. The remaining
  // deferred symbols (processIncomingAppData / TrainingDecision /
  // AppDataRepairLedger orchestrator-style) are still globally
  // forbidden and stay enforced here.
  const deferred: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
    { name: 'processIncomingAppData_func', pattern: /\bfunc\s+processIncomingAppData\b/ },
    { name: 'TrainingDecision_type', pattern: /\b(struct|class|enum)\s+TrainingDecision\b(?!Version)/ },
    { name: 'AppDataRepairLedger_orchestrator_type', pattern: /\b(struct|class)\s+AppDataRepairLedger\b/ },
  ];

  for (const { name, pattern } of deferred) {
    it(`iosDataHealthRuntimeFoundation ${name} is NOT declared yet`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const text = readFileSync(file, 'utf8');
        if (pattern.test(text)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `iOS-3C-deferred symbol ${name} found unexpectedly: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

describe('iosDataHealthRuntimeFoundation — Package.swift declares IronPathDomain dependency', () => {
  it('iosDataHealthRuntimeFoundation IronPathDataHealth/Package.swift depends on IronPathDomain', () => {
    const text = readFileSync(
      resolve(repoRoot, 'ios/packages/IronPathDataHealth/Package.swift'),
      'utf8',
    );
    expect(text).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    expect(text).toMatch(/dependencies:\s*\["IronPathDomain"\]/);
  });

  it('iosDataHealthRuntimeFoundation IronPathPersistence/Package.swift depends on IronPathDomain', () => {
    const text = readFileSync(
      resolve(repoRoot, 'ios/packages/IronPathPersistence/Package.swift'),
      'utf8',
    );
    expect(text).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    expect(text).toMatch(/dependencies:\s*\["IronPathDomain"\]/);
  });

  it('iosDataHealthRuntimeFoundation both packages declare iOS 17 platform (host macOS is implicit for `swift test`)', () => {
    for (const pkg of ['IronPathDataHealth', 'IronPathPersistence']) {
      const text = readFileSync(
        resolve(repoRoot, `ios/packages/${pkg}/Package.swift`),
        'utf8',
      );
      expect(text).toMatch(/platforms\s*:\s*\[\s*\.iOS\(\s*\.v17\s*\)\s*\]/);
    }
  });
});

describe('iosDataHealthRuntimeFoundation — Swift forbids the iOS-3B repair recipes', () => {
  const dataHealthSources = resolve(repoRoot, DATA_HEALTH_SOURCES);

  it('iosDataHealthRuntimeFoundation RepairTypes.swift is type-only (no concrete RepairDefinition struct instance)', () => {
    const text = readFileSync(resolve(dataHealthSources, 'RepairTypes.swift'), 'utf8');
    // The protocol declaration is allowed; concrete `struct
    // SomeRepair: RepairDefinition` is not.
    expect(text).toMatch(/public\s+protocol\s+RepairDefinition\b/);
    const concreteImpl = /:\s*RepairDefinition\b/g;
    const matches = text.match(concreteImpl);
    // The only sanctioned `: RepairDefinition` is inside the protocol
    // header itself, which doesn't match this anchor. Zero matches.
    expect(matches ?? []).toEqual([]);
  });

  it('iosDataHealthRuntimeFoundation RepairLedger.swift is pure-value (no FileManager / URL / IO)', () => {
    const text = readFileSync(resolve(dataHealthSources, 'RepairLedger.swift'), 'utf8');
    expect(text).not.toMatch(/FileManager\b/);
    expect(text).not.toMatch(/URLSession\b/);
  });
});
