import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1 — static guards.
//
// Locks the Swift surface area of iOS-3B:
//   * 7+ expected Swift files exist at their canonical paths.
//   * 5 safe repair IDs appear as Swift `repairId` string literals.
//   * 4 deferred (iOS-3C) repair IDs do NOT appear.
//   * No `processIncomingAppData` Swift implementation.
//   * No cloud / Supabase / HealthKit / TrainingDecision / Focus Mode
//     business logic landed in IronPathDataHealth.
//   * No SwiftData / CoreData / `@Model` / `@Observable`.
//   * No remote SwiftPM dep (the sanctioned local-path dep
//     `../IronPathDomain` already exists from iOS-3A).
//   * Real-export repair tests + idempotency tests + dryRun-no-mutation
//     tests exist (string-grep level — runtime checks live in Swift).
//   * iOS-3A foundation files + iOS-2C real-export parity fixtures
//     are still present.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const DATA_HEALTH_SOURCES = 'ios/packages/IronPathDataHealth/Sources/IronPathDataHealth';
const DATA_HEALTH_TESTS = 'ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests';

const expectedSources: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  { path: `${DATA_HEALTH_SOURCES}/RepairRegistry.swift`, reason: 'registry contract + safeRepairRegistry factory' },
  { path: `${DATA_HEALTH_SOURCES}/RepairEngine.swift`, reason: 'runRepair + appendDataRepairLog (FIFO cap 500)' },
  { path: `${DATA_HEALTH_SOURCES}/AutoRepairOrchestrator.swift`, reason: 'runAutoRepairOrchestrator entry point' },
  { path: `${DATA_HEALTH_SOURCES}/AutoRepairBackupAdapter.swift`, reason: 'backup adapter protocol + in-memory default' },
  { path: `${DATA_HEALTH_SOURCES}/RepairHelpers.swift`, reason: 'hashIdempotencyKey + computeAppDataHash + buildReceipt' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/SessionLifecycleResidueRepair.swift`, reason: 'safe_auto: session lifecycle' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/ImpossibleDurationRepair.swift`, reason: 'safe_auto: duration sanity' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/StaleTodayStatusRepair.swift`, reason: 'safe_auto: readiness freshness' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/StaleHealthReadinessRepair.swift`, reason: 'safe_auto: health staleness' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/LegacyFinalAdviceIsolationRepair.swift`, reason: 'runtime_guard: audit-only legacy advice' },
];

const expectedTests: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  { path: `${DATA_HEALTH_TESTS}/RepairRegistryTests.swift`, reason: 'registry construction + duplicate + deferred-id exclusion' },
  { path: `${DATA_HEALTH_TESTS}/SafeRepairRecipeTests.swift`, reason: '5 recipe-level units (synthetic fixtures)' },
  { path: `${DATA_HEALTH_TESTS}/AutoRepairOrchestratorRealExportTests.swift`, reason: 'orchestrator real-export integration + idempotency + backup_failed' },
  { path: `${DATA_HEALTH_TESTS}/RepairReceiptTests.swift`, reason: 'receipt shape + dataRepairLogs FIFO cap + runRepair append' },
];

describe('iosAutoRepairOrchestrator — Swift file surface', () => {
  for (const { path, reason } of [...expectedSources, ...expectedTests]) {
    it(`iosAutoRepairOrchestrator ${path} exists (${reason})`, () => {
      expect(existsSync(resolve(repoRoot, path)), `expected Swift file missing: ${path}`).toBe(true);
    });
  }
});

describe('iosAutoRepairOrchestrator — 5 safe repair IDs present', () => {
  const safeIds = [
    'sessionLifecycleResidueV1',
    'impossibleDurationV1',
    'staleTodayStatusV1',
    'staleHealthReadinessGuardV1',
    'legacyFinalAdviceIsolationGuardV1',
  ];
  for (const id of safeIds) {
    it(`iosAutoRepairOrchestrator ${id} is declared as a Swift repairId`, () => {
      const file = expectedSources.find(({ path }) => path.includes(idToFileName(id)));
      expect(file, `no Swift file expected for ${id}`).toBeTruthy();
      const text = readFileSync(resolve(repoRoot, file!.path), 'utf8');
      expect(text).toMatch(new RegExp(`repairId\\s*:\\s*String\\s*=\\s*"${id}"`));
    });
  }
});

describe('iosAutoRepairOrchestrator — deferred recipes are NOT implemented', () => {
  const deferredIds = [
    'screeningIssueScoreRepairV1',
    'screeningIssueScoreRuntimeGuardV1',
    'setIndexRenumberV1',
    'replacementEquivalenceAuditV1',
  ];
  const swiftFiles = collectSwift(resolve(repoRoot, 'ios'));
  for (const id of deferredIds) {
    it(`iosAutoRepairOrchestrator ${id} does NOT appear in any Swift source`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const text = readFileSync(file, 'utf8');
        // Look for `repairId: String = "<id>"` — recipe declaration.
        if (new RegExp(`repairId\\s*:\\s*String\\s*=\\s*"${id}"`).test(text)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `${id} unexpectedly declared in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

describe('iosAutoRepairOrchestrator — ingress pipeline + forbidden imports stay deferred', () => {
  const swiftFiles = collectSwift(resolve(repoRoot, 'ios/packages/IronPathDataHealth/Sources'));

  const forbidden: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
    { name: 'processIncomingAppData_func', pattern: /\bfunc\s+processIncomingAppData\b/ },
    { name: 'Supabase_import', pattern: /\bimport\s+Supabase\b/ },
    { name: 'SupabaseClient_type', pattern: /\b(struct|class|enum)\s+SupabaseClient\b/ },
    { name: 'HealthKit_import', pattern: /\bimport\s+HealthKit\b/ },
    { name: 'HKSampleQuery_type', pattern: /\bHKSampleQuery\b/ },
    { name: 'TrainingDecision_type', pattern: /\b(struct|class|enum)\s+TrainingDecision\b(?!Version)/ },
    { name: 'buildTrainingDecision_func', pattern: /\bfunc\s+buildTrainingDecision\b/ },
    { name: 'FocusStepQueue_func', pattern: /\bfunc\s+buildFocusStepQueue\b/ },
    { name: 'SwiftData_import', pattern: /\bimport\s+SwiftData\b/ },
    { name: 'CoreData_import', pattern: /\bimport\s+CoreData\b/ },
    { name: 'Model_macro', pattern: /@Model\b/ },
    { name: 'Observable_macro', pattern: /@Observable\b/ },
  ];

  for (const { name, pattern } of forbidden) {
    it(`iosAutoRepairOrchestrator IronPathDataHealth does not declare ${name}`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const text = readFileSync(file, 'utf8');
        if (pattern.test(text)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `${name} found in iOS-3B Swift code: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

describe('iosAutoRepairOrchestrator — Package.swift surface unchanged from iOS-3A', () => {
  it('iosAutoRepairOrchestrator IronPathDataHealth Package.swift still depends only on IronPathDomain', () => {
    const text = readFileSync(
      resolve(repoRoot, 'ios/packages/IronPathDataHealth/Package.swift'),
      'utf8',
    );
    expect(text).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    expect(text).not.toMatch(/\.package\(\s*url:/);  // no remote deps
  });
});

describe('iosAutoRepairOrchestrator — required Swift test types are present', () => {
  it('iosAutoRepairOrchestrator real-export orchestrator test exists', () => {
    const text = readFileSync(
      resolve(repoRoot, `${DATA_HEALTH_TESTS}/AutoRepairOrchestratorRealExportTests.swift`),
      'utf8',
    );
    expect(text).toContain('#filePath');
    expect(text).toContain('tests/fixtures/data-health/ironpath-2026-05-27-redacted.json');
    expect(text).toContain('testRealExportRunsWithoutThrowing');
    expect(text).toContain('testOrchestratorIsIdempotentOnSecondRun');
    expect(text).toContain('testBackupFailedFlowDoesNotMutateAppData');
    expect(text).toContain('testRealExportDetectsImpossibleDuration');
  });

  it('iosAutoRepairOrchestrator dryRun no-mutation assertion exists', () => {
    const text = readFileSync(
      resolve(repoRoot, `${DATA_HEALTH_TESTS}/SafeRepairRecipeTests.swift`),
      'utf8',
    );
    // canonicalJSONData() compare before/after is the no-mutation signature.
    expect(text).toContain('canonicalJSONData');
    expect(text).toContain('XCTAssertEqual(canonicalBefore, canonicalAfter)');
  });

  it('iosAutoRepairOrchestrator legacy-advice audit-only test exists', () => {
    const text = readFileSync(
      resolve(repoRoot, `${DATA_HEALTH_TESTS}/SafeRepairRecipeTests.swift`),
      'utf8',
    );
    expect(text).toContain('testLegacyAdviceAuditOnlyDoesNotMutate');
  });

  it('iosAutoRepairOrchestrator impossible-duration 70-hour guard test exists', () => {
    const text = readFileSync(
      resolve(repoRoot, `${DATA_HEALTH_TESTS}/SafeRepairRecipeTests.swift`),
      'utf8',
    );
    expect(text).toContain('testImpossibleDurationNeverUses70HourSpan');
  });
});

describe('iosAutoRepairOrchestrator — iOS-3A foundation + iOS-2C real-export still present', () => {
  it('iOS-3A foundation files still exist (no regression)', () => {
    const ios3aFiles = [
      `${DATA_HEALTH_SOURCES}/DataHealthRuntimeGuard.swift`,
      `${DATA_HEALTH_SOURCES}/CleanAppDataView.swift`,
      `${DATA_HEALTH_SOURCES}/CleanAppDataViewBuilder.swift`,
      `${DATA_HEALTH_SOURCES}/RepairTypes.swift`,
      `${DATA_HEALTH_SOURCES}/RepairLedger.swift`,
      `${DATA_HEALTH_SOURCES}/DataHealthConstants.swift`,
    ];
    for (const file of ios3aFiles) {
      expect(existsSync(resolve(repoRoot, file)), `iOS-3A regression: ${file} missing`).toBe(true);
    }
  });

  it('iOS-2C real-export parity test still present', () => {
    expect(existsSync(resolve(
      repoRoot,
      'ios/packages/IronPathDomain/Tests/IronPathDomainTests/AppDataRealExportParityTests.swift',
    ))).toBe(true);
  });

  it('iOS-2C redacted real export fixture still at canonical path', () => {
    expect(existsSync(resolve(repoRoot, 'tests/fixtures/data-health/ironpath-2026-05-27-redacted.json'))).toBe(true);
  });
});

// MARK: - Helpers

function collectSwift(dir: string, out: string[] = []): string[] {
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
}

function idToFileName(repairId: string): string {
  // Maps "sessionLifecycleResidueV1" → "SessionLifecycleResidueRepair.swift"
  const dropV1 = repairId.replace(/V1$/, '');
  const camel = dropV1.charAt(0).toUpperCase() + dropV1.slice(1);
  // Custom name mapping for files where the Swift type name differs.
  const overrides: Record<string, string> = {
    SessionLifecycleResidue: 'SessionLifecycleResidueRepair',
    ImpossibleDuration: 'ImpossibleDurationRepair',
    StaleTodayStatus: 'StaleTodayStatusRepair',
    StaleHealthReadinessGuard: 'StaleHealthReadinessRepair',
    LegacyFinalAdviceIsolationGuard: 'LegacyFinalAdviceIsolationRepair',
  };
  return `${overrides[camel] ?? `${camel}Repair`}.swift`;
}
