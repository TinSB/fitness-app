import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// N-1 Local Rest-Timer Notification V1 — static guards.
//
// Locks the N-1 surface (an APPROVED capability ungating, master §16/§17/§18
// amended in the same PR): after the user authorizes, completing a set schedules
// a LOCAL rest-timer reminder; switching exercises / ending / completing cancels
// it. Hard local-only boundary:
//   • New Foundation-only, standalone package `IronPathNotifications` (no package
//     dependency, no remote SwiftPM) carrying the pure `RestReminderPolicy` + the
//     `RestReminderScheduling` seam + the `#if os(iOS)` UNUserNotificationCenter
//     adapter (the ONLY UserNotifications holder — also locked centrally by
//     tests/iosBootstrapForbiddenImports.test.ts).
//   • Thin app-layer `RestReminderModel` (honest status, never imports
//     UserNotifications, no FileManager/UserDefaults) + a render-only section.
//   • LOCAL only: a time-interval trigger; NO remote / push (those need a server →
//     still gated §17). NO network, no AppData, no source-of-truth change.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const PKG = 'ios/packages/IronPathNotifications';
const PKG_SRC = `${PKG}/Sources/IronPathNotifications`;
const APP = 'ios/IronPath';
const DOC = 'docs/ios-native-migration/IOS_N1_LOCAL_REST_TIMER_NOTIFICATION_V1.md';

const exists = (p: string): boolean => existsSync(repoFile(p));
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const raw = (p: string): string => readFileSync(repoFile(p), 'utf8');
const code = (p: string): string => stripSwiftComments(raw(p));

// ---- 1-3. Package layout: Foundation-only, standalone ----

describe('N-1 IronPathNotifications package', () => {
  it('1. package files exist (Package.swift + version umbrella + policy + seam + adapter + tests)', () => {
    expect(exists(`${PKG}/Package.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/IronPathNotifications.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/RestReminderPolicy.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/RestReminderScheduling.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/UserNotificationsRestReminderScheduler.swift`)).toBe(true);
    expect(exists(`${PKG}/Tests/IronPathNotificationsTests/IronPathNotificationsTests.swift`)).toBe(true);
  });

  it('2. Package.swift is Foundation-only + standalone (iOS 17, one library, no package dependency, tools 5.9)', () => {
    const m = raw(`${PKG}/Package.swift`);
    expect(m).toMatch(/swift-tools-version:\s*5\.9/);
    expect(m).toMatch(/platforms\s*:\s*\[\s*\.iOS\(\s*\.v17\s*\)\s*\]/);
    expect((m.match(/\.library\(/g) ?? []).length).toBe(1);
    expect(m).toMatch(/\.library\(\s*name:\s*"IronPathNotifications"/);
    // Standalone — NO package dependency (remote or local-path). Keeps the import
    // graph (master §6.3) acyclic with no new edge.
    expect(m).not.toMatch(/\.package\s*\(/);
  });

  it('3. the version umbrella exports only the bootstrap version constant', () => {
    const m = code(`${PKG_SRC}/IronPathNotifications.swift`);
    expect(m).toMatch(/public\s+enum\s+IronPathNotificationsVersion\b/);
    expect(m).toMatch(/public\s+static\s+let\s+value\s*=\s*"0\.0\.1-bootstrap"/);
    const publicDecls = m.match(/^\s*public\s+(struct|class|enum|protocol|actor|func|var|let)\b/gm) ?? [];
    expect(publicDecls.length).toBeLessThanOrEqual(1);
  });
});

// ---- 4-6. Pure policy + seam ----

describe('N-1 pure scheduling policy + seam', () => {
  it('4. RestReminderPolicy is pure (role → recommended rest seconds; injected now → fire instant)', () => {
    const m = code(`${PKG_SRC}/RestReminderPolicy.swift`);
    expect(m).toMatch(/enum\s+RestReminderPolicy\b/);
    expect(m).toMatch(/func\s+recommendedRestSeconds\b/);
    expect(m).toMatch(/func\s+makeReminder\b/);
    // injected clock, not an inline Date()
    expect(m).toMatch(/now:\s*Date/);
    expect(m).not.toMatch(/Date\s*\(\s*\)/);
    // the value type is plain primitives
    expect(m).toMatch(/struct\s+RestReminderRequest\b/);
  });

  it('5. the seam protocol + authorization enum exist (LOCAL-only verbs)', () => {
    const m = code(`${PKG_SRC}/RestReminderScheduling.swift`);
    expect(m).toMatch(/protocol\s+RestReminderScheduling\b/);
    expect(m).toMatch(/enum\s+RestReminderAuthorization\b/);
    expect(m).toMatch(/func\s+requestAuthorization\b/);
    expect(m).toMatch(/func\s+schedule\b/);
    expect(m).toMatch(/func\s+cancel\b/);
  });

  it('6. the real adapter is #if os(iOS), uses a LOCAL time-interval trigger, and no remote push', () => {
    const m = code(`${PKG_SRC}/UserNotificationsRestReminderScheduler.swift`);
    expect(raw(`${PKG_SRC}/UserNotificationsRestReminderScheduler.swift`)).toMatch(/#if\s+os\(iOS\)/);
    expect(m).toMatch(/UNTimeIntervalNotificationTrigger\s*\(/);
    expect(m).not.toMatch(/\bregisterForRemoteNotifications\b/);
    expect(m).not.toMatch(/\bUNNotificationServiceExtension\b/);
    expect(m).not.toMatch(/\bPKPushRegistry\b/);
  });
});

// ---- 7-9. App layer: honest model + render-only section ----

describe('N-1 app layer', () => {
  it('7. RestReminderModel has an honest status enum + schedule/cancel + authorization', () => {
    const m = code(`${APP}/RestReminderModel.swift`);
    expect(m).toMatch(/enum\s+RestReminderStatus\b/);
    // honest states — no fake success
    expect(m).toMatch(/case\s+denied\b/);
    expect(m).toMatch(/case\s+failed\s*\(/);
    expect(m).toMatch(/case\s+scheduled\b/);
    expect(m).toMatch(/func\s+enableReminders\b/);
    expect(m).toMatch(/func\s+scheduleRestReminder\b/);
    expect(m).toMatch(/func\s+cancelRestReminder\b/);
  });

  it('8. RestReminderModel uses the package SEAM, never imports UserNotifications, never persists', () => {
    const m = code(`${APP}/RestReminderModel.swift`);
    expect(m).toMatch(/^\s*import\s+IronPathNotifications\b/m);
    // the app model NEVER imports the framework directly — only the package
    // adapter does (the #if os(iOS) construction is the one allowed reference).
    expect(m).not.toMatch(/^\s*import\s+UserNotifications\b/m);
    expect(m).not.toMatch(/\bUNUserNotificationCenter\b/);
    // in-RAM only — no disk egress
    expect(m).not.toMatch(/\bFileManager\b/);
    expect(m).not.toMatch(/\bUserDefaults\b/);
  });

  it('9. the section is render-only with a LOCAL-only / no-remote-push disclaimer (Chinese-first)', () => {
    expect(exists(`${APP}/RestReminderSection.swift`)).toBe(true);
    const m = raw(`${APP}/RestReminderSection.swift`);
    expect(m).toMatch(/struct\s+RestReminderSection\b/);
    expect(m).toMatch(/无远程推送/);
    expect(/[一-鿿]/.test(m)).toBe(true);
  });
});

// ---- 10. Shell wiring: opt-in + schedule on complete + cancel ----

describe('N-1 shell wiring', () => {
  const shell = (): string => code(`${APP}/FocusModeShellView.swift`);

  it('10. the shell opts into the live scheduler on launch and wires schedule/cancel', () => {
    const s = shell();
    // owns the model + opts in from the launch .task (after loadSavedSessions)
    expect(s).toMatch(/@StateObject\s+private\s+var\s+restReminder\s*=\s*RestReminderModel\s*\(/);
    expect(s).toMatch(/\.task\s*\{[\s\S]*restReminder\.activateLiveSchedulerIfNeeded\s*\(/);
    // a completed set schedules; navigation/end/complete/reset cancel
    expect(s).toMatch(/restReminder\.scheduleRestReminder\s*\(/);
    expect(s).toMatch(/restReminder\.cancelRestReminder\s*\(/);
    // the section is mounted in-session
    expect(s).toMatch(/RestReminderSection\s*\(\s*model:\s*restReminder\s*\)/);
  });
});

// ---- 11. Documentation ----

describe('N-1 docs', () => {
  it('11. the N-1 doc exists and records local-only + permission/privacy + remote-push forbidden + a Simulator smoke checklist', () => {
    expect(exists(DOC)).toBe(true);
    const doc = raw(DOC);
    expect(doc).toMatch(/[Ss]imulator smoke/);
    expect(doc).toMatch(/local-only|local only|仅本地|本地/);
    expect(doc).toMatch(/remote|push|远程|推送/i);
    expect(doc).toMatch(/permission|authorization|privacy|授权|隐私/i);
  });
});
