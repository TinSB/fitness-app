# N-1 — Local Rest-Timer Notification V1

> **Status: shipped.** First **local-notification** capability ungating. Approved by the
> architecture owner per `docs/ios-native-migration/IOS_NATIVE_CAPABILITY_UNGATING_ROADMAP_V1.md`
> §4.2 (local notifications — local only). This slice amends the binding contract
> `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` **§2 / §5 / §6.1 / §6.3 / §16 / §17 / §18 / §27**
> in the same PR (master §1.1).
>
> **Baseline:** latest `origin/main` (HK-1 #428 + the ungating roadmap #429).

## 1. What this unlocks

After the user authorizes notifications, completing a set in the native Focus session
schedules a **local** reminder that fires after the recommended rest duration ("休息结束 ·
开始下一组"). Switching exercises, ending, completing, or resetting the session cancels the
pending reminder. There is only ever **one** pending rest reminder at a time.

This is **local only**. There is **no remote / push notification**, no APNs, no
`aps-environment` entitlement, no notification-service-extension, no PushKit, and no
network. Remote push needs a server and **remains gated** (master §17).

## 2. Architecture (HK-1 paradigm: protocol seam + `#if os(iOS)` real impl)

A new **Foundation-only, standalone** Swift package `IronPathNotifications`
(`ios/packages/IronPathNotifications`) — the 11th local package. It is decoupled from
`IronPathDomain` / `IronPathTrainingDecision`: the policy maps an exercise-role **rawValue
`String`** to a recommended rest, so the import graph (master §6.3) gains **no** edge.

| File | Role |
| --- | --- |
| `Sources/IronPathNotifications/IronPathNotifications.swift` | Version umbrella only (`IronPathNotificationsVersion = "0.0.1-bootstrap"`) — the per-package bootstrap-probe convention. |
| `RestReminderPolicy.swift` | **Pure** policy + value type. `RestReminderRequest` (id / fireDate / secondsFromNow / title / body); `recommendedRestSeconds(for:)` (compound 180s / accessory 90s / isolation 60s); `makeReminder(now:restSeconds:exerciseName:nextSetNumber:)` (injected clock → fire instant; `nil` for non-positive rest). No UserNotifications import. |
| `RestReminderScheduling.swift` | The injectable **seam**: `RestReminderScheduling` protocol (`requestAuthorization` / `schedule` / `cancel`) + `RestReminderAuthorization` enum. LOCAL-only verbs. |
| `UserNotificationsRestReminderScheduler.swift` | The **real** `UNUserNotificationCenter` adapter — the **only** file that imports `UserNotifications`, compiled **`#if os(iOS)`** (host `swift test` excludes it). Schedules a one-shot **local** `UNTimeIntervalNotificationTrigger`. No remote-push registration. |
| `Tests/IronPathNotificationsTests/IronPathNotificationsTests.swift` | Unit tests for the pure policy (injected clock → deterministic fire instant; role → rest seconds; non-positive → `nil`) + a host fake exercising the seam. |

App layer (`ios/IronPath/`, thin per master §15):

- `RestReminderModel.swift` — `@MainActor ObservableObject` mirroring `HealthKitBodyWeightImportModel`. Honest status (`idle` / `unavailable` / `requesting` / `enabled` / `scheduled` / `denied` / `failed`), opts into the real scheduler `#if os(iOS)` on launch, delegates to the package seam. **Never imports UserNotifications; never touches FileManager / UserDefaults** (the on/off + status is in-RAM, resets on relaunch — by design for this first slice).
- `RestReminderSection.swift` — render-only in-session card: the authorization button + the honest status line + the local-only disclaimer.
- `FocusModeShellView.swift` — owns `@StateObject restReminder`, opts in from the launch `.task`, schedules on set completion, and cancels on exercise-switch / end / complete / reset.

## 3. Permission & privacy

- **User-gated.** Reminders are off by default. The "开启组间休息提醒" button requests
  `UNUserNotificationCenter` authorization (`[.alert, .sound]`); a denial is surfaced
  honestly (`.denied`) — never a fake "on".
- **No usage-description / entitlement required.** Local notification scheduling needs no
  Info.plist usage key and no entitlement (only **remote** push needs `aps-environment`,
  which is forbidden here). `project.pbxproj` is edited only to register the new package +
  the 2 new app files.
- **On-device.** Nothing leaves the device; the reminder content is built on-device from
  the local session state. No telemetry, no network.

## 4. Source-of-truth & data safety

- **None.** Notifications do not persist training data, never read or write `AppData`, never
  touch the source-of-truth boundary, and do not change any schema. The engine and parity
  goldens are untouched (the recommended rest is a small local UX default, not an engine
  output).

## 5. Static guards (master §22)

- `tests/iosBootstrapForbiddenImports.test.ts` — confines `import UserNotifications` /
  `UNUserNotificationCenter` / `UNMutableNotificationContent` / `UNNotificationRequest` /
  `UNTimeIntervalNotificationTrigger` to the single adapter file; **bans** the remote-push
  tokens (`registerForRemoteNotifications`, `didRegisterForRemoteNotificationsWithDeviceToken`,
  `UNNotificationServiceExtension`, `PushKit`, `PKPushRegistry`) **everywhere**; asserts the
  adapter is local-only and `#if os(iOS)`.
- `tests/iosBootstrapPackageGraph.test.ts` / `tests/iosBootstrapTargetSettings.test.ts` —
  add `IronPathNotifications` (Foundation-only; 11th `XCLocalSwiftPackageReference` + product
  dependency).
- `tests/iosLocalRestTimerNotificationStaticGuards.test.ts` — the dedicated N-1 boundary:
  package layout / Foundation-only, pure policy + seam, `#if os(iOS)` local adapter, honest
  app model (no UserNotifications import, no disk), shell wiring, and this doc.

## 6. Validation

- `swift test --package-path ios/packages/IronPathNotifications` (pure policy + seam; the
  `#if os(iOS)` adapter is excluded on host).
- `npm run api:dev:build && npm run typecheck && npm test && npm run build`.
- `git diff --check`; `package.json` / `package-lock.json` byte-identical (no dependency drift).
- `xcodebuild` both destinations (`generic/platform=iOS` + `iPhone 17 Pro` Simulator),
  `CODE_SIGNING_ALLOWED=NO`.

## 7. Manual Simulator smoke checklist

Run the app in the iPhone 17 Pro Simulator and confirm:

1. Start a session (训练 tab → 开始训练). The "组间休息提醒" card shows the off state with the
   local-only disclaimer.
2. Tap "开启组间休息提醒" → the system local-notification permission prompt appears. Allow it →
   status shows "已开启".
3. Complete a set ("完成本组") on an exercise that still has remaining sets → status shows
   "已安排：约 N 后提醒". After the rest interval, the local notification fires on-device.
4. Complete another set, then tap "下一动作" / "上一动作" → the pending reminder is canceled
   (status returns to "已开启").
5. End the session ("结束训练" / 返回) or finish it ("完成本次训练") → any pending reminder is
   canceled.
6. Deny the permission instead (fresh install) → status shows the honest "通知未授权" line; no
   reminder is scheduled.
7. Confirm there is **no** network activity and **no** remote/push behaviour — reminders are
   purely local.

## 8. Follow-ups (deferred)

- **N-2** — workout reminders (local schedule/cancel), same local-only boundary.
- Remote / push notifications remain **forbidden** (server required → master §17).
