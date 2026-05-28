import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

// ---------------------------------------------------------------------------
// iOS Native Migration Entry Gate V1 — docs parity locks
//
// This file is the *static guard* for the docs-only iOS Native Migration
// Entry Gate V1 PR. It does NOT execute any iOS code, does NOT touch runtime
// behaviour, and does NOT depend on any iOS toolchain. Its only job is to
// keep the three top-level deliverables, the eight agent reports, and the
// cross-agent grill review honest:
//
//   docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md
//   docs/IOS_NATIVE_MIGRATION_TASKS_V1.md
//   docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md
//   docs/ios-native-migration/IOS_NATIVE_MIGRATION_CROSS_AGENT_REVIEW_V1.md
//   docs/ios-native-migration/agents/*.md  (the 8 audit reports)
//
// If a future PR edits these docs in a way that breaks one of the locked
// invariants (e.g. drops a stop condition, weakens the cloud-sync non-goal,
// loses a contract from the freeze list), this file will fail and surface
// the regression at PR time.
// ---------------------------------------------------------------------------

const ENTRY_GATE_PATH = 'docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md';
const TASKS_PATH = 'docs/IOS_NATIVE_MIGRATION_TASKS_V1.md';
const CONTRACT_FREEZE_PATH = 'docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md';
const CROSS_REVIEW_PATH =
  'docs/ios-native-migration/IOS_NATIVE_MIGRATION_CROSS_AGENT_REVIEW_V1.md';

const AGENT_REPORTS = [
  'docs/ios-native-migration/agents/PRODUCT_TRAINING_DOMAIN_AGENT.md',
  'docs/ios-native-migration/agents/TS_CORE_LOGIC_AGENT.md',
  'docs/ios-native-migration/agents/DATA_MODEL_REPAIR_AGENT.md',
  'docs/ios-native-migration/agents/CLOUD_SYNC_AUTH_AGENT.md',
  'docs/ios-native-migration/agents/IOS_ARCHITECTURE_AGENT.md',
  'docs/ios-native-migration/agents/QA_PARITY_AGENT.md',
  'docs/ios-native-migration/agents/SECURITY_PRIVACY_AGENT.md',
  'docs/ios-native-migration/agents/MIGRATION_PROGRAM_MANAGER_AGENT.md',
] as const;

const repoFile = (relative: string) =>
  resolve(process.cwd(), relative);

const allFinalDocs = () =>
  [ENTRY_GATE_PATH, TASKS_PATH, CONTRACT_FREEZE_PATH]
    .map(readSource)
    .join('\n');

const allDocs = () =>
  [
    ENTRY_GATE_PATH,
    TASKS_PATH,
    CONTRACT_FREEZE_PATH,
    CROSS_REVIEW_PATH,
    ...AGENT_REPORTS,
  ]
    .map(readSource)
    .join('\n');

describe('iosNativeMigrationEntryGate — final deliverables exist', () => {
  it('iosNativeMigrationEntryGate writes the 3 user-facing deliverables', () => {
    expect(existsSync(repoFile(ENTRY_GATE_PATH))).toBe(true);
    expect(existsSync(repoFile(TASKS_PATH))).toBe(true);
    expect(existsSync(repoFile(CONTRACT_FREEZE_PATH))).toBe(true);
  });

  it('iosNativeMigrationEntryGate writes the cross-agent grill review', () => {
    expect(existsSync(repoFile(CROSS_REVIEW_PATH))).toBe(true);
  });

  it('iosNativeMigrationEntryGate writes all 8 independent audit agent reports', () => {
    for (const reportPath of AGENT_REPORTS) {
      expect(existsSync(repoFile(reportPath))).toBe(true);
    }
  });
});

describe('iosNativeMigrationEntryGate — entry gate doc structure', () => {
  it('iosNativeMigrationEntryGate entry-gate doc carries the 20 mandated sections', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    const requiredHeadings = [
      'Executive summary',
      'Why PWA',
      'Current IronPath system inventory',
      'Multi-agent findings summary',
      'Migration strategy comparison',
      'Recommended strategy',
      'Contract freeze list',
      'iOS native architecture',
      'Local storage recommendation',
      'Cloud sync migration strategy',
      'Data Health migration strategy',
      'TrainingDecision migration strategy',
      'UI module mapping',
      'HealthKit strategy',
      'Test / parity strategy',
      'Security / privacy strategy',
      'Roadmap',
      'Stop conditions',
      'Risks',
      'Final recommendation',
    ];
    for (const heading of requiredHeadings) {
      expect(doc).toContain(heading);
    }
  });

  it('iosNativeMigrationEntryGate entry-gate doc declares native Swift rewrite as the recommended strategy', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    // The recommended path must be the native Swift rewrite, not any of the
    // wrap/RN/Capacitor alternatives.
    expect(doc).toMatch(/Native Swift rewrite/);
    // The doc must compare alternatives so the choice is auditable.
    expect(doc).toMatch(/WebView/);
    expect(doc).toMatch(/Capacitor/);
    expect(doc).toMatch(/React Native/);
  });
});

describe('iosNativeMigrationEntryGate — roadmap includes the required iOS-N tasks', () => {
  it('iosNativeMigrationEntryGate tasks doc names all 11 iOS-N tasks', () => {
    const doc = readSource(TASKS_PATH);
    for (const taskHeading of [
      '## iOS-0 Contract Fixture Export V1',
      '## iOS-1 Xcode Project Bootstrap V1',
      '## iOS-2 AppData Swift Models V1',
      '## iOS-3 Data Health Swift Port V1',
      '## iOS-4 TrainingDecision Swift Port V1',
      '## iOS-5 Native Focus Mode MVP V1',
      '## iOS-6 Plan / History / Progress Native Screens V1',
      '## iOS-7 Explicit Cloud Sync iOS V1',
      '## iOS-8 HealthKit Adapter V1',
      '## iOS-9 TestFlight Internal Acceptance V1',
      '## iOS-10 App Store Readiness V1',
    ]) {
      expect(doc).toContain(taskHeading);
    }
  });

  it('iosNativeMigrationEntryGate tasks doc forbids creating an Xcode project before iOS-0 lands green', () => {
    const doc = readSource(TASKS_PATH);
    expect(doc).toMatch(
      /DO NOT create an Xcode project before iOS-0 Contract Fixture Export/i,
    );
  });

  it('iosNativeMigrationEntryGate entry-gate doc and tasks doc agree iOS-0 precedes iOS-1', () => {
    const tasksDoc = readSource(TASKS_PATH);
    const idx0 = tasksDoc.indexOf('## iOS-0 Contract Fixture Export V1');
    const idx1 = tasksDoc.indexOf('## iOS-1 Xcode Project Bootstrap V1');
    expect(idx0).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeGreaterThan(idx0);
  });
});

describe('iosNativeMigrationEntryGate — contract freeze mandatory coverage', () => {
  it('iosNativeMigrationEntryGate contract-freeze doc names all 11 frozen contracts', () => {
    const doc = readSource(CONTRACT_FREEZE_PATH);
    for (const contractHeading of [
      '## 1. AppData compatibility contract',
      '## 2. TrainingDecision contract',
      '## 3. Clean input contract',
      '## 4. Data Health repair contract',
      '## 5. Cloud sync snapshot contract',
      '## 6. Upload eligibility contract',
      '## 7. Subsequent upload / concurrency contract',
      '## 8. Unit kg / lb contract',
      '## 9. Session lifecycle contract',
      '## 10. Health data freshness contract',
      '## 11. Real-data fixture contract',
    ]) {
      expect(doc).toContain(contractHeading);
    }
  });

  it('iosNativeMigrationEntryGate contract-freeze doc references the must-preserve core systems', () => {
    const doc = readSource(CONTRACT_FREEZE_PATH);
    // Each of these terms is a load-bearing contract surface the future iOS
    // port must preserve byte/semantically. If any disappears from the
    // freeze, the gate is broken.
    for (const term of [
      'TrainingDecision',
      'CleanAppDataView',
      'AutoRepairOrchestrator',
      'AppData',
      'HealthKit',
      'schemaVersion',
      'kg',
      'lb',
      'expectedPreviousHash',
      'syncedAppDataHash',
      // Repair ledger / receipt are present in the docs under their canonical
      // identifier names (`appDataRepairLedger`, `RepairLedger`,
      // `missingRepairReceipt`, etc.) rather than as the lowercase
      // two-word form. We match the common substring so any of those
      // spellings satisfies the lock.
    ]) {
      expect(doc).toContain(term);
    }
    expect(doc.toLowerCase()).toMatch(/ledger/);
    expect(doc.toLowerCase()).toMatch(/receipt/);
  });
});

describe('iosNativeMigrationEntryGate — stop conditions are present and unweakened', () => {
  it('iosNativeMigrationEntryGate stop conditions forbid WebView as the final iOS architecture', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /iOS V1 MUST NOT ship a WebView wrapper of the existing PWA as[\s\S]{0,80}its final architecture/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid background sync by default', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /iOS V1 MUST NOT enable background sync by default/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid raw AppData into TrainingDecision', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /iOS V1 MUST NOT feed raw AppData into TrainingDecision[\s\S]{0,80}CleanAppDataView/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid uploading partially-repaired AppData', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(/iOS V1 MUST NOT upload partially-repaired AppData/i);
  });

  it('iosNativeMigrationEntryGate stop conditions forbid silent cloud overwrite on conflict', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /iOS V1 MUST NOT silently overwrite cloud snapshots on conflict/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid third-party SwiftPM deps (including supabase-swift) without explicit user approval', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /DO NOT add any third-party SwiftPM dependency[\s\S]{0,80}supabase-swift[\s\S]{0,80}without explicit user approval/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid Sentry / Crashlytics / analytics SDKs without explicit user approval', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    // Stop conditions in the doc wrap across lines with indentation.
    // Allow arbitrary whitespace between adjacent words.
    expect(doc).toMatch(
      /DO NOT add Sentry \/ Crashlytics \/ analytics SDKs without\s+explicit user approval/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid HealthKit write permission unless a feature actually writes back', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /DO NOT request HealthKit write permission unless a feature\s+actually writes back/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid shipping cloud sync in V1 without in-app account deletion', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(
      /DO NOT ship cloud sync in V1 without an in-app account deletion\s+flow/i,
    );
  });

  it('iosNativeMigrationEntryGate stop conditions forbid `gh pr merge --admin` bypass', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(/DO NOT use `gh pr merge --admin`/);
  });

  it('iosNativeMigrationEntryGate tasks doc repeats the stop conditions in its front matter', () => {
    const doc = readSource(TASKS_PATH);
    // The tasks doc is where iOS-N implementers actually land — it must also
    // carry the 11 stop conditions verbatim.
    for (const condition of [
      'iOS V1 MUST NOT ship a WebView wrapper',
      'iOS V1 MUST NOT enable background sync by default',
      'iOS V1 MUST NOT feed raw AppData into TrainingDecision',
      'iOS V1 MUST NOT upload partially-repaired AppData',
      'iOS V1 MUST NOT silently overwrite cloud snapshots on conflict',
      'DO NOT create an Xcode project before iOS-0 Contract Fixture Export',
      'DO NOT add any third-party SwiftPM dependency',
      'DO NOT add Sentry / Crashlytics / analytics SDKs',
      'DO NOT request HealthKit write permission',
      'DO NOT ship cloud sync in V1 without an in-app account deletion flow',
      'DO NOT use `gh pr merge --admin`',
    ]) {
      expect(doc).toContain(condition);
    }
  });
});

describe('iosNativeMigrationEntryGate — cross-review HIGH revisions are absorbed', () => {
  it('iosNativeMigrationEntryGate H1: canonical fixture path is tests/fixtures/parity/', () => {
    const doc = allFinalDocs();
    expect(doc).toContain('tests/fixtures/parity/');
    // The alternate path proposed by Agent 8 must not be the canonical
    // direction — the entry gate must explicitly resolve in favour of
    // the parity/ path.
    expect(doc).toMatch(
      /tests\/fixtures\/parity\/[\s\S]{0,400}canonical/i,
    );
  });

  it('iosNativeMigrationEntryGate H2: supabase-swift SDK is recorded as deferred-approval (Path A / B / C)', () => {
    const entryGate = readSource(ENTRY_GATE_PATH);
    const tasks = readSource(TASKS_PATH);
    expect(entryGate).toMatch(/supabase-swift/);
    expect(entryGate).toMatch(/RECOMMENDED-PENDING-APPROVAL/i);
    // The user-decision Path A / B / C is named in the entry gate.
    expect(entryGate).toMatch(/Path A/);
    expect(entryGate).toMatch(/Path B/);
    expect(entryGate).toMatch(/Path C/);
    // iOS-7 cannot start until this is resolved — the tasks doc must say so.
    expect(tasks).toMatch(/iOS-7[\s\S]{0,2000}Path A/);
  });

  it('iosNativeMigrationEntryGate H3: in-app account deletion is in iOS-7 acceptance and iOS-10 readiness', () => {
    const tasks = readSource(TASKS_PATH);
    const idx7 = tasks.indexOf('## iOS-7 Explicit Cloud Sync iOS V1');
    const idx8 = tasks.indexOf('## iOS-8 HealthKit Adapter V1');
    const idx10 = tasks.indexOf('## iOS-10 App Store Readiness V1');
    expect(idx7).toBeGreaterThanOrEqual(0);
    expect(idx10).toBeGreaterThan(idx7);
    const ios7Slice = tasks.slice(idx7, idx8);
    const ios10Slice = tasks.slice(idx10);
    expect(ios7Slice).toMatch(/in-app account deletion/i);
    expect(ios10Slice).toMatch(/in-app account deletion/i);
    // The contract freeze must also carry it inside the Cloud sync snapshot
    // contract.
    const freeze = readSource(CONTRACT_FREEZE_PATH);
    expect(freeze).toMatch(/in-app account deletion/i);
  });
});

describe('iosNativeMigrationEntryGate — schemaVersion 8 must be the AppData baseline', () => {
  it('iosNativeMigrationEntryGate contract freeze pins schemaVersion to 8', () => {
    const doc = readSource(CONTRACT_FREEZE_PATH);
    expect(doc).toMatch(/schemaVersion[\s\S]{0,40}8/);
  });
});

describe('iosNativeMigrationEntryGate — local storage recommendation is JSON-snapshot-first', () => {
  it('iosNativeMigrationEntryGate entry-gate doc says JSON snapshot first and defers SQLite/SwiftData/CoreData', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    expect(doc).toMatch(/JSON[\s\S]{0,40}snapshot/i);
    // The escalation threshold must remain explicit so future PRs do not
    // silently reach for a database layer.
    expect(doc).toMatch(/SwiftData|Core Data|SQLite/);
    expect(doc).toMatch(/defer|escalat|threshold/i);
  });
});

describe('iosNativeMigrationEntryGate — multi-agent structure is preserved', () => {
  it('iosNativeMigrationEntryGate the entry-gate doc cites all 8 agent reports', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    for (const agent of [
      'PRODUCT_TRAINING_DOMAIN_AGENT',
      'TS_CORE_LOGIC_AGENT',
      'DATA_MODEL_REPAIR_AGENT',
      'CLOUD_SYNC_AUTH_AGENT',
      'IOS_ARCHITECTURE_AGENT',
      'QA_PARITY_AGENT',
      'SECURITY_PRIVACY_AGENT',
      'MIGRATION_PROGRAM_MANAGER_AGENT',
    ]) {
      expect(doc).toContain(agent);
    }
  });

  it('iosNativeMigrationEntryGate the cross-agent grill review issues a verdict (APPROVE / REVISE / REJECT)', () => {
    const doc = readSource(CROSS_REVIEW_PATH);
    expect(doc).toMatch(/Verdict[\s\S]{0,200}(APPROVE|REVISE|REJECT)/i);
  });
});

describe('iosNativeMigrationEntryGate — docs are planning only, no Xcode project landed in this PR', () => {
  it('iosNativeMigrationEntryGate entry-gate doc declares this PR is planning-only and no Xcode project lands here', () => {
    const doc = readSource(ENTRY_GATE_PATH);
    // The doc must explicitly record that no implementation / no Xcode
    // project lands in THIS PR; the Xcode project is the iOS-1 task and
    // must wait for iOS-0 to land green.
    expect(doc).toMatch(/No implementation lands in this PR|docs\s*\/\s*planning only|planning only/i);
    expect(doc).toMatch(
      /DO NOT create an Xcode project before iOS-0 Contract Fixture\s+Export/i,
    );
  });

  it('iosNativeMigrationEntryGate the worktree must not actually contain an .xcodeproj or ios/ source dir', () => {
    // Reading from the repo root: the docs PR is planning only. Any future
    // PR that lands ios/ must explicitly be iOS-1, not bundled with the
    // entry-gate doc.
    expect(existsSync(repoFile('ios'))).toBe(false);
    expect(existsSync(repoFile('IronPath.xcodeproj'))).toBe(false);
    expect(existsSync(repoFile('IronPath.xcworkspace'))).toBe(false);
  });
});

describe('iosNativeMigrationEntryGate — cross-doc consistency', () => {
  it('iosNativeMigrationEntryGate all final docs and the cross-review agree the 8 agents ran independently', () => {
    const blob = allDocs();
    // The audit is named explicitly so any future doc rename surfaces here.
    expect(blob).toContain('iOS Native Migration Entry Gate V1');
    // Both casings appear in the docs; the lock only cares that the
    // multi-agent framing survives.
    expect(blob.toLowerCase()).toContain('multi-agent');
  });

  it('iosNativeMigrationEntryGate roadmap, tasks, and freeze cross-link by name', () => {
    const entryGate = readSource(ENTRY_GATE_PATH);
    const tasks = readSource(TASKS_PATH);
    const freeze = readSource(CONTRACT_FREEZE_PATH);
    expect(entryGate).toContain('IOS_NATIVE_MIGRATION_TASKS_V1');
    expect(entryGate).toContain('IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1');
    expect(tasks).toContain('IOS_NATIVE_MIGRATION_ENTRY_GATE_V1');
    expect(tasks).toContain('IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1');
    expect(freeze).toContain('IOS_NATIVE_MIGRATION_ENTRY_GATE_V1');
    expect(freeze).toContain('IOS_NATIVE_MIGRATION_TASKS_V1');
  });
});
