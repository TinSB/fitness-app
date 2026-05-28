import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4A TrainingDecision Swift Port Plan + CodeGraph Impact Audit V1 —
// docs-parity lock.
//
// This file is the static guard for the planning-only iOS-4A PR. It does
// NOT execute Swift or call Xcode. It only asserts that:
//   - the iOS-4A plan doc and the iOS-4B implementation task doc exist
//   - the plan carries the load-bearing contracts (CodeGraph impact table,
//     CleanAppDataView consumption, the forbid-raw-AppData rule, the 7
//     userFacing surfaces, hiddenDebugSignals/arbitrationTrace, the
//     training-decision parity fixtures, the Domain/DataHealth-only package
//     dependency, the forbidden Cloud/HealthKit/UI dependencies)
//   - the task doc carries the iOS-4B obligations (Swift tests, TS static
//     guards, no-AppData-mutation rule, Supabase/HealthKit exclusion, full
//     validation command list)
//
// Any future PR that weakens these clauses fails CI here. The 15 numbered
// assertions below map 1:1 to the iOS-4A task brief Phase 5 requirements.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const PLAN_PATH =
  'docs/ios-native-migration/IOS_4A_TRAININGDECISION_SWIFT_PORT_PLAN_CODEGRAPH_V1.md';
const TASK_PATH =
  'docs/ios-native-migration/IOS_4B_TRAININGDECISION_SWIFT_PORT_IMPLEMENTATION_V1_TASK.md';

const repoFile = (p: string) => resolve(repoRoot, p);
const readDoc = (p: string) => readFileSync(repoFile(p), 'utf8');

describe('iosTrainingDecisionSwiftPortPlan — required docs exist', () => {
  // (1) iOS-4A plan doc exists.
  it('iosTrainingDecisionSwiftPortPlan (1) plan doc exists', () => {
    expect(existsSync(repoFile(PLAN_PATH)), `missing ${PLAN_PATH}`).toBe(true);
  });

  // (2) iOS-4B implementation task doc exists.
  it('iosTrainingDecisionSwiftPortPlan (2) implementation task doc exists', () => {
    expect(existsSync(repoFile(TASK_PATH)), `missing ${TASK_PATH}`).toBe(true);
  });
});

describe('iosTrainingDecisionSwiftPortPlan — plan doc load-bearing contracts', () => {
  const plan = readDoc(PLAN_PATH);

  // (3) plan contains a CodeGraph impact table.
  it('iosTrainingDecisionSwiftPortPlan (3) plan contains a CodeGraph impact table', () => {
    expect(plan).toMatch(/CodeGraph impact table/i);
    // The table must carry the documented columns.
    expect(plan).toMatch(/Callers/i);
    expect(plan).toMatch(/Callees\s*\/\s*dependencies/i);
    expect(plan).toMatch(/data fields read/i);
    expect(plan).toMatch(/data fields written/i);
    expect(plan).toMatch(/missing tests/i);
    expect(plan).toMatch(/risk/i);
    // The single-doorway finding from codegraph must be recorded.
    expect(plan).toMatch(/buildTrainingDecisionFromCleanInput/);
  });

  // (4) plan mentions CleanAppDataView.
  it('iosTrainingDecisionSwiftPortPlan (4) plan mentions CleanAppDataView', () => {
    expect(plan).toMatch(/CleanAppDataView/);
    // and the iOS-3C pre-training-decision ingress source.
    expect(plan).toMatch(/preTrainingDecision/);
  });

  // (5) plan forbids raw AppData input to the engine.
  it('iosTrainingDecisionSwiftPortPlan (5) plan forbids raw AppData input', () => {
    expect(plan).toMatch(/raw AppData/i);
    // The branded clean-input contract is the enforcement mechanism.
    expect(plan).toMatch(/CleanTrainingDecisionInput/);
  });

  // (6) plan maps the userFacing surfaces.
  it('iosTrainingDecisionSwiftPortPlan (6) plan maps the 7 userFacing surfaces', () => {
    expect(plan).toMatch(/userFacing output map/i);
    for (const surface of [
      'today',
      'plan',
      'training',
      'focus',
      'progress',
      'record',
      'explanation',
    ]) {
      expect(plan, `surface ${surface} missing from plan`).toMatch(
        new RegExp(`\\b${surface}\\b`),
      );
    }
  });

  // (7) plan maps hiddenDebugSignals / arbitrationTrace.
  it('iosTrainingDecisionSwiftPortPlan (7) plan maps hiddenDebugSignals/arbitrationTrace', () => {
    expect(plan).toMatch(/hiddenDebugSignals/);
    expect(plan).toMatch(/arbitrationTrace/);
    // The AR-1..AR-5 codes must be enumerated.
    expect(plan).toMatch(/AR-1-severe-override/);
    expect(plan).toMatch(/AR-5-progress-clarity-suppressed/);
  });

  // (8) plan references the training-decision parity fixtures.
  it('iosTrainingDecisionSwiftPortPlan (8) plan references training-decision parity fixtures', () => {
    expect(plan).toMatch(/training-decision\/normal-session-v1/);
    expect(plan).toMatch(/parity fixture/i);
  });

  // (9) plan recommends a package depending only on Domain + DataHealth.
  it('iosTrainingDecisionSwiftPortPlan (9) plan package depends only on Domain + DataHealth', () => {
    expect(plan).toMatch(/IronPathTrainingDecision/);
    expect(plan).toMatch(/\.\.\/IronPathDomain/);
    expect(plan).toMatch(/\.\.\/IronPathDataHealth/);
    // The one-way dependency arrow must be stated.
    expect(plan).toMatch(
      /IronPathTrainingDecision\s*(?:→|->)\s*IronPathDataHealth\s*(?:→|->)\s*IronPathDomain/,
    );
  });

  // (10) plan forbids Cloud / HealthKit / UI dependencies.
  it('iosTrainingDecisionSwiftPortPlan (10) plan forbids Cloud/HealthKit/UI deps', () => {
    expect(plan).toMatch(/IronPathUIKit/);
    expect(plan).toMatch(/IronPathCloudSync/);
    expect(plan).toMatch(/IronPathHealthKit/);
    // Stated as forbidden, not merely mentioned.
    expect(plan).toMatch(/Forbidden dependencies/i);
  });
});

describe('iosTrainingDecisionSwiftPortPlan — task doc iOS-4B obligations', () => {
  const task = readDoc(TASK_PATH);

  // (11) task doc includes the Swift tests.
  it('iosTrainingDecisionSwiftPortPlan (11) task doc includes Swift tests', () => {
    for (const cls of [
      'TrainingDecisionParityNormalSessionTests',
      'TrainingDecisionUserFacingShapeTests',
      'TrainingDecisionCleanInputContractTests',
      'TrainingDecisionArbitrationTraceTests',
      'TrainingDecisionEngineShapeTests',
      'TrainingDecisionRealExportParityTests',
    ]) {
      expect(task, `missing test class ${cls}`).toMatch(new RegExp(cls));
    }
  });

  // (12) task doc includes the TS static guards.
  it('iosTrainingDecisionSwiftPortPlan (12) task doc includes TS static guards', () => {
    expect(task).toMatch(/iosTrainingDecisionSwiftEngineStaticGuards\.test\.ts/);
    // forbidden import + Package.swift dep lock categories present.
    expect(task).toMatch(/forbidden imports/i);
    expect(task).toMatch(/iosBootstrapPackageGraph\.test\.ts/);
  });

  // (13) task doc forbids AppData mutation.
  it('iosTrainingDecisionSwiftPortPlan (13) task doc forbids AppData mutation', () => {
    expect(task).toMatch(/no AppData mutation/i);
    expect(task).toMatch(/\.appData\.history\s*=/);
  });

  // (14) task doc keeps Supabase / HealthKit out.
  it('iosTrainingDecisionSwiftPortPlan (14) task doc keeps Supabase/HealthKit out', () => {
    expect(task).toMatch(/Supabase/);
    expect(task).toMatch(/HealthKit/);
    // and SwiftData / CoreData / @Model exclusions.
    expect(task).toMatch(/SwiftData/);
    expect(task).toMatch(/CoreData/);
    expect(task).toMatch(/@Model/);
  });

  // (15) task doc includes the full validation command list.
  it('iosTrainingDecisionSwiftPortPlan (15) task doc includes full validation commands', () => {
    expect(task).toMatch(/node scripts\/generate-parity-goldens\.mjs --check/);
    expect(task).toMatch(/npm run typecheck/);
    expect(task).toMatch(/npm test/);
    expect(task).toMatch(/npm run build/);
    expect(task).toMatch(/node scripts\/scan-production-dist-safety\.mjs/);
    expect(task).toMatch(/test ! -e pnpm-lock\.yaml/);
    expect(task).toMatch(/git diff --check/);
    expect(task).toMatch(
      /swift test --package-path ios\/packages\/IronPathTrainingDecision/,
    );
    expect(task).toMatch(
      /xcodebuild[\s\S]*generic\/platform=iOS Simulator/,
    );
    expect(task).toMatch(/iPhone 17 Pro/);
  });
});

describe('iosTrainingDecisionSwiftPortPlan — TrainingDecision package surface discipline', () => {
  // The iOS-4A planning PR did not create the package. iOS-4B1 lands the
  // TYPE SKELETON package only — never an engine. This guard is forward-safe:
  // when the package is absent (iOS-4A state) it passes vacuously; once present
  // (iOS-4B1+) it asserts the package carries NO DEFERRED decision-engine
  // implementation. iOS-4B2 evolution: the effectivePhase + sessionIntent core
  // slice (getEffectiveTrainingPhase + buildTrainingDecisionFromCleanInput) now
  // lives here legitimately, so only the still-deferred engines are forbidden.
  // The detailed lock lives in tests/iosTrainingDecisionSwiftEngineStaticGuards.test.ts.
  it('iosTrainingDecisionSwiftPortPlan IronPathTrainingDecision package, if present, has no deferred engine', () => {
    const sourcesDir = repoFile('ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision');
    if (!existsSync(sourcesDir)) return; // iOS-4A planning state — package not yet created.
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const swift = readdirSync(sourcesDir).filter((f: string) => f.endsWith('.swift'));
    const combined = swift
      .map((f: string) => readFileSync(resolve(sourcesDir, f), 'utf8'))
      .join('\n');
    // No BARE engine entry (only the branded FromCleanInput wrapper is allowed)
    // and none of the STILL-DEFERRED engines (prescription / support plan).
    // getEffectiveTrainingPhase (4B2) + buildTodayReadiness (4B3) are intentionally
    // NOT forbidden — they are the ported slices.
    expect(combined).not.toMatch(/func\s+buildTrainingDecision\b/);
    expect(combined).not.toMatch(/func\s+applyStatusRules\b/);
    expect(combined).not.toMatch(/func\s+build\w*Support\w*Plan\b/);
  });

  // The task doc must record the deferred real-export decision so the rationale
  // survives into future audits.
  it('iosTrainingDecisionSwiftPortPlan plan records the real-export no-byte-compare decision', () => {
    const plan = readDoc(PLAN_PATH);
    expect(plan).toMatch(/real-export/i);
    expect(plan).toMatch(/NO TS golden byte-compare|does NOT byte-compare/i);
  });
});
