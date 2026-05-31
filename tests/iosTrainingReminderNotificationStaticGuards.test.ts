import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// N-2 Training Reminders V1 — static guards.
//
// Locks the N-2 surface: WITHIN the already-ungated local-notification boundary
// (master §16/§17/§18, ungated by N-1 and refined — not expanded — in the N-2
// PR), the user can pick weekdays + a time and arm a REPEATING weekly LOCAL
// reminder, read its live state back, and turn it off. Hard local-only boundary:
//   • Pure `TrainingReminderPolicy` (+ value types) in the existing Foundation-only
//     `IronPathNotifications` package: build per-weekday repeating requests, the
//     next-fire instant from an injected `now`/`Calendar`, and reconstruct the
//     schedule from pending — all plain value logic, no UserNotifications import.
//   • The `TrainingReminderScheduling` seam (LOCAL verbs; reuses N-1's
//     `RestReminderAuthorization`).
//   • The real `UNCalendarNotificationTrigger(repeats: true)` adapter lives in the
//     SAME single `#if os(iOS)` UserNotifications file as N-1 — keeping every real
//     UNUserNotificationCenter call confined to one file (also locked centrally by
//     tests/iosBootstrapForbiddenImports.test.ts). It is the SOLE holder of the
//     calendar-trigger token.
//   • Thin app card + view-model co-located in `ProfileRootView` (honest status,
//     never imports UserNotifications, no FileManager/UserDefaults — iOS persists
//     the repeating notifications; the app keeps no schedule of its own).
//   • LOCAL only: NO remote / push (still gated §17), NO network, NO AppData /
//     source-of-truth change.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const PKG_SRC = 'ios/packages/IronPathNotifications/Sources/IronPathNotifications';
const POLICY = `${PKG_SRC}/TrainingReminderPolicy.swift`;
const SEAM = `${PKG_SRC}/TrainingReminderScheduling.swift`;
// The N-2 repeating adapter is co-located in the single sanctioned UserNotifications
// file (the same one N-1 uses), so all real UNUserNotificationCenter calls stay in
// one #if os(iOS) file.
const ADAPTER = `${PKG_SRC}/UserNotificationsRestReminderScheduler.swift`;
const APP = 'ios/IronPath/ProfileRootView.swift';
const DOC = 'docs/ios-native-migration/IOS_N2_TRAINING_REMINDERS_V1.md';

const exists = (p: string): boolean => existsSync(repoFile(p));
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const raw = (p: string): string => readFileSync(repoFile(p), 'utf8');
const code = (p: string): string => stripSwiftComments(raw(p));

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

// ---- 1-3. Pure policy + value types + seam ----

describe('N-2 pure training-reminder policy + seam', () => {
  it('1. policy + seam files exist', () => {
    expect(exists(POLICY)).toBe(true);
    expect(exists(SEAM)).toBe(true);
    expect(exists(ADAPTER)).toBe(true);
  });

  it('2. TrainingReminderPolicy is pure (weekdays → repeating requests; injected now/Calendar → next fire; reconstruct from pending; no inline Date())', () => {
    const m = code(POLICY);
    expect(m).toMatch(/enum\s+TrainingReminderPolicy\b/);
    expect(m).toMatch(/func\s+makeReminders\b/);
    expect(m).toMatch(/func\s+nextFireDate\b/);
    expect(m).toMatch(/func\s+schedule\b/); // schedule(fromPending:)
    // injected clock + calendar, never an inline wall-clock Date()
    expect(m).toMatch(/now:\s*Date/);
    expect(m).toMatch(/calendar:\s*Calendar/);
    expect(m).not.toMatch(/Date\s*\(\s*\)/);
    // the value types are plain primitives
    expect(m).toMatch(/struct\s+TrainingReminderRequest\b/);
    expect(m).toMatch(/struct\s+TrainingReminderSchedule\b/);
    expect(m).toMatch(/struct\s+PendingTrainingReminder\b/);
    // repeating WEEKLY: requests carry a weekday
    expect(m).toMatch(/weekday\b/);
  });

  it('3. the seam protocol exists with LOCAL-only verbs + reuses N-1 authorization', () => {
    const m = code(SEAM);
    expect(m).toMatch(/protocol\s+TrainingReminderScheduling\b/);
    expect(m).toMatch(/func\s+requestAuthorization\b/);
    expect(m).toMatch(/func\s+replaceReminders\b/);
    expect(m).toMatch(/func\s+pendingSchedule\b/);
    expect(m).toMatch(/func\s+cancelAll\b/);
    // reuses the N-1 local-notification authorization enum (no duplicate enum)
    expect(m).toMatch(/RestReminderAuthorization\b/);
    // the seam itself imports no UserNotifications
    expect(m).not.toMatch(/^\s*import\s+UserNotifications\b/m);
  });
});

// ---- 4. Adapter: repeating calendar trigger, single #if os(iOS) holder ----

describe('N-2 repeating local adapter boundary', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));

  it('4. the adapter schedules a REPEATING UNCalendarNotificationTrigger, is #if os(iOS), and has no remote push', () => {
    const m = code(ADAPTER);
    expect(m).toMatch(/struct\s+UserNotificationsTrainingReminderScheduler\b/);
    expect(m).toMatch(/UNCalendarNotificationTrigger\s*\(/);
    expect(m).toMatch(/repeats:\s*true/);
    expect(raw(ADAPTER)).toMatch(/#if\s+os\(iOS\)/);
    expect(m).not.toMatch(/\bregisterForRemoteNotifications\b/);
    expect(m).not.toMatch(/\bUNNotificationServiceExtension\b/);
    expect(m).not.toMatch(/\bPKPushRegistry\b/);
  });

  it('5. the adapter is the ONLY ios Swift file that uses UNCalendarNotificationTrigger', () => {
    const holders = swiftFiles
      .filter((f) => /\bUNCalendarNotificationTrigger\b/.test(stripSwiftComments(readFileSync(f, 'utf8'))))
      .map((f) => f.replace(`${repoRoot}/`, ''));
    expect(holders, `UNCalendarNotificationTrigger found in: ${holders.join(', ')}`).toEqual([ADAPTER]);
  });
});

// ---- 6-7. App layer: thin honest card, no UserNotifications, no disk ----

describe('N-2 app layer', () => {
  it('6. ProfileRootView hosts the card + a thin view-model with an honest status (no fake success)', () => {
    const m = code(APP);
    expect(m).toMatch(/struct\s+TrainingReminderCard\b/);
    expect(m).toMatch(/class\s+TrainingReminderModel\b/);
    expect(m).toMatch(/^\s*import\s+IronPathNotifications\b/m);
    // honest states — denial / failure are surfaced, never a fake "on"
    expect(m).toMatch(/enum\s+TrainingReminderStatus\b/);
    expect(m).toMatch(/case\s+denied\b/);
    expect(m).toMatch(/case\s+failed\s*\(/);
    expect(m).toMatch(/case\s+scheduled\b/);
    // goes through the package seam + pure policy
    expect(m).toMatch(/TrainingReminderScheduling\b/);
    expect(m).toMatch(/TrainingReminderPolicy\./);
  });

  it('7. the app layer never imports UserNotifications and never persists (no disk)', () => {
    const m = code(APP);
    // only the #if os(iOS) package adapter touches the framework — the app uses the seam
    expect(m).not.toMatch(/^\s*import\s+UserNotifications\b/m);
    expect(m).not.toMatch(/\bUNUserNotificationCenter\b/);
    // no schedule stored by the app — iOS persists the repeating notifications
    expect(m).not.toMatch(/\bFileManager\b/);
    expect(m).not.toMatch(/\bUserDefaults\b/);
    // local-only / no-remote-push disclaimer, Chinese-first
    expect(raw(APP)).toMatch(/无远程推送/);
    expect(/[一-鿿]/.test(raw(APP))).toBe(true);
  });
});

// ---- 8. Documentation ----

describe('N-2 docs', () => {
  it('8. the N-2 doc records local-only + repeating + permission + remote-push forbidden + a Simulator smoke checklist', () => {
    expect(exists(DOC)).toBe(true);
    const doc = raw(DOC);
    expect(doc).toMatch(/[Ss]imulator smoke/);
    expect(doc).toMatch(/local-only|local only|仅本地|本地/);
    expect(doc).toMatch(/repeat|recurring|weekly|重复|每周/i);
    expect(doc).toMatch(/remote|push|远程|推送/i);
    expect(doc).toMatch(/permission|authorization|privacy|授权|隐私/i);
  });
});
