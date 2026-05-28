import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-3C Remaining Repair Recipes + Ingress Pipeline V1 — static guards.
//
// Locks the iOS-3C Swift surface:
//   * 4 remaining repair files exist + their repair IDs are declared.
//   * AppDataIngressPipeline.swift exists with the 13-source enum.
//   * JSONFileAutoRepairBackupAdapter.swift exists.
//   * Forbidden imports stay banned (cloud / Supabase / HealthKit /
//     TrainingDecision / SwiftData / CoreData / `@Model` /
//     `@Observable`).
//   * Package.swift surface unchanged from iOS-3B.
//   * iOS-3B safety-test files still present.
//   * Real-export pipeline test exists.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const DATA_HEALTH_SOURCES = 'ios/packages/IronPathDataHealth/Sources/IronPathDataHealth';
const DATA_HEALTH_TESTS = 'ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests';

const expectedSources: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  { path: `${DATA_HEALTH_SOURCES}/repairs/ScreeningIssueScoreRuntimeGuardRepair.swift`, reason: 'runtime_guard: issueScores cap' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/ScreeningIssueScoreRepair.swift`, reason: 'safe_auto: predicate-gated issueScores write-back' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/SetIndexRenumberRepair.swift`, reason: 'safe_auto: per-exercise setIndex renumber' },
  { path: `${DATA_HEALTH_SOURCES}/repairs/ReplacementEquivalenceAuditRepair.swift`, reason: 'audit_only: chain identity mismatch' },
  { path: `${DATA_HEALTH_SOURCES}/AppDataIngressPipeline.swift`, reason: 'processIncomingAppData + 13-source enum' },
  { path: `${DATA_HEALTH_SOURCES}/JSONFileAutoRepairBackupAdapter.swift`, reason: 'file-backed backup adapter (no Persistence dep)' },
];

const expectedTests: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  { path: `${DATA_HEALTH_TESTS}/ScreeningIssueScoreRepairsTests.swift`, reason: 'covers both screening recipes incl. predicate gate' },
  { path: `${DATA_HEALTH_TESTS}/SetIndexRenumberRepairTests.swift`, reason: 'per-exercise scope + ID preserve + idempotency' },
  { path: `${DATA_HEALTH_TESTS}/ReplacementEquivalenceAuditRepairTests.swift`, reason: 'audit-only no mutation' },
  { path: `${DATA_HEALTH_TESTS}/AppDataIngressPipelineTests.swift`, reason: 'per-source defaults + forbidden source + backup failure' },
  { path: `${DATA_HEALTH_TESTS}/AppDataIngressPipelineRealExportTests.swift`, reason: 'real-export integration + idempotent second run' },
  { path: `${DATA_HEALTH_TESTS}/JSONFileAutoRepairBackupAdapterTests.swift`, reason: 'write/list/failure-blocks-mutation' },
  { path: `${DATA_HEALTH_TESTS}/FullRepairRegistryTests.swift`, reason: '9-recipe registry + safe registry preserved' },
];

describe('iosRemainingRepairRecipesIngressPipeline — Swift surface', () => {
  for (const { path, reason } of [...expectedSources, ...expectedTests]) {
    it(`iosRemainingRepairRecipesIngressPipeline ${path} exists (${reason})`, () => {
      expect(existsSync(resolve(repoRoot, path)),
        `expected Swift file missing: ${path}`).toBe(true);
    });
  }
});

describe('iosRemainingRepairRecipesIngressPipeline — 4 repair IDs declared', () => {
  const ios3cIds = [
    { id: 'screeningIssueScoreRuntimeGuardV1', file: 'ScreeningIssueScoreRuntimeGuardRepair.swift' },
    { id: 'screeningIssueScoreRepairV1', file: 'ScreeningIssueScoreRepair.swift' },
    { id: 'setIndexRenumberV1', file: 'SetIndexRenumberRepair.swift' },
    { id: 'replacementEquivalenceAuditV1', file: 'ReplacementEquivalenceAuditRepair.swift' },
  ];
  for (const { id, file } of ios3cIds) {
    it(`iosRemainingRepairRecipesIngressPipeline ${id} declared in ${file}`, () => {
      const text = readFileSync(resolve(repoRoot, `${DATA_HEALTH_SOURCES}/repairs/${file}`), 'utf8');
      expect(text).toMatch(new RegExp(`repairId\\s*:\\s*String\\s*=\\s*"${id}"`));
    });
  }
});

describe('iosRemainingRepairRecipesIngressPipeline — ingress source enum + pipeline shape', () => {
  const pipelineText = readFileSync(
    resolve(repoRoot, `${DATA_HEALTH_SOURCES}/AppDataIngressPipeline.swift`),
    'utf8',
  );

  it('iosRemainingRepairRecipesIngressPipeline AppDataIngressSource enum exists', () => {
    expect(pipelineText).toMatch(/public\s+enum\s+AppDataIngressSource\s*:\s*String/);
  });

  const expectedRawValues = [
    'boot',
    'localStorage-load',
    'import-restore',
    'backup-restore',
    'cloud-restore',
    'cloud-pull',
    'read-mirror',
    'cloud-parity',
    'account-switch',
    'post-session-complete',
    'pre-training-decision',
    'pre-cloud-upload',
    'export',
  ];
  for (const rv of expectedRawValues) {
    it(`iosRemainingRepairRecipesIngressPipeline source raw value "${rv}" present`, () => {
      // boot + export do not have an explicit "= 'value'" — they use
      // the case name. Match either declaration form.
      const escaped = rv.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const pattern = new RegExp(`case\\s+\\w+(\\s*=\\s*"${escaped}")?`);
      const lineMatch = new RegExp(`= "${escaped}"|case\\s+${escaped}\\b`);
      expect(pipelineText).toMatch(lineMatch.test(pipelineText) ? lineMatch : pattern);
    });
  }

  it('iosRemainingRepairRecipesIngressPipeline processIncomingAppData function declared', () => {
    expect(pipelineText).toMatch(/public\s+func\s+processIncomingAppData\s*\(/);
  });

  it('iosRemainingRepairRecipesIngressPipeline forbidden-auto-repair guard exists', () => {
    expect(pipelineText).toMatch(/forbiddenAutoRepairWithoutMutation/);
    expect(pipelineText).toMatch(/AppDataIngressError\.forbiddenAutoRepair/);
  });

  it('iosRemainingRepairRecipesIngressPipeline does NOT port cloud-upload-eligibility', () => {
    // Per design doc §5, iOS-3C deliberately omits this surface.
    expect(pipelineText).not.toMatch(/evaluateCloudUploadEligibility/);
    expect(pipelineText).not.toMatch(/uploadEligibility\s*:/);
  });
});

describe('iosRemainingRepairRecipesIngressPipeline — JSON-file backup adapter shape', () => {
  const adapterText = readFileSync(
    resolve(repoRoot, `${DATA_HEALTH_SOURCES}/JSONFileAutoRepairBackupAdapter.swift`),
    'utf8',
  );

  it('iosRemainingRepairRecipesIngressPipeline JSONFileAutoRepairBackupAdapter conforms to protocol', () => {
    expect(adapterText).toMatch(/struct\s+JSONFileAutoRepairBackupAdapter\s*:\s*AutoRepairBackupAdapter/);
  });

  it('iosRemainingRepairRecipesIngressPipeline backup uses atomic write', () => {
    expect(adapterText).toMatch(/options:\s*\[\s*\.atomic\s*\]/);
  });

  it('iosRemainingRepairRecipesIngressPipeline backup adapter does NOT depend on IronPathPersistence', () => {
    expect(adapterText).not.toMatch(/import\s+IronPathPersistence/);
  });
});

describe('iosRemainingRepairRecipesIngressPipeline — forbidden imports in IronPathDataHealth', () => {
  const swiftFiles = collectSwift(resolve(repoRoot, `${DATA_HEALTH_SOURCES}`));

  const forbidden: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
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
    { name: 'cloud_upload_eligibility', pattern: /\bevaluateCloudUploadEligibility\b/ },
  ];

  for (const { name, pattern } of forbidden) {
    it(`iosRemainingRepairRecipesIngressPipeline IronPathDataHealth does not declare ${name}`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const text = readFileSync(file, 'utf8');
        if (pattern.test(text)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `${name} found in iOS-3C Swift: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

describe('iosRemainingRepairRecipesIngressPipeline — iOS-3B safety tests still present', () => {
  const required: ReadonlyArray<{ readonly path: string; readonly substring: string }> = [
    {
      path: `${DATA_HEALTH_TESTS}/SafeRepairRecipeTests.swift`,
      substring: 'testSessionLifecycleApplyPreservesFocusActualSetDrafts',
    },
    {
      path: `${DATA_HEALTH_TESTS}/SafeRepairRecipeTests.swift`,
      substring: 'testSessionLifecycleApplyPreservesFocusWarmupSetLogsAndExerciseSetsHistory',
    },
    {
      path: `${DATA_HEALTH_TESTS}/AutoRepairOrchestratorRealExportTests.swift`,
      substring: 'testBackupFailedFlowDoesNotMutateAppData',
    },
    {
      path: `${DATA_HEALTH_TESTS}/AutoRepairOrchestratorRealExportTests.swift`,
      substring: 'testBackupFailedDoesNotAppendLedgerEntries',
    },
    {
      path: `${DATA_HEALTH_TESTS}/AutoRepairOrchestratorRealExportTests.swift`,
      substring: 'testBackupFailedDoesNotWriteAutoRepairSummary',
    },
  ];
  for (const { path, substring } of required) {
    it(`iosRemainingRepairRecipesIngressPipeline iOS-3B safety test "${substring}" still present in ${path}`, () => {
      const text = readFileSync(resolve(repoRoot, path), 'utf8');
      expect(text).toContain(substring);
    });
  }
});

describe('iosRemainingRepairRecipesIngressPipeline — Package.swift surface unchanged', () => {
  it('iosRemainingRepairRecipesIngressPipeline IronPathDataHealth Package.swift still local-only', () => {
    const text = readFileSync(
      resolve(repoRoot, 'ios/packages/IronPathDataHealth/Package.swift'),
      'utf8',
    );
    expect(text).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    expect(text).not.toMatch(/\.package\(\s*url:/);
  });

  it('iosRemainingRepairRecipesIngressPipeline IronPathPersistence Package.swift unchanged', () => {
    const text = readFileSync(
      resolve(repoRoot, 'ios/packages/IronPathPersistence/Package.swift'),
      'utf8',
    );
    expect(text).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    expect(text).not.toMatch(/\.package\(\s*url:/);
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
