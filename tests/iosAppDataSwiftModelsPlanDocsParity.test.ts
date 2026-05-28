import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-2A AppData Swift Models Plan V1 — docs-parity lock.
//
// This file is the static guard for the planning-only iOS-2A PR. It does
// NOT execute Swift or call Xcode. It only asserts that:
//   - the iOS-2A plan doc and the iOS-2B implementation task spec exist
//   - the plan carries the load-bearing contracts (schemaVersion 8,
//     JSONValue + open-bag, String timestamps, no SwiftData/CoreData,
//     no @Model/@Observable, parity-fixture references, xcodebuild
//     validation, no Supabase/HealthKit in iOS-2)
//   - the task spec includes the 17-model + 5-test file lists and the 3
//     TS static-guard test names that iOS-2B will land
//
// Any future PR that weakens these clauses fails CI here.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const PLAN_PATH =
  'docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md';
const TASK_SPEC_PATH =
  'docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md';

const AGENT_REPORTS = [
  'docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md',
  'docs/ios-native-migration/agents-ios-2a/AGENT_2_JSONVALUE_CODABLE.md',
  'docs/ios-native-migration/agents-ios-2a/AGENT_3_PARITY_FIXTURE.md',
  'docs/ios-native-migration/agents-ios-2a/AGENT_4_XCODE_PACKAGE_LAYOUT.md',
  'docs/ios-native-migration/agents-ios-2a/AGENT_5_DATA_SAFETY.md',
] as const;

const repoFile = (p: string) => resolve(repoRoot, p);
const readSource = (p: string) => readFileSync(repoFile(p), 'utf8');

describe('iosAppDataSwiftModelsPlan — required docs exist', () => {
  it('iosAppDataSwiftModelsPlan plan doc exists', () => {
    expect(existsSync(repoFile(PLAN_PATH))).toBe(true);
  });

  it('iosAppDataSwiftModelsPlan implementation task spec exists', () => {
    expect(existsSync(repoFile(TASK_SPEC_PATH))).toBe(true);
  });

  it('iosAppDataSwiftModelsPlan all 5 agent reports exist', () => {
    for (const p of AGENT_REPORTS) {
      expect(existsSync(repoFile(p)), `missing ${p}`).toBe(true);
    }
  });
});

describe('iosAppDataSwiftModelsPlan — plan doc must carry the load-bearing contracts', () => {
  it('iosAppDataSwiftModelsPlan plan mentions AppData schemaVersion 8', () => {
    const doc = readSource(PLAN_PATH);
    // The schemaVersion contract is pinned to 8; the Swift refusal
    // policy is symmetric around that value.
    expect(doc).toMatch(/schemaVersion[\s\S]{0,30}8/);
    expect(doc).toMatch(/STORAGE_VERSION\s*=\s*8/);
  });

  it('iosAppDataSwiftModelsPlan plan requires the JSONValue type', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc).toContain('JSONValue');
    // OrderedJSONObject is the open-bag carrier; mentioning it proves
    // the plan goes beyond just naming JSONValue.
    expect(doc).toContain('OrderedJSONObject');
  });

  it('iosAppDataSwiftModelsPlan plan requires unknown / open-bag preservation', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc.toLowerCase()).toMatch(/open\s?-?\s?bag/);
    expect(doc).toMatch(/_unknown/);
    expect(doc).toMatch(/additionalProperties:\s*true/);
  });

  it('iosAppDataSwiftModelsPlan plan requires timestamps as String, never Date', () => {
    const doc = readSource(PLAN_PATH);
    // The §8 title makes this explicit.
    expect(doc).toMatch(/Timestamp[\s\S]{0,80}String[\s\S]{0,80}never Date/i);
    // Reaffirmed in the MUST-NOT list (Agent 5).
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}Date[\s\S]{0,200}persisted timestamp/i);
  });

  it('iosAppDataSwiftModelsPlan plan forbids SwiftData / Core Data', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,80}SwiftData/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,80}Core Data/);
  });

  it('iosAppDataSwiftModelsPlan plan forbids @Model / @Observable on model types', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,80}@Model/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,160}@Observable[\s\S]{0,160}value types/i);
  });

  it('iosAppDataSwiftModelsPlan plan references tests/fixtures/parity/', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc).toContain('tests/fixtures/parity/');
    // The two fixture ids iOS-2 consumes must be named.
    expect(doc).toContain('snapshot-hash-stable-v1');
    expect(doc).toContain('redacted-2026-05-27');
  });

  it('iosAppDataSwiftModelsPlan plan requires xcodebuild validation', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc).toContain('xcodebuild');
    expect(doc).toContain('generic/platform=iOS Simulator');
    expect(doc).toContain('iPhone 17 Pro');
  });

  it('iosAppDataSwiftModelsPlan plan says no Supabase / no HealthKit in iOS-2', () => {
    const doc = readSource(PLAN_PATH);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}Supabase/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}HealthKit/);
  });
});

describe('iosAppDataSwiftModelsPlan — implementation task spec must include the model + test file lists', () => {
  it('iosAppDataSwiftModelsPlan task spec lists all 17 Swift model files', () => {
    const doc = readSource(TASK_SPEC_PATH);
    const modelFiles = [
      'JSONValue.swift',
      'SchemaVersion.swift',
      'WeightUnit.swift',
      'AppData.swift',
      'AppSettings.swift',
      'UserProfile.swift',
      'TrainingSession.swift',
      'TrainingSetLog.swift',
      'ActualSetDraft.swift',
      'ExercisePrescription.swift',
      'MesocyclePlan.swift',
      'ScreeningProfile.swift',
      'ProgramTemplate.swift',
      'HealthMetricSample.swift',
      'UnitSettings.swift',
      'TodayStatus.swift',
      'AdaptiveCalibrationState.swift',
    ];
    for (const f of modelFiles) {
      expect(doc, `task spec missing model file ${f}`).toContain(f);
    }
  });

  it('iosAppDataSwiftModelsPlan task spec lists all 5 Swift parity test files', () => {
    const doc = readSource(TASK_SPEC_PATH);
    for (const f of [
      'AppDataCodableRoundTripTests.swift',
      'AppDataSchemaVersionGuardTests.swift',
      'AppDataOpenBagPreservationTests.swift',
      'AppDataIsoTimestampStaticGuardTests.swift',
      'AppDataUnitFieldPreservationTests.swift',
    ]) {
      expect(doc, `task spec missing test file ${f}`).toContain(f);
    }
  });

  it('iosAppDataSwiftModelsPlan task spec lists the 3 TS static-guard tests iOS-2B will add', () => {
    const doc = readSource(TASK_SPEC_PATH);
    for (const f of [
      'iosAppDataSwiftModelStaticGuards.test.ts',
      'iosAppDataNoSwiftDataCoreDataGuards.test.ts',
      'iosAppDataFixtureParityDocsGuard.test.ts',
    ]) {
      expect(doc, `task spec missing TS test file ${f}`).toContain(f);
    }
  });

  it('iosAppDataSwiftModelsPlan task spec pins the iOS-2B branch + worktree name', () => {
    const doc = readSource(TASK_SPEC_PATH);
    expect(doc).toContain('claude/ios-2b-appdata-swift-models-v1');
    expect(doc).toContain('~/Developer/ironpath-ios-2b');
  });

  it('iosAppDataSwiftModelsPlan task spec carries the 13 MUST-NOT rules verbatim', () => {
    const doc = readSource(TASK_SPEC_PATH);
    // Each rule is enumerated; we sample a handful to lock the list.
    expect(doc).toMatch(/MUST NOT[\s\S]{0,80}SwiftData/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,80}Core Data/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,80}@Model/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}Date[\s\S]{0,80}persisted timestamp/i);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}schemaVersion/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}package\.json/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}third-party SwiftPM/i);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}Supabase/);
    expect(doc).toMatch(/MUST NOT[\s\S]{0,200}HealthKit/);
  });

  it('iosAppDataSwiftModelsPlan task spec forbids auto-merge and --admin', () => {
    const doc = readSource(TASK_SPEC_PATH);
    expect(doc).toMatch(/auto-merge[\s\S]{0,40}forbidden/i);
    expect(doc).toMatch(/--admin[\s\S]{0,40}forbidden/i);
  });
});

describe('iosAppDataSwiftModelsPlan — this PR is planning-only, no Swift models land', () => {
  it('iosAppDataSwiftModelsPlan no AppData / TrainingSession / TrainingSetLog .swift file exists under ios/', () => {
    // The plan PR adds NO new Swift sources to the IronPathDomain
    // package. Only the iOS-1 placeholder is present.
    for (const f of [
      'ios/packages/IronPathDomain/Sources/IronPathDomain/AppData.swift',
      'ios/packages/IronPathDomain/Sources/IronPathDomain/TrainingSession.swift',
      'ios/packages/IronPathDomain/Sources/IronPathDomain/TrainingSetLog.swift',
      'ios/packages/IronPathDomain/Sources/IronPathDomain/JSONValue.swift',
    ]) {
      expect(existsSync(repoFile(f)), `${f} should not exist in iOS-2A`).toBe(false);
    }
  });

  it('iosAppDataSwiftModelsPlan no Fixtures/ resource bundle is created under IronPathDomain tests', () => {
    expect(
      existsSync(
        repoFile(
          'ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures',
        ),
      ),
    ).toBe(false);
  });

  it('iosAppDataSwiftModelsPlan iOS-1 placeholder source survives unchanged', () => {
    const src = readSource(
      'ios/packages/IronPathDomain/Sources/IronPathDomain/IronPathDomain.swift',
    );
    expect(src).toContain('IronPathDomainVersion');
    expect(src).toContain('"0.0.1-bootstrap"');
  });
});

describe('iosAppDataSwiftModelsPlan — agent reports must each carry a Mission section', () => {
  for (const path of AGENT_REPORTS) {
    it(`iosAppDataSwiftModelsPlan ${path} has a Mission section`, () => {
      const doc = readSource(path);
      expect(doc).toMatch(/^##\s*1\.\s*Mission/m);
    });
  }
});
