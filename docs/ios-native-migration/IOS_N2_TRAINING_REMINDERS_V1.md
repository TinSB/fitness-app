# N-2 — Training Reminders V1

> **Status: shipped.** Local **weekly training reminders**, the second local-notification
> slice. **Within the already-ungated local-notification boundary** (master §16/§17/§18,
> ungated by N-1): a *capability refinement, NOT an expansion* — still local-only, no
> network, no remote/push. Pre-sanctioned by the ungating roadmap
> `docs/ios-native-migration/IOS_NATIVE_CAPABILITY_UNGATING_ROADMAP_V1.md` §4.2 ("切片：…
> `N-2` 训练提醒（本地排程/取消）") and the prior master §27 "Next" list. This slice makes a
> same-PR *textual* refinement to the binding contract `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> **§6.1 / §16 / §17 / §18 / §27** (master §1.1) to broaden the N-1 wording (which was
> scoped to "rest-timer / `UNTimeIntervalNotificationTrigger`") so it also covers the
> repeating weekly training reminder. No boundary moves.
>
> **Baseline:** latest `origin/main` (W-1 #431).

## 1. What this unlocks

In the **我的 (Profile)** tab, a new **训练提醒 (Training reminder)** card lets the user, after
authorizing notifications, pick **weekdays + a time** and arm a **repeating weekly LOCAL
reminder** ("训练提醒 · 该训练了，开始今天的训练吧。"). The reminder repeats every week on the
selected weekdays at the chosen time. Turning it off cancels every reminder. The card shows
the current state read back **honestly** from the notification center.

This is **local only**. There is **no remote / push notification**, no APNs, no
`aps-environment` entitlement, no notification-service-extension, no PushKit, and no
network. Remote push needs a server and **remains gated** (master §17).

## 2. Architecture (reuses the N-1 paradigm: pure policy + seam + `#if os(iOS)` impl)

No new package and **no `project.pbxproj` change**: the work is added to the existing
Foundation-only `IronPathNotifications` package (its sources are SPM-auto-included) and a
**single existing app file** (`ProfileRootView.swift`).

| File | Role |
| --- | --- |
| `IronPathNotifications/.../TrainingReminderPolicy.swift` *(new)* | **Pure** policy + value types. `TrainingReminderRequest` (per-weekday repeating request: id / weekday / hour / minute / title / body), `TrainingReminderSchedule` (armed weekdays + time), `PendingTrainingReminder` (the primitives the adapter extracts to reconstruct the schedule). `makeReminders(weekdays:hour:minute:)` → sorted per-weekday requests (validates ranges; empty → nothing scheduled). `nextFireDate(weekdays:hour:minute:now:calendar:)` → the next fire instant from an **injected** `now`/`Calendar` (deterministic, no wall clock). `schedule(fromPending:)` → reconstruct the live schedule. No UserNotifications import. |
| `IronPathNotifications/.../TrainingReminderScheduling.swift` *(new)* | The injectable **seam**: `TrainingReminderScheduling` (`requestAuthorization` / `replaceReminders` / `pendingSchedule` / `cancelAll`). LOCAL-only verbs. Reuses N-1's `RestReminderAuthorization` (same local-notification authorization result — no duplicate enum). |
| `IronPathNotifications/.../UserNotificationsRestReminderScheduler.swift` *(extended)* | Now hosts **both** local schedulers. The new `UserNotificationsTrainingReminderScheduler` schedules one **repeating** `UNCalendarNotificationTrigger(repeats: true)` per selected weekday, reads pending back into a `TrainingReminderSchedule`, and cancels only our reminders. It is co-located here **on purpose** — the **only** file that imports UserNotifications / touches `UNUserNotificationCenter`, compiled **`#if os(iOS)`** (host `swift test` excludes it). No remote-push registration. |
| `IronPathNotificationsTests.swift` *(extended)* | Unit tests for the pure policy with an **injected fixed-timezone `Calendar` + fixed `now`** (deterministic next-fire), the weekday/time → requests mapping, input validation, identifier round-trip, schedule reconstruction, and a host fake exercising the seam (replace / read-back / cancel). |

App layer (`ios/IronPath/ProfileRootView.swift`, thin per master §15):

- `TrainingReminderModel` — `@MainActor ObservableObject`, co-located in `ProfileRootView.swift`
  (mirrors N-1's `RestReminderModel`). Honest status (`idle` / `unavailable` / `requesting` /
  `authorized` / `scheduled` / `denied` / `failed`), opts into the real scheduler `#if os(iOS)`,
  delegates to the package seam + pure policy. **Never imports UserNotifications; never touches
  FileManager / UserDefaults** — the picker state is in-RAM and re-seeded from the live pending
  schedule on appear (iOS persists the repeating notifications, the app keeps no schedule).
- `TrainingReminderCard` — render-only card: the authorization button, a weekday multi-select,
  a `DatePicker(.hourAndMinute)`, save / 关闭 buttons, the honest status line (incl. the next-fire
  time), and the local-only / no-remote-push disclaimer.

To keep the change to **one app file** (the task's preference) and avoid a `project.pbxproj`
edit, the model + card are co-located in `ProfileRootView.swift` rather than split into their
own files; the view struct stays a thin renderer.

## 3. The schedule lives in iOS, not the app (no-disk boundary)

The reminder repeats **weekly** via `UNCalendarNotificationTrigger(repeats: true)`. **iOS itself
persists the repeating notifications** — so the app stores **no** schedule of its own (respecting
the `ios/IronPath` no-disk boundary: no `UserDefaults`, no files). The current "set / not-set"
state is always **read back** from `UNUserNotificationCenter.pendingNotificationRequests()` and
reconstructed by the pure `TrainingReminderPolicy.schedule(fromPending:)`. Stable per-weekday
identifiers (`ironpath.local.training-reminder.<weekday>`) mean re-saving **replaces** (a
de-selected weekday is dropped, never duplicated) and our reminders are told apart from the N-1
rest reminder.

## 4. Permission & privacy

- **User-gated.** Reminders are off by default. "开启训练提醒" requests `UNUserNotificationCenter`
  authorization (`[.alert, .sound]`, the same paradigm as N-1); a denial is surfaced honestly
  (`.denied`) — never a fake "on".
- **No usage-description / entitlement required.** Local notification scheduling needs no
  Info.plist usage key and no entitlement (only **remote** push needs `aps-environment`, which is
  forbidden here). `project.pbxproj` is **not** edited.
- **On-device.** Nothing leaves the device; the reminder content is built on-device. No
  telemetry, no network.

## 5. Source-of-truth & data safety

- **None.** Reminders do not persist training data, never read or write `AppData`, never touch the
  source-of-truth boundary, and do not change any schema. The engine and parity goldens are
  untouched (a reminder time is a small local UX choice, not an engine output).

## 6. Static guards (master §22)

- `tests/iosBootstrapForbiddenImports.test.ts` — confines the new `UNCalendarNotificationTrigger`
  to the single adapter file (alongside the N-1 local tokens); the remote-push tokens stay banned
  everywhere.
- `tests/iosTrainingReminderNotificationStaticGuards.test.ts` *(new)* — the dedicated N-2
  boundary: pure policy (injected `Calendar`, no inline `Date()`), the seam (LOCAL verbs, reuses
  N-1 authorization), the repeating `UNCalendarNotificationTrigger(repeats: true)` adapter (the
  sole holder of that token, `#if os(iOS)`, no remote push), the honest app card (no
  UserNotifications import, no disk), and this doc.

## 7. Validation

- `swift test --package-path ios/packages/IronPathNotifications` (pure policy + seam; the
  `#if os(iOS)` adapter is excluded on host).
- `npm run api:dev:build && npm run typecheck && npm test && npm run build`.
- `git diff --check`; `package.json` / `package-lock.json` byte-identical (no dependency drift).
- `xcodebuild` both destinations (`generic/platform=iOS` + `iPhone 17 Pro` Simulator),
  `CODE_SIGNING_ALLOWED=NO`.

## 8. Manual Simulator smoke checklist

Run the app in the iPhone 17 Pro Simulator and confirm:

1. Go to the 我的 (Profile) tab. The "训练提醒" card shows the off state with the local-only
   disclaimer.
2. Tap "开启训练提醒" → the system local-notification permission prompt appears. Allow it → the
   weekday chips + the time picker appear.
3. Select a couple of weekdays + a time, tap "保存提醒" → the status shows "已设 · 每周 … · 下次：
   …". (On a device/Simulator, the repeating notification fires at the next matching weekday/time.)
4. Re-open the app (or the tab) → the card reflects the **persisted** schedule read back from the
   notification center (the app stored nothing itself).
5. De-select a weekday and tap "保存提醒" again → the schedule updates (the dropped weekday is
   removed, never duplicated).
6. Tap "关闭训练提醒" → all training reminders are canceled; status returns to "已授权".
7. Deny the permission instead (fresh install) → status shows the honest "通知未授权" line; no
   reminder is scheduled.
8. Confirm there is **no** network activity and **no** remote/push behaviour — reminders are
   purely local and repeating.

## 9. Follow-ups (deferred)

- Remote / push notifications remain **forbidden** (server required → master §17).
- Richer scheduling (multiple times/day, per-weekday times) can extend the same local boundary.
