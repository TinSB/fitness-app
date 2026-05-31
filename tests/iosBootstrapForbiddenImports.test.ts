import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — forbidden imports lock.
//
// Scans every .swift file under ios/ and fails if any of the iOS-1
// forbidden imports / symbols appears. Each entry maps to a stop condition
// from the Entry Gate or a cross-review revision.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

// HK-1 (body-weight) + HK-2 (workout history): the SINGLE sanctioned, read-only
// HealthKit adapter file. It is the ONLY iOS Swift file allowed to import HealthKit
// / use HKHealthStore / HKQuantityType / HKWorkout / HKWorkoutActivityType (master
// §6.2/§17/§18, amended in the HK-1 and HK-2 PRs). It hosts BOTH read adapters
// (`HealthKitBodyMassSource`, `HealthKitWorkoutSource`) on purpose, so every
// HealthKit call in the whole iOS tree stays in this one `#if os(iOS)` file. Every
// other Swift file under ios/ stays HealthKit-free. The dedicated block at the
// bottom asserts this file is the sole holder of the HealthKit tokens AND that it
// is read-only (no write-back — that is the deferred HK-3 slice).
const HEALTHKIT_READ_ADAPTER =
  'ios/packages/IronPathHealthKit/Sources/IronPathHealthKit/HealthKitBodyMassSource.swift';

// N-1 (Local Rest-Timer Notification V1): the SINGLE sanctioned LOCAL notification
// adapter. It is the ONLY iOS Swift file allowed to import UserNotifications / use
// UNUserNotificationCenter & the local content/request/time-interval-trigger
// symbols (master §16/§17/§18, amended in the same PR). Every other Swift file
// under ios/ stays UserNotifications-free. REMOTE / push tokens are banned
// EVERYWHERE (including this file). The dedicated block at the bottom asserts this
// file is the sole holder of the local tokens AND that it is local-only (a
// time-interval trigger, never remote registration).
const LOCAL_NOTIFICATION_ADAPTER =
  'ios/packages/IronPathNotifications/Sources/IronPathNotifications/UserNotificationsRestReminderScheduler.swift';

const collectSwiftFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      collectSwiftFiles(full, out);
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

interface ForbiddenPattern {
  readonly name: string;
  readonly stopCondition: string;
  readonly pattern: RegExp;
  /** HK-1: a single repo-relative path exempt from THIS pattern (the approved
   *  read-only HealthKit adapter). The ban still applies to every other file. */
  readonly allowInFile?: string;
}

// Each pattern is matched against actual code, not comments. The
// `^\s*import …$` anchors prevent `import IronPathHealthKit` from
// matching the `HealthKit` forbidden import. Symbol patterns use
// word boundaries so e.g. `WKWebView` doesn't match prose mentioning
// `WKWebViewDocumentation`. Comments (`//`) and doc-comment lines
// (`///`) are stripped before matching so the docs in placeholder
// source files can reference forbidden names without tripping the
// guard.
const FORBIDDEN: readonly ForbiddenPattern[] = [
  // Stop Condition #1: no WebView wrapper.
  { name: 'WebKit_import', stopCondition: '#1 (WebView)', pattern: /^\s*import\s+WebKit\s*$/m },
  { name: 'WKWebView_symbol', stopCondition: '#1 (WebView)', pattern: /\bWKWebView\b/ },
  // Stop Condition #2: no background sync.
  { name: 'BackgroundTasks_import', stopCondition: '#2 (background sync)', pattern: /^\s*import\s+BackgroundTasks\s*$/m },
  { name: 'BGTaskScheduler_symbol', stopCondition: '#2 (background sync)', pattern: /\bBGTaskScheduler\b/ },
  { name: 'BGAppRefreshTask_symbol', stopCondition: '#2 (background sync)', pattern: /\bBGAppRefreshTask\b/ },
  // HK-1: HealthKit READ-ONLY body-weight import is APPROVED (master §17/§18,
  // amended in the HK-1 PR). The HealthKit framework + HKHealthStore/HKQuantityType
  // are permitted ONLY in the single read-only adapter file (`allowInFile`); every
  // other ios Swift file stays HealthKit-free. Write-back (HK-3) is still deferred.
  { name: 'HealthKit_import', stopCondition: 'HK-1 (read-only adapter only)', pattern: /^\s*import\s+HealthKit\s*$/m, allowInFile: HEALTHKIT_READ_ADAPTER },
  { name: 'HKHealthStore_symbol', stopCondition: 'HK-1 (read-only adapter only)', pattern: /\bHKHealthStore\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  { name: 'HKQuantityType_symbol', stopCondition: 'HK-1 (read-only adapter only)', pattern: /\bHKQuantityType\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  // HK-2: read-only WORKOUT-history import is APPROVED (master §17/§18, amended in
  // the HK-2 PR — within the already-ungated read-only HealthKit boundary). The
  // HKWorkout / HKWorkoutActivityType symbols are permitted ONLY in the SAME single
  // read-only adapter file (`allowInFile`); every other ios Swift file stays
  // workout-free. Write-back (HK-3) is still deferred.
  { name: 'HKWorkout_symbol', stopCondition: 'HK-2 (read-only adapter only)', pattern: /\bHKWorkout\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  { name: 'HKWorkoutActivityType_symbol', stopCondition: 'HK-2 (read-only adapter only)', pattern: /\bHKWorkoutActivityType\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  // HK-3b: the workout EXPORT write mechanism migrated from the deprecated
  // HKWorkout(activityType:…) initializer to HKWorkoutBuilder (beginCollection →
  // addMetadata → endCollection → finishWorkout) — the non-deprecated iOS 17+ path,
  // behavior unchanged (same activity / window / duration / metadata, still ONLY the
  // workout type). The HKWorkoutBuilder / HKWorkoutConfiguration symbols are permitted
  // ONLY in the SAME single adapter file (`allowInFile`); every other ios Swift file
  // stays workout-builder-free (a NEW confinement — net protection does not decrease).
  { name: 'HKWorkoutBuilder_symbol', stopCondition: 'HK-3b (export adapter only)', pattern: /\bHKWorkoutBuilder\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  { name: 'HKWorkoutConfiguration_symbol', stopCondition: 'HK-3b (export adapter only)', pattern: /\bHKWorkoutConfiguration\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  // N-1: LOCAL notifications are APPROVED (master §16/§17/§18, amended in the N-1
  // PR). The UserNotifications framework + the local UNUserNotificationCenter /
  // content / request / time-interval-trigger symbols are permitted ONLY in the
  // single local adapter file (`allowInFile`); every other ios Swift file stays
  // UserNotifications-free.
  { name: 'UserNotifications_import', stopCondition: 'N-1 (local adapter only)', pattern: /^\s*import\s+UserNotifications\s*$/m, allowInFile: LOCAL_NOTIFICATION_ADAPTER },
  { name: 'UNUserNotificationCenter_symbol', stopCondition: 'N-1 (local adapter only)', pattern: /\bUNUserNotificationCenter\b/, allowInFile: LOCAL_NOTIFICATION_ADAPTER },
  { name: 'UNMutableNotificationContent_symbol', stopCondition: 'N-1 (local adapter only)', pattern: /\bUNMutableNotificationContent\b/, allowInFile: LOCAL_NOTIFICATION_ADAPTER },
  { name: 'UNNotificationRequest_symbol', stopCondition: 'N-1 (local adapter only)', pattern: /\bUNNotificationRequest\b/, allowInFile: LOCAL_NOTIFICATION_ADAPTER },
  { name: 'UNTimeIntervalNotificationTrigger_symbol', stopCondition: 'N-1 (local adapter only)', pattern: /\bUNTimeIntervalNotificationTrigger\b/, allowInFile: LOCAL_NOTIFICATION_ADAPTER },
  // N-2: LOCAL repeating training reminders are APPROVED (master §16/§17/§18,
  // amended in the N-2 PR — within the already-ungated local-notification
  // boundary). The repeating calendar trigger is permitted ONLY in the SAME single
  // local adapter file (`allowInFile`) — keeping every real UNUserNotificationCenter
  // call confined to one `#if os(iOS)` file. Locked further by
  // tests/iosTrainingReminderNotificationStaticGuards.test.ts.
  { name: 'UNCalendarNotificationTrigger_symbol', stopCondition: 'N-2 (local adapter only)', pattern: /\bUNCalendarNotificationTrigger\b/, allowInFile: LOCAL_NOTIFICATION_ADAPTER },
  // N-1: REMOTE / push notifications stay FORBIDDEN everywhere (they need a server
  // → master §17). No file — not even the local adapter — may register for remote
  // push, ship a notification service extension, or pull in PushKit.
  { name: 'registerForRemoteNotifications_symbol', stopCondition: 'N-1 (remote push forbidden)', pattern: /\bregisterForRemoteNotifications\b/ },
  { name: 'didRegisterForRemoteNotificationsWithDeviceToken_symbol', stopCondition: 'N-1 (remote push forbidden)', pattern: /\bdidRegisterForRemoteNotificationsWithDeviceToken\b/ },
  { name: 'UNNotificationServiceExtension_symbol', stopCondition: 'N-1 (remote push forbidden)', pattern: /\bUNNotificationServiceExtension\b/ },
  { name: 'PushKit_import', stopCondition: 'N-1 (remote push forbidden)', pattern: /^\s*import\s+PushKit\s*$/m },
  { name: 'PKPushRegistry_symbol', stopCondition: 'N-1 (remote push forbidden)', pattern: /\bPKPushRegistry\b/ },
  // Persistence: JSON-snapshot first. SwiftData / CoreData need explicit thresholds (Agent 3).
  { name: 'SwiftData_import', stopCondition: 'Agent 3 storage choice', pattern: /^\s*import\s+SwiftData\s*$/m },
  { name: 'CoreData_import', stopCondition: 'Agent 3 storage choice', pattern: /^\s*import\s+CoreData\s*$/m },
  { name: 'NSManagedObject_symbol', stopCondition: 'Agent 3 storage choice', pattern: /\bNSManagedObject\b/ },
  // Cross-review Revision H2: supabase-swift SDK requires user approval before iOS-7.
  { name: 'Supabase_import', stopCondition: 'Cross-review H2', pattern: /^\s*import\s+Supabase\s*$/m },
  { name: 'GoTrue_import', stopCondition: 'Cross-review H2', pattern: /^\s*import\s+GoTrue\s*$/m },
  { name: 'PostgREST_import', stopCondition: 'Cross-review H2', pattern: /^\s*import\s+PostgREST\s*$/m },
  // Stop Condition #8: no analytics / crash / Firebase SDK in V1.
  { name: 'Sentry_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Sentry\s*$/m },
  { name: 'Crashlytics_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Crashlytics\s*$/m },
  { name: 'Firebase_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Firebase\s*$/m },
  { name: 'Bugsnag_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Bugsnag\s*$/m },
  { name: 'Datadog_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Datadog\s*$/m },
  { name: 'Mixpanel_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Mixpanel\s*$/m },
  { name: 'Amplitude_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Amplitude\s*$/m },
  { name: 'PostHog_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+PostHog\s*$/m },
  // iOS-1 does NO network. iOS-7 introduces the network layer.
  { name: 'URLSession_call', stopCondition: 'iOS-7 (network layer)', pattern: /\bURLSession\(/ },
];

// Strip single-line `//` and `///` comments so the placeholder source
// files can reference forbidden names in prose without tripping the
// guard. We intentionally do NOT strip `/* … */` blocks; iOS-1 source
// uses single-line comments only.
const stripComments = (text: string): string =>
  text
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

describe('iosBootstrapForbiddenImports', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));

  it('iosBootstrap discovered at least the 8 package sources + the 8 tests + the app target sources', () => {
    // 8 packages × 2 swift files (source + test) + 2 app target = 18 minimum.
    expect(swiftFiles.length).toBeGreaterThanOrEqual(18);
  });

  for (const { name, stopCondition, pattern, allowInFile } of FORBIDDEN) {
    it(`iosBootstrap forbids ${name} (${stopCondition})`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const rel = file.replace(`${repoRoot}/`, '');
        // HK-1: the sanctioned read-only adapter is exempt from THIS pattern only.
        if (allowInFile && rel === allowInFile) continue;
        const text = stripComments(readFileSync(file, 'utf8'));
        if (pattern.test(text)) {
          hits.push(rel);
        }
      }
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// HK-1 + HK-2 read + HK-3 workout-export HealthKit adapter boundary.
//
// The HealthKit-token exemption above is bounded by these assertions: exactly
// ONE file holds the tokens (body-mass AND workout). HK-1/HK-2 read authorization
// still shares NOTHING (`toShare: []`). HK-3 adds the FIRST and ONLY write-back: it
// shares ONLY the workout type (`toShare: [workoutType]`) and writes ONLY HKWorkouts
// via HKWorkoutBuilder (HK-3b — beginCollection → endCollection → finishWorkout, the
// non-deprecated iOS 17+ path; was the deprecated HKWorkout initializer + save) — no
// body-mass / quantity-sample write, no other Apple-Health type. This is the guard that
// ships with the HK-1 + HK-2 + HK-3
// capability ungating (master §22 — every boundary ships a guard). The HK-3 export
// surface is positively locked by tests/iosHealthKitWorkoutExportStaticGuards.test.ts.
// ---------------------------------------------------------------------------

describe('iosBootstrap HK-1 + HK-2 read + HK-3 workout-export HealthKit adapter boundary', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));
  const adapterAbs = resolve(repoRoot, HEALTHKIT_READ_ADAPTER);
  const healthKitTokens: ReadonlyArray<RegExp> = [
    /^\s*import\s+HealthKit\s*$/m,
    /\bHKHealthStore\b/,
    /\bHKQuantityType\b/,
    /\bHKWorkout\b/,
    /\bHKWorkoutActivityType\b/,
    // HK-3b: the export write mechanism (HKWorkoutBuilder + its HKWorkoutConfiguration)
    // is confined to the SAME single adapter, like every other HealthKit token.
    /\bHKWorkoutBuilder\b/,
    /\bHKWorkoutConfiguration\b/,
  ];

  it('the sanctioned HealthKit adapter file exists', () => {
    expect(swiftFiles.includes(adapterAbs)).toBe(true);
  });

  it('the adapter is the ONLY ios Swift file that uses HealthKit tokens', () => {
    for (const token of healthKitTokens) {
      const holders = swiftFiles
        .filter((f) => token.test(stripComments(readFileSync(f, 'utf8'))))
        .map((f) => f.replace(`${repoRoot}/`, ''));
      expect(holders, `HealthKit token ${token} found in: ${holders.join(', ')}`)
        .toEqual([HEALTHKIT_READ_ADAPTER]);
    }
  });

  it('the adapter shares ONLY the workout type for export — no other Apple-Health write', () => {
    const code = stripComments(readFileSync(adapterAbs, 'utf8'));
    // HK-1/HK-2 READ authorization still shares NOTHING (read-only).
    expect(code).toMatch(/toShare:\s*\[\s*\]/);
    // HK-3 export shares ONLY the workout type — the first & only write capability.
    expect(code).toMatch(/toShare:\s*\[workoutType\]/);
    // It NEVER shares any OTHER Apple-Health type (e.g. body mass) back.
    expect(code).not.toMatch(/toShare:[^\]]*bodyMass/);
    // The ONLY thing written back is an HKWorkout: NO body-mass / quantity-sample write.
    // HK-3b migrated the write mechanism from the deprecated HKWorkout(activityType:…)
    // initializer (+ store.save) to HKWorkoutBuilder (beginCollection → endCollection →
    // finishWorkout, the non-deprecated iOS 17+ path) — behavior unchanged (same
    // activity / window / duration / metadata, still ONLY the workout type). The builder
    // is confined to this single adapter by the sole-holder token list above. The
    // positive export surface (idempotency, native-only, user-triggered) is locked by
    // tests/iosHealthKitWorkoutExportStaticGuards.test.ts.
    expect(code).not.toMatch(/HKQuantitySample\s*\(/);
    expect(code).toMatch(/HKWorkoutBuilder\s*\(/);
  });

  it('the adapter is compiled iOS-only (#if os(iOS)) so host swift test excludes it', () => {
    // Read raw (not comment-stripped): the directive is real code.
    expect(readFileSync(adapterAbs, 'utf8')).toMatch(/#if\s+os\(iOS\)/);
  });
});

// ---------------------------------------------------------------------------
// N-1 local-notification adapter boundary.
//
// The local UserNotifications-token exemption above is bounded by these
// assertions: exactly ONE file holds the local tokens, it is local-only (a
// time-interval trigger, no remote-push registration), and it is `#if os(iOS)`.
// Separately, NO ios Swift file may register for REMOTE push (the local-only
// boundary). Ships with the N-1 capability ungating (master §22).
// ---------------------------------------------------------------------------

describe('iosBootstrap N-1 local-notification adapter boundary', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));
  const adapterAbs = resolve(repoRoot, LOCAL_NOTIFICATION_ADAPTER);
  const localNotificationTokens: ReadonlyArray<RegExp> = [
    /^\s*import\s+UserNotifications\s*$/m,
    /\bUNUserNotificationCenter\b/,
    /\bUNMutableNotificationContent\b/,
    /\bUNNotificationRequest\b/,
    /\bUNTimeIntervalNotificationTrigger\b/,
  ];
  const remotePushTokens: ReadonlyArray<RegExp> = [
    /\bregisterForRemoteNotifications\b/,
    /\bdidRegisterForRemoteNotificationsWithDeviceToken\b/,
    /\bUNNotificationServiceExtension\b/,
    /\bPKPushRegistry\b/,
  ];

  it('the sanctioned local-notification adapter file exists', () => {
    expect(swiftFiles.includes(adapterAbs)).toBe(true);
  });

  it('the adapter is the ONLY ios Swift file that uses local UserNotifications tokens', () => {
    for (const token of localNotificationTokens) {
      const holders = swiftFiles
        .filter((f) => token.test(stripComments(readFileSync(f, 'utf8'))))
        .map((f) => f.replace(`${repoRoot}/`, ''));
      expect(holders, `local-notification token ${token} found in: ${holders.join(', ')}`)
        .toEqual([LOCAL_NOTIFICATION_ADAPTER]);
    }
  });

  it('the adapter is LOCAL-ONLY (time-interval trigger, no remote-push registration)', () => {
    const code = stripComments(readFileSync(adapterAbs, 'utf8'));
    // A local one-shot time-interval trigger is the scheduling mechanism.
    expect(code).toMatch(/UNTimeIntervalNotificationTrigger\s*\(/);
    // No remote-push path anywhere in the adapter.
    for (const token of remotePushTokens) {
      expect(code, `remote-push token ${token} must not appear in the adapter`).not.toMatch(token);
    }
  });

  it('the adapter is compiled iOS-only (#if os(iOS)) so host swift test excludes it', () => {
    expect(readFileSync(adapterAbs, 'utf8')).toMatch(/#if\s+os\(iOS\)/);
  });

  it('NO ios Swift file registers for REMOTE push (local-only boundary)', () => {
    for (const token of remotePushTokens) {
      const holders = swiftFiles
        .filter((f) => token.test(stripComments(readFileSync(f, 'utf8'))))
        .map((f) => f.replace(`${repoRoot}/`, ''));
      expect(holders, `remote-push token ${token} found in: ${holders.join(', ')}`).toEqual([]);
    }
  });
});
