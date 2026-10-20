# Rede Master Technical Architecture

> **This is the canonical, highest-level engineering contract for Rede.**
> Every human and every AI agent must read this document before making changes and must obey it. If a requested task conflicts with this document, stop and require explicit architecture approval before writing code.

- **Status:** Authoritative / binding
- **Version:** 3.9
- **Last updated:** 2026-10-19 (v3.9 amendment: watch-side provisional rest countdown, logged-set `sendMessage` wake copy; v3.8 of 2026-10-17: phone-initiated watch workout launch, iPhone read-only session vitals; v3.6 + v3.7 of 2026-10-14: bounded Apple Watch companion / WatchConnectivity boundary, watch HealthKit workout-session exception, bounded rest Live Activity / ActivityKit, single authority over CRDT co-editing for the watch, required watchOS build; plus dated status notes on the Readiness widget)
- **Repository:** `TinSB/fitness-app` (the GitHub slug is still `fitness-app`; the product and local working dir are `Rede`)
- **v3.0 amendment:** established a clean code rewrite baseline, written cleanly against the manifest-registered living docs (especially `docs/REDE_iOS_SYSTEM_LOGIC.md`) instead of extending or porting the polluted legacy implementation.
- **v3.1 amendment (2026-06-13):** the clean rewrite is now the **active implementation**. `ios/Rede` has been a clean app shell since M0-1, and the MVP training loop had shipped through milestones M0–M6 (with M6-4 TestFlight upload still open at that dated snapshot). The boundaries and contracts below still bind; where this doc previously said "ios/ is reference-only / not yet implemented," read it as describing the **retired IronPath/PWA-era code** (removed during M1-0, preserved at git tag `legacy-parity-final`), not the then-current clean `ios/Rede` + 7 in-tree packages. Current inventory is recorded by v3.3 and the tables below.
- **v3.2 amendment (2026-07-17):** approved the subscription architecture boundary without implementing it: StoreKit 2 behind a thin future `RedeEntitlements` package, Apple-verified transactions as entitlement truth, no RevenueCat/account/server/remote analytics in the first slice, and no entitlement state in canonical AppData. Product boundary A is binding: everything already available in Rede 1.8 remains Free Core; only capabilities added after 1.8 may be proposed as Paid Coach features through an explicit PRD amendment.
- **v3.3 implementation reconciliation (2026-07-18):** the bounded subscription foundation now exists as the tenth in-tree package. It includes pure access policy, StoreKit 2 product/transaction/restore adapters, a process-lifetime entitlement model, expiration and foreground revalidation, stale-query protection, a package-owned `SubscriptionStoreView` wrapper, Settings plan state, a non-transactional Rede Coach page shell, a fail-closed production launch gate, and local-only monthly/annual StoreKit fixtures. The branded page shell may remain visible while blocked, but Apple product, price, trial, renewal, restore, and purchase controls appear only after the gate is ready. The production `Rede` scheme is isolated from the dedicated `Rede-StoreKitTest` scheme, and CI runs an app-hosted production fail-closed XCTest in addition to all package tests and the generic build. Production purchase presentation remains disabled because no post-1.8 Paid Coach capability, App Store Connect product configuration, final pricing/trial, or validated current Privacy/Terms destinations have been approved. The Xcode 26.6 + iOS 26.5 Simulator StoreKitTest service still returns `SKInternalErrorDomain Code=3` while saving an Apple-v6.3-aligned configuration, so full purchase/renewal/refund lifecycle and Sandbox/TestFlight acceptance remain release blockers.
- **v3.4 implementation reconciliation (2026-07-18):** the first approved post-1.8 capability, `Weekly Coach Review` (FR-SUB3), is now implemented end to end behind verified Paid Coach access. A pure typed engine in `RedeTrainingDecision` consumes narrowly projected, clean prior-week facts; dated dropped-training findings and suspect sets fail closed before a positive trend can be shown; `RedeL10n` owns the approved bilingual states and actions; the app renders the review without persisting a second truth source. Active/grace entitlements retain access even if the purchase catalog or policy configuration is unavailable, while free/checking/unknown/expired/refunded states never receive the paid result. Checking and unknown entitlement states also never reach the purchase surface even if the product gate is already ready; an expired entitlement is presented as Free Core. Local package/app tests, the authoritative quality gate, Release build, and iPhone 17 Pro Simulator flows cover the Chinese empty state to Today, English data-review state to Progress, production Free Core preview, accessibility labels, maximum Dynamic Type, and Reduce Motion. These are L3 local implementation/UX evidence only. Production purchase presentation remains disabled until real App Store Connect products, current policy destinations, a working StoreKit lifecycle environment, and Sandbox/TestFlight acceptance exist; the current `SKInternalErrorDomain Code=3` blocker is unchanged.
- **v3.5 amendment (2026-07-18):** approved one narrow App Store update-awareness boundary. The app may make an anonymous, throttled HTTPS GET to Apple's public App Store Lookup catalog using Rede's public app ID, then locally validate the expected bundle ID, solely to compare the installed marketing version with the public store version. Pure version/cadence/snooze policy belongs in `RedeDomain`; the `URLSession` adapter remains in the thin app platform layer. The response is optional presentation input, never product, entitlement, training, or canonical truth. Invalid data, timeout, offline state, an older/equal store version, or any service failure produces no automatic prompt and never blocks launch, training, saving, export, or subscription access. No Rede server, remote config, push, analytics, device identifier, authentication, remote release copy, forced update, or in-app binary updater is authorized. Loss-tolerant UI receipts for last check, per-version snooze, and last-seen What's New may use namespaced `UserDefaults`; they are not canonical data and may be discarded safely.
- **v3.5 implementation reconciliation (2026-07-18):** FR-SE10 now exists in the clean app. `RedeDomain` owns numeric marketing-version comparison, rolling 24-hour automatic-attempt cadence, and version-scoped seven-day snooze; the app target owns the injectable, non-redirecting Apple Lookup adapter, shared in-flight request, loss-tolerant receipts, Settings rows, non-blocking Today signal, and built-in bilingual What's New. Automatic failures remain silent, explicit failures remain honest, a launch that still needs onboarding conservatively records the current release without presenting, and any other installed-version change presents matching bundled notes once. This means the rare upgrader who never completed onboarding also skips that one automatic sheet, while the permanent Settings entry remains available. Targeted domain/app/localization tests and real iPhone 17 Pro / iOS 26.5 Simulator flows covered current/available/unavailable fixtures, Later, Settings, both locales, maximum Dynamic Type, first install, and an active-training launch. Simulator interaction exposed an observation bug where Later persisted but did not immediately dismiss the signal; a failing observation test now locks the repair. Independent review additionally locked reverse automatic/manual request ordering, stale Settings-result invalidation, exact app-ID/bundle/version response identity, duplicate-record rejection, redirect refusal, and a release guard requiring the current marketing version to have bundled bilingual notes. This is local L3 behavior evidence only: it does not prove a live Apple catalog response, App Store propagation, or TestFlight behavior, and it cannot retroactively notify users running the old 1.8 binary.
- **2026-10-14 status reconciliation — watchOS, Readiness widget, rest Live Activity (WATCH-10; records reality, amends nothing):** verified against the code at `e94cc09` and the history of #431, #550, #701/#704, #719, #732–#748 and #751.
  - *Readiness widget — inside this contract.* `ios/RedeWidget` (target `RedeWidgetExtension`, embedded in the app) is a live production surface, not reference material. Its Readiness widget is a `StaticConfiguration` limited to `.systemSmall` / `.systemMedium` (no lock-screen or accessory family) and only reads a derived schema-v1 `ReadinessWidgetSnapshot` from the App Group `group.com.tinsab.rede`. The app's only writer is `SessionStore.loadToday()` → `refreshWidgetSnapshot()`, which writes only when Today resolves to a readable result and then reloads widget timelines. Nothing else uses the App Group (the watch has none). This matches the §9 WidgetKit and App Group lines. The §5 `RedeWidgetShared` row was incomplete as written until v3.7 completed it; see the dated inventory under §5.
  - *Rest Live Activity (FR-TR13, since 1.7 / build 24) — not named by this contract until the v3.7 amendment below.* The same extension hosts an `ActivityConfiguration` for `RestActivityAttributes` (lock screen + Dynamic Island). ActivityKit is imported in three places: the app-target `RestLiveActivityController` (thirteen lifecycle endpoints, `pushType: nil`, `staleDate` = rest end + 60 s, one serialized task chain), the iOS-only `RestActivityAttributes` file in `RedeWidgetShared`, and the widget-target UI. It is local-only and display-only and never writes canonical data. Before v3.7, ActivityKit appeared in neither the §9 allowed list nor the forbidden list (it was mentioned only in these dated notes), and the app-target import fell outside the literal WidgetKit wording; v3.7 added it to the §9 allowed list.
  - *Apple Watch — built without an amendment; its WatchConnectivity / companion architecture is approved by v3.6 and its HealthKit workout session by v3.7 (amendments below).* A watchOS 10 companion app `ios/RedeWatch` (bundle `com.tinsab.rede.watchkitapp`, embedded through Embed Watch Content, shared scheme `RedeWatch`) and the package `RedeWatchLink` (iOS 17 + watchOS 10; the only `WatchConnectivity` importer) were built in #732–#740 (2026-08-15…18) and iterated in #746/#748/#751. The watch app has been embedded in the iPhone app since #732, at 1.10.2 (build 36); #733's commit records that build 36 went to TestFlight. 1.11.0 (build 38, bumped in #743 on 2026-08-20) is the first marketing version raised for it and the release whose store copy introduces it (#747). The owner's WATCH-10 finding says the watch shipped with 1.11.0; the repo holds no 1.11.0 upload or release record. The quality gate requires App, Widget and Watch versions to match. No commit from #732 onward edited this document. As-built behaviour at the time of this reconciliation (the single-authority, channel, set-intake / canonical-write and no-watch-storage points of items (1)–(5) are codified as rules by the v3.6 §5 Apple Watch Companion Boundary; item (6), except the whole-app permission gate (an owner product ruling of 2026-08-16, #737, carried by PRD FR-AW3), is codified by v3.7 as §5 rule 10; the remaining implementation details stay descriptive): (1) the phone is the only decision maker — the watch recomputes no prescription, renders phone-formatted strings, and never advances a set on its own. This holds by code convention, not by linkage: the watch target links `RedeDomain`, `RedeDataHealth`, `RedePersistence`, `RedeTrainingDecision`, `RedeLocalSnapshot`, `RedeL10n` and `RedeWatchLink`, but imports only `RedeL10n`, `RedeWatchLink` and `RedeTrainingDecision` (using only `RestCountdown`); (2) phone → watch uses only `updateApplicationContext`, carrying one phone-rendered `WatchPrescription`; applicationContext is a single latest-value slot, so today every phone → watch field rides in that one payload, and a second applicationContext sender would overwrite the prescription; (3) watch → phone logged sets use `transferUserInfo` (queued, guaranteed delivery), never `sendMessage`; the phone accepts only the set it is currently waiting for (idempotency key `exerciseId` + `setNumber`). With a live phone flow it goes through the existing in-session `apply(.logSet)` path. With no live flow, a watch-specific draft write path (`appendWatchSetToDraft`) replays the durable, non-canonical `active-session-draft.json`, appends a synthesized `.restFinished` if the replay is resting, appends the set and saves the draft. Watch sets reach canonical AppData only through the phone's existing completion path (`CanonicalSessionWriter.appendCompletedSession`); no canonical writer or canonical mutation class was added; (4) watch → phone rest/skip commands use `sendMessage` and work only while the phone is reachable (an automatic rest-end skip from the watch can advance the phone flow while the phone app is alive in the background with a live flow); (5) the watch keeps no data of its own (no App Group, files or `UserDefaults`), and its only persisted output is the Health data in (6): the workout itself (whether heart-rate / energy samples are saved with it is unverified); (6) the watch target imports HealthKit directly: an `HKWorkoutSession` with `HKLiveWorkoutBuilder` follows the phone's `trainingInProgress` flag and keeps the watch app alive. It requests share access for workouts and read access for heart rate and active energy; only heart rate and elapsed time are displayed, on the watch. It writes the workout to Apple Health when that flag turns off (normally when the phone reaches the session summary), except in two cases where it discards the workout and writes nothing: the phone reports an abandoned session, or a set/rest screen has had no phone update for 60 minutes. The whole watch app sits behind a Health workout-write permission gate. None of that HealthKit data reaches the phone, AppData or any engine.
  - *Open conflicts — deliberately not resolved by this reconciliation.* (a) watchOS / WatchConnectivity was "Deferred" in §2 and "Forbidden without amendment" in §9, yet the runtime existed — **resolved by the v3.6 amendment below**; (b) the watch's HealthKit use sits outside `RedeHealthKit` (§9) and performs the HKWorkout write that §5 lists as deferred; (c) ActivityKit is used but named in neither §9 list; (d) the as-built phone-authoritative watch design differs from the CRDT co-editing direction recorded in `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` §4. The reconciliation itself left the §2, §5 and §9 contract text unchanged and added only dated notes; the v3.6 amendment below, also dated 2026-10-14, then amended §2, §4, §5, §6 and §9 for conflict (a) only. Each conflict was put to the owner as a proposed amendment (A–E, listed in `DEV_LOG.md` 2026-10-14 and the reconciliation PR). The owner approved A on 2026-10-14 (v3.6), then B–E the same day (v3.7), which resolves (b), (c) and (d) and proposal E.
  - *Adjacent drift, not reconciled here.* `RedeSync` and `RedeSyncSupabase` (cloud sync, FR-ACC1, #727, 1.10.0) are also on disk and in the CI matrix without an amendment, and they conflict in the same way with the §9 Supabase, `URLSession` and account/auth entries and with the §2 Deferred systems row (account, cloud sync). They need their own reconcile.
- **v3.6 amendment (2026-10-14, owner approval of proposal A, WATCH-10):** approved watchOS and WatchConnectivity as one bounded integration: the `RedeWatch` companion app embedded in the iPhone app plus the shared `RedeWatchLink` package, under the channel discipline that the existing code already follows (§5 Apple Watch Companion Boundary, §9). The phone remains the only decision maker and the only canonical writer; the watch is a remote control for the live training session. This ratifies the existing companion / WatchConnectivity architecture and binds all further watch work to it; no code changed. The amendment did **not** decide: the watch target's direct HealthKit use and HKWorkout write (open conflict (b) — §9 "HealthKit only inside `RedeHealthKit`" then still stood), ActivityKit (c), whether the single-authority design supersedes the CRDT co-editing direction in `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` (d — concurrent multi-writer editing then stayed deferred), or PRD scope and a required `RedeWatch` CI build (proposal E); v3.7 below decided all four.
- **v3.7 amendment (2026-10-14, owner approval of proposals B–E, WATCH-10):** the owner approved the four remaining proposals (「bcde都做」). (B) The watch target's HealthKit workout session becomes a narrow, named exception to "HealthKit only inside `RedeHealthKit`" (§5 Apple Watch rule 10, §9); the iPhone stays limited to `RedeHealthKit`'s read-only body weight. (C) ActivityKit joins the §9 allowed list, bounded to the existing local-only, display-only rest Live Activity. (D) The single-authority phone ↔ watch design supersedes the CRDT concurrent co-editing direction for the watch (§5 Apple Watch rule 11; `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` amended); CRDT stays deferred, and its recorded direction for future cloud sync is unchanged. (E) The PRD gains watch requirements FR-AW1–3 and drops watchOS from its first-version non-goals and the R4+ mapping, and CI plus the local quality gate build the `RedeWatch` scheme for a generic watchOS Simulator destination (§10). The iPhone's `NSHealthUpdateUsageDescription` still says Rede writes nothing to Apple Health; correcting that user-visible string is a runtime change outside this amendment (the unmerged PR #749 carries a proposed rewrite).
- **v3.8 amendment (2026-10-17, owner delegation of 2026-10-17 「能你自己解决就自己解决」):** two iPhone-side HealthKit uses join the boundary. Both live inside `RedeHealthKit`, and neither writes anything to Apple Health. (1) **Phone-initiated watch workout launch** (§5 Apple Watch rule 13). When the phone starts a session and a paired watch with Rede installed is present, the phone calls `HKHealthStore.startWatchApp(toHandle:)` through the new `WatchWorkoutLaunching` seam. The watch app launches or wakes and starts its rule-10 session without the user opening it. The owner raised this because he was still opening Apple's Workout app by hand for every session. The request carries no Rede data, asks for no iPhone HealthKit authorization, and fails silently: the failure goes to the system log only, and the watch app still works when opened by hand. (2) **Read-only session vitals** (PR #749, own workout record A2+B). The iPhone reads the workout type, heart rate and active energy, so the phone's single-session record can show the heart-rate curve and energy of the workout that the watch wrote. The data is display-only, never canonical and never engine input, and `toShare` stays empty. The iPhone still writes nothing to Apple Health. Workout import into AppData and iPhone HKWorkout writes remain deferred.
  - *Status (2026-10-17):* (1) ships in the v3.8 PR. (2) is approved here, and its code (`SessionVitalsReading` + `HKSessionVitalsReader`) ships in PR #749. The two PRs can merge in either order. Until #749 is on `main`, `RedeHealthKit` contains only the body-weight reader and the watch launcher.
- **v3.9 amendment (2026-10-19, owner approval 「两条都改」 of the two-rule question asked that day):** owner field report — with the phone locked in a pocket, tapping "complete set" on the watch did not start the rest countdown until the phone was opened, because the logged set rides the queued channel and a suspended iPhone app is not woken by it. Two §5 Apple Watch rules change; everything else in the boundary stands. (1) **Rule 4:** logged sets still always travel over `transferUserInfo` (delivery guarantee unchanged); while the phone is reachable the watch *additionally* sends the identical envelope over `sendMessage`, solely to wake the suspended phone app. The phone accepts at most one copy: the existing exact-set guards plus an in-memory identity key (`exerciseId` + `setNumber` + `isWarmup` + `loggedAtISO`) that also blocks a late duplicate after an undo. On a watch-originated envelope the phone holds a short background-task assertion so the reducer, rest start and prescription push finish before suspension. (2) **Rule 6:** the watch may show a **provisional rest countdown** the moment it logs a working set — in memory only (`ProvisionalRest` in `RedeWatchLink`), for the phone-computed duration carried in the prescription (`Active.restAfterSetSeconds`, from the phone's own reducer on a copy of the flow, so a session-final set carries none), with a phone-rendered, target-free preview. It is replaced by the phone's authoritative rest as soon as a push shows the phone has moved past that set. The watch still never chooses a rest length, a next set, a load or when to advance: its countdown end only sends the existing `restSkip(auto:)` intent, which the phone honours only against its own clock. The phone now anchors a watch-logged set's rest at the watch's `loggedAtISO` (clamped to now) instead of receipt time, so both rings end together. Status: ships in PR feat/watch-instant-rest-gestures together with the FR-AW5 double-tap binding and the watch layout pass (PRD §5.11).

---

## 1. Authority

This document is the single source of architectural truth for Rede. It outranks every other repo document on:

- source-of-truth boundaries
- package boundaries
- persistence and write paths
- platform permissions
- validation expectations
- forbidden dependencies and systems

It does not outrank explicit, in-the-moment human approval that knowingly amends this file. Such an amendment must be written back into this file in the same change.

---

## 2. Clean Rewrite Baseline

| Area | Baseline |
|---|---|
| Product truth | `docs/REDE_iOS_SYSTEM_LOGIC.md` plus the other manifest-registered living docs. |
| Code status | The clean `ios/Rede` app (with its widget extension and the `RedeWatch` companion app, approved by v3.6) + the approved in-tree Swift packages listed in §5 are the active implementation (M0–M6 shipped plus the fail-closed subscription foundation). Retired IronPath/PWA-era code is reference-only (git tag `legacy-parity-final`) and is not a contract. |
| Target runtime | A clean native iOS SwiftUI app with local Swift packages and local-first persistence. |
| Target source of truth | A single canonical local AppData model, persisted through a gated write path. |
| Target engine boundary | Raw AppData never enters training engines; engines consume clean typed inputs. |
| Target platform scope | Foundation JSON persistence, approved HealthKit adapters, local notifications, WidgetKit/App Group read-only handoff, the implemented-but-production-disabled StoreKit 2 boundary in §5/§9, the bounded Apple public-catalog lookup in §9, the bounded Apple Watch companion / WatchConnectivity boundary with its watch workout-session HealthKit exception in §5/§9 (v3.6/v3.7), plus the bounded rest Live Activity (ActivityKit) in §9 (v3.7). |
| Deferred systems | Account, cloud sync, CRDT, watchOS beyond the §5 Apple Watch Companion Boundary, general-purpose remote networking, remote config, remote analytics, referral attribution, third-party subscription SDKs, and server-side entitlement systems require explicit architecture amendments. Subscription runtime, update awareness and the Apple Watch companion are authorized only through their bounded slices below. |

> **Status note (2026-10-14):** v3.6 and v3.7 brought every watch, widget and Live Activity surface in the current code into the table above. `ios/packages/` holds 13 packages; `RedeSync` / `RedeSyncSupabase` (cloud sync) are not approved and not reconciled (see the dated inventory under §5 and the header).

Removed implementation surfaces:

- Web/PWA runtime and assets.
- Node/Vite build and dev API.
- TypeScript source, contracts, scripts, and Vitest tests.
- Supabase/Vercel implementation candidates, browser sync, account/auth runtime code, and cloud candidate code.
- `RedeCloudSync` Swift package stub.

Active vs reference surfaces:

- The clean `ios/Rede` SwiftUI app, the Readiness widget, the `RedeWatch` companion app (v3.6, §5), and the approved in-tree Swift packages (§5) are the **active implementation**. Status (2026-10-14): the `RedeWidget` extension also hosts the rest Live Activity (ActivityKit, approved by v3.7, §9), and the watch target's HealthKit workout session is approved by v3.7 (§5 Apple Watch rule 10). `RedeSync` and `RedeSyncSupabase` are merged on `main` and built but not approved (see the header).
- Retired IronPath/PWA-era packages and code (removed during M1-0, preserved at git tag `legacy-parity-final`) are reference-only.
- Do not treat retired runtime behavior as a contract when it conflicts with the living docs.
- Do not port retired code wholesale into the clean rewrite without a review slice that proves the behavior is still desired and unpolluted.

---

## 3. Product Architecture

Rede is a local-first native iOS training app. The app should feel like a polished, restrained, professional mobile training coach, not an admin dashboard or data-heavy engineering panel.

Target commercial information architecture:

| Area | Purpose |
|---|---|
| 今日 | Should I train today, what should I train, why, and where do I start? |
| 训练 | How do I record the workout now with the least friction? |
| 进展 | Did training work, what changed, and is the data trustworthy? |
| 计划 | How will I train in the future, and what changes are proposed? |
| Profile / Settings | Low-frequency settings, data controls, units, screening, HealthKit permissions, export/backup, and subscriptions. Not a bottom tab. |

The clean rewrite must implement this target directly. Transitional names or behaviors in the legacy iOS code are not product requirements.

---

## 4. Target Native iOS Architecture

```
ios/
├── Rede/                 SwiftUI app layer
├── RedeWidget/           WidgetKit readiness extension
├── RedeWatch/            watchOS companion app (v3.6; §5 Apple Watch Companion Boundary)
├── Rede.xcodeproj        App + widget + watch project
├── Rede.xcworkspace      Workspace
├── ParityFixtures/           Frozen iOS test fixtures
└── packages/                 Local Swift packages
```

This shape is implemented: the clean `ios/Rede` app, `RedeWidget`, `RedeWatch`, `RedeTests`, `ParityFixtures`, and `packages/` all exist. (`RedeCloudSync` and the not-yet-created packages noted in §5 are intentionally absent.) Status (2026-10-14): `Rede.xcodeproj` holds four targets (`Rede`, `RedeWidgetExtension`, `RedeWatch`, `RedeTests`) and three shared schemes (`Rede`, `Rede-StoreKitTest`, `RedeWatch`).

The app layer is a thin renderer and IO seam. It may:

- own SwiftUI screens and view models
- connect package APIs to platform adapters
- format local UI labels and dates
- surface honest loading/error states

The app layer must not:

- own business decision logic
- bypass DataHealth before engine consumption
- create a second persistence path
- introduce network, account/auth runtime, cloud runtime, WebView, CoreData, SwiftData, SQLite, or UserDefaults source-of-truth storage

---

## 5. Target Swift Package Boundaries

### Packages present today (11 approved, all in the CI test matrix)

| Package | Responsibility | Depends on |
|---|---|---|
| `RedeDomain` | Codable AppData model, domain values, and small platform-independent app policies such as review/update cadence and semantic version comparison. | Foundation only |
| `RedeDataHealth` | Clean AppData projection, repair logic, and runtime guards. | `RedeDomain` |
| `RedeTrainingDecision` | Training decision, readiness, scheduling, progression, insights, muscle level, support allocation, session prescription, and coach-action engines. | `RedeDomain`, `RedeDataHealth` |
| `RedePersistence` | AppData store protocol, JSON file store, and canonical write orchestration. | `RedeDomain` |
| `RedeLocalSnapshot` | Derived Focus/session history snapshots. Never canonical AppData. | Foundation only |
| `RedeWidgetShared` | Read-only widget snapshot model and App Group snapshot store, plus (v3.7) the WidgetKit timeline reloader and the rest Live Activity's `RestActivityAttributes`. | Foundation; WidgetKit (§9) and ActivityKit (v3.7, §9) only in `#if os(iOS)` platform files |
| `RedeL10n` | Terms and formatting support. | Foundation only |
| `RedeNotifications` | Local-notification policies (FR-NT1/2) + the `#if os(iOS)` UNUserNotificationCenter adapter behind a `NotificationScheduling` seam. Pure policy is host-tested; derived/transient, never canonical, no remote/push. | Foundation only |
| `RedeHealthKit` | Approved iPhone-side HealthKit adapters, none of which writes Health data: read-only body weight (`BodyWeightReading` + `#if os(iOS)` `HKBodyWeightReader`); read-only session vitals for the watch-written workout (`SessionVitalsReading` + `HKSessionVitalsReader`, approved by v3.8, code ships in PR #749); and the watch-workout launch request (`WatchWorkoutLaunching` + `HKWatchWorkoutLauncher`, v3.8, Apple Watch rule 13). Display-only; never canonical and never engine truth. Workout import into AppData and iPhone HKWorkout writes remain deferred; the watch target's workout write is the separate v3.7 exception in the Apple Watch Companion Boundary (rule 10). | Foundation only |
| `RedeEntitlements` | Pure Free Core/Paid Coach policy, fail-closed launch configuration, StoreKit 2 product/transaction/restore adapter, entitlement lifecycle model, and package-owned StoreKit subscription/management UI wrappers. Never canonical or engine truth. | Foundation; StoreKit/SwiftUI only in narrow platform/UI files |
| `RedeWatchLink` | Approved by v3.6. Phone ↔ watch message shapes (`WatchPrescription`, `WatchLoggedSet`, `WatchCommand`, envelope) and the single `WCSession` wrapper shared by the iPhone app and the `RedeWatch` companion. The only WatchConnectivity importer. Carries derived presentation state and logged-set facts; never canonical or engine truth. Rules: §5 Apple Watch Companion Boundary. | Foundation; WatchConnectivity only in `WatchLink.swift` |

> **Dated inventory (2026-10-14, status only):** `ios/packages/` holds 13 packages, all in the CI and quality-gate `EXPECTED_PACKAGES`. `RedeWatchLink` joined the table above with the v3.6 amendment. Two are not in the table and have no architecture amendment:
> - `RedeSync` and `RedeSyncSupabase` (cloud sync, #727): not reconciled here.
>
> The `RedeWidgetShared` and `RedeHealthKit` rows were completed by v3.7. Only the cloud-sync drift remains unreconciled; see the header.

### Target package names not yet created on disk

These are reserved future boundaries (named here so logic lands in the right place when approved); none exists in `ios/packages/` today, and creating any requires an approved implementation slice:

| Package | Intended responsibility | Status |
|---|---|---|
| `RedeBackup` | Future automated backup / restore orchestration beyond the shipped canonical JSON export. | Not created. The direct 1.8 JSON export does not authorize a second backup store or restore runtime. |
| `RedeUIKit` | Shared UI framework. | Not created. Does not authorize a shared UI framework migration. |

There is no approved cloud/sync runtime in the clean rewrite baseline. Future iOS-native account/cloud/sync work must follow `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md`, then land through an explicit Master-approved implementation slice.

### Package Rules

1. `RedeDomain` is the dependency leaf.
2. `RedeLocalSnapshot` must stay decoupled from `RedeDomain` and canonical AppData.
3. The import graph must remain a DAG.
4. Packages never depend on the app target.
5. Not-yet-created target packages stay unbuilt until an approved slice creates them.

### Subscription Entitlement Boundary (v3.2)

The first subscription implementation is deliberately narrow:

1. `RedeEntitlements` owns pure domain types such as `AccessTier`, `EntitlementState`, `FeatureAccessPolicy`, and the `SubscriptionProviding` seam. Only its narrowly scoped iOS platform/UI adapters may import StoreKit; if the first paywall uses `SubscriptionStoreView`, the package exports a wrapper that the app renders without importing StoreKit itself.
2. Apple-verified current transactions are the entitlement truth. The app may derive transient UI state from them, but must not persist a custom paid flag, receipt, product catalog, or entitlement snapshot in canonical AppData, backups, exports, widgets, or training-engine inputs.
3. `active` and billing-grace-period subscription states unlock Paid Coach only until their verified access deadline. Refunded, revoked, expired, or absent current entitlements resolve to Free Core. Unverified or unavailable results immediately become an honest `unknown` state with retry/error UI; they never preserve paid access, and they never block training, recording, saving, export, privacy controls, or any other Free Core behavior.
4. The app observes transaction updates for the process lifetime, revalidates at the verified expiration/grace deadline and on foreground return, and finishes only verified transactions after local access state has been refreshed. Overlapping entitlement reads must be ordered so an older paid result cannot overwrite a newer refund/revocation result. `AppStore.sync()` is allowed only behind an explicit user-initiated Restore Purchases action; it is not a launch-time refresh mechanism.
5. Product names, localized prices, trial/offer text, renewal terms, and purchase controls come from StoreKit. Rede must not hard-code a price or claim an offer that the returned product does not contain. Product-catalog failure must not revoke a separately verified current Paid Coach entitlement. The app may expose a branded, non-transactional Rede Coach page shell before products are ready, but that shell may show only the brand name, current plan, and an honest readiness state—not value claims, prices, offers, purchase actions, or unbuilt benefits. A not-yet-built paid capability and an operational catalog/policy failure are distinct presentation states. A Rede-styled shell around Apple's StoreKit subscription views is the preferred purchase UI once the launch gate is ready. The package-owned wrapper must expose working Privacy Policy and Terms of Use destinations (using StoreKit policy destinations when applicable); exact URLs are validated release configuration, not architecture constants.
6. The first slice has one subscription group with monthly and annual products at the same access level. Exact product IDs, prices, trial eligibility, storefront availability, and App Store Connect configuration are release/admin decisions, not architecture constants.
7. No account, Rede server, remote receipt service, RevenueCat, remote analytics, or `appAccountToken` is part of the first slice. A future amendment may reconsider a vendor/server only after a concrete need exists for cross-platform entitlement, account support, webhooks, customer support tooling, or subscription analytics.
8. Product boundary A is a compatibility floor: every capability present in Rede 1.8 remains Free Core. A future capability may be gated as Paid Coach only when its PRD entry says so before implementation. Safety behavior, core training, recording, canonical save, data access/export, and privacy controls can never be paywalled.
9. The first approved post-1.8 capability is `Weekly Coach Review` (PRD FR-SUB3). Its decision core lives as a pure, typed, zero-copy/zero-I/O addition to `RedeTrainingDecision`; the app composition layer maps already-clean progress facts into narrow primitives. `RedeEntitlements` may gate only the rendered Paid Coach surface. Entitlement state, product IDs, StoreKit types, current plan state, raw `AppData`, and persistence handles must not enter the review engine. V1 is recalculated from canonical history on demand and creates no cache, archive, seen flag, plan snapshot, schema field, backup/export field, widget payload, network request, or analytics event. Corrected history therefore corrects the review instead of leaving a second truth source.

Primary platform evidence for this amendment: Apple [`Transaction.currentEntitlements`](https://developer.apple.com/documentation/storekit/transaction/currententitlements), [`AppStore.sync()`](https://developer.apple.com/documentation/storekit/appstore/sync%28%29), and [StoreKit views](https://developer.apple.com/documentation/storekit/storekit-views), reviewed 2026-07-17.

### Apple Watch Companion Boundary (v3.6/v3.7, rules 4 and 6 amended by v3.9)

Approved by the owner on 2026-10-14 (proposal A of the WATCH-10 reconciliation, v3.6; rules 10–12 extended by proposals B, D and E, v3.7; rules 4 and 6 amended 2026-10-19, v3.9). It codifies the channel discipline and workout-session behaviour that the existing watch code already follows; anything outside it requires a further amendment.

1. **Scope.** watchOS is allowed only as the `RedeWatch` companion app, embedded in the iPhone app, plus the shared `RedeWatchLink` package. The watch is a remote control for the live training session on the phone, not a second app: plan, progress, settings, exercise library and onboarding stay on the phone.
2. **WatchConnectivity lives only in `RedeWatchLink`.** `WatchLink.swift` is the only `WCSession` wrapper, shared by both sides; the app targets use the package API, never `WCSession` directly. Message shapes (`WatchPrescription`, `WatchLoggedSet`, `WatchCommand`, the envelope) are defined once, in the package.
3. **Phone → watch: `updateApplicationContext` only.** There is one sender on the phone (`SessionStore.pushWatchPrescription`), carrying one phone-rendered `WatchPrescription`. applicationContext is a single latest-value slot, so every phone → watch field must ride in that one payload, and no second applicationContext sender may be added (it would overwrite the prescription). The phone sends nothing to the watch over `transferUserInfo` or `sendMessage`. The payload is derived presentation state, pushed only when Today is readable; it is never canonical data. The phone-initiated launch request of rule 13 (v3.8) is a HealthKit system call, not a WatchConnectivity send, and carries no payload, so it does not change this rule.
4. **Watch → phone facts: always `transferUserInfo`, plus a reachable-only wake copy (v3.9).** Logged sets (and warm-up steps) always travel as `WatchLoggedSet` over the queued, guaranteed-delivery channel; that copy alone carries the delivery guarantee. While the phone is reachable the watch also sends the identical envelope over `sendMessage`, solely to wake a suspended phone app; it is never the only copy. The phone accepts at most one copy (rule 7's exact-set guards plus an in-memory identity key of `exerciseId` + `setNumber` + `isWarmup` + `loggedAtISO`, recorded on acceptance, which also blocks a late duplicate after an undo), and on a watch-originated envelope takes a short background-task assertion so the reducer, rest start and prescription push complete before the app is suspended again.
5. **Watch → phone commands: `sendMessage` only.** Commands (rest +30, skip rest including the automatic rest-end skip, pause/resume, skip warm-up, skip set with a reason code) are intents. They work only while the phone is reachable and are dropped otherwise, and the phone executes them only against its current state.
6. **The phone is the only decision maker.** The watch computes no prescription, next set, load or progression; it shows phone-rendered strings and phone-sent weight rungs, and it never advances the session on its own (owner ruling 2026-08-15). **Provisional rest (v3.9, owner 2026-10-19):** the moment it logs a working set the watch may show an in-memory countdown (`RedeWatchLink.ProvisionalRest`) for the duration the phone already put in the prescription (`Active.restAfterSetSeconds`, computed by the phone's reducer on a copy of the flow; absent for warm-up steps, the session-final set and old phones) with a phone-rendered, target-free preview; it survives only while the phone's pushes still show that same set awaiting and its time has not run out, and yields to the phone's rest (or, once run out, back to the set screen) otherwise. Its end — and every later push showing an already-ended rest — only sends the existing `restSkip(auto:)` intent, which the phone honours only against its own clock; the phone anchors a watch-logged set's rest at the watch's `loggedAtISO` (clamped to now) so both rings agree. From `RedeTrainingDecision` the watch uses only `RestCountdown` (the wall-clock rest arithmetic it shares with the phone); beyond that it uses only `RedeL10n` copy and the `RedeWatchLink` API. It must not call decision engines or persistence. The watch target also links `RedeDomain`, `RedeDataHealth`, `RedePersistence` and `RedeLocalSnapshot` without importing them; any further package API on the watch needs a further amendment.
7. **Canonical writes stay on the phone.** The phone accepts a watch set only when it is exactly the set it is waiting for (`exerciseId` + `setNumber`, plus phase and warm-up guards), and records it only in the phone's non-canonical in-session state. With a live flow it goes through `apply(.logSet)`, the same reducer path as phone input. With no live flow (app killed, draft not yet restored) it goes through the watch-specific draft write path `appendWatchSetToDraft`, which appends to the non-canonical `active-session-draft.json` under the same exact-set guards. Watch input reaches canonical AppData only through the existing completion path in `CanonicalSessionWriter`; there is no watch-specific canonical writer or mutation class. The watch never reads or writes canonical AppData.
8. **No Rede-owned watch-side storage.** The watch keeps no App Group, files or `UserDefaults`; it holds only in-memory state plus the system-held WatchConnectivity state. (The workout it writes to Apple Health is governed by rule 10.)
9. **Engine boundary.** Only logged-set facts (through the phone's normal reducer) and command intents cross from the watch. Watch sensor or health data never enters AppData or any engine (§8).
10. **Watch HealthKit workout session (v3.7, narrow exception to §9 "HealthKit only inside `RedeHealthKit`").** The watch target may import HealthKit only in its single workout-session owner (`WorkoutSessionKeeper.swift`), for one live session at a time: `HKWorkoutSession` + `HKLiveWorkoutBuilder` + `HKLiveWorkoutDataSource`, traditional strength training, indoor. Authorization is limited to sharing workouts and reading heart rate and active energy. The session follows the phone-pushed `trainingInProgress` state. When that ends it writes the workout to Apple Health, except that it discards the workout and writes nothing when the phone reports an abandoned session or when a set/rest screen has had no phone update for 60 minutes. Health data read on the watch is display-only on the watch (heart rate, elapsed time); it never crosses `RedeWatchLink` and never reaches the phone, AppData or any engine. Any other HealthKit type, query, background delivery or watch-side HealthKit use needs a further amendment. The same file also hosts the `WatchAppDelegate` receiver for phone-initiated launches (rule 13, v3.8), so watch-side HealthKit still lives in that one file. On the iPhone, HealthKit stays inside `RedeHealthKit` (read-only body weight, read-only session vitals, and the rule-13 launch request, v3.8); workout import and iPhone HKWorkout writes remain deferred.
11. **Single authority supersedes CRDT co-editing for the watch (v3.7).** The phone ↔ watch active session is single-writer: the phone decides and writes, the watch requests. Concurrent multi-writer editing of the active session (the former CRDT co-editing direction in `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md`) is no longer a target for the watch. CRDT stays in §2 Deferred systems; the recorded record-level merge direction for future cloud sync (`docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` §1/§3) is unchanged by this rule and still needs its own amendment. CRDT is not a watch transport.
12. **Validation.** Changes inside this boundary keep the `RedeWatchLink` package tests (including `ProvisionalRestTests`, v3.9) and the app-hosted `WatchLoggedSetIntakeTests` passing, and CI plus the quality gate build the `RedeWatch` scheme for a generic watchOS Simulator destination (v3.7, §10).
13. **Phone-initiated watch launch (v3.8).** Starting a session on the phone may ask the system to launch or wake the watch app for a workout. The path is `SessionStore.startSession` → `WatchWorkoutLaunching.launchStrengthWorkout()` → `HKHealthStore.startWatchApp(toHandle:)` (traditional strength training, indoor), inside `RedeHealthKit`. It runs only when `WatchLink.hasCounterpart` is true, and only for a newly started session, never on draft restore. It requests no iPhone HealthKit authorization. On the watch, the request lands in `WatchAppDelegate.handle(_:)`. The delegate ignores the passed configuration, because a forum report since watchOS 7 says it can arrive as the default, and asks the single app-level `WorkoutSessionKeeper.shared` to run. Starting a session still goes only through the keeper's one serial reconcile loop. Until the phone confirms the launched session, the keeper accepts a "training" state at once. It accepts a "not training" state only if the phone sent it after the launch, because the system-held applicationContext is the previous session's end and always arrives first on a cold launch. If no confirmation comes within the rule-10 limit of 60 minutes, the keeper ends the session and discards it, writing nothing. Without Health workout-write authorization on the watch, the request does nothing, since a background launch cannot show a prompt. Launch failures go to `os.Logger` (subsystem `com.tinsab.rede`, category `WatchLaunch`) and are never shown in the UI. The user can still open the watch app by hand, and it then picks up the stored prescription exactly as before. Only a real paired device can verify that the watch wakes; that check is on the device acceptance list.

---

## 6. Source Of Truth

The target source of truth for the clean rewrite is canonical AppData.

| Surface | Source of truth | Derived records |
|---|---|---|
| Native iOS target | `RedeDomain.AppData`, persisted through `RedePersistence.JSONFileAppDataStore` | Local snapshots, widget snapshots, rest Live Activity content state (v3.7), the watch `WatchPrescription` payload (v3.6), HealthKit exports (including the watch workout, v3.7), UI view models |
| Tests | Swift packages + versioned fixtures under `ios/ParityFixtures` or their clean-rewrite replacement | Test-only decoded views |

Hard rules:

1. There is exactly one canonical AppData document per local app install.
2. `RedeLocalSnapshot` must never read or write canonical AppData.
3. No task may change where canonical AppData lives without amending this document.
4. Canonical AppData writes must go through `CanonicalSessionWriter`.
5. Full AppData restore is deferred behind DataHealth clean-view and repair-apply gates.
6. Subscription entitlement is StoreKit-derived platform state, not user training data. It must never mutate canonical AppData, change engine inputs, or appear in canonical export/restore payloads.

---

## 7. Canonical Write Path

`CanonicalSessionWriter` is the only sanctioned canonical write orchestration. It owns:

- load existing AppData
- build a candidate mutation
- run the injected DataHealth validation gate
- backup before overwrite
- atomic save
- honest failure propagation

Approved target mutation classes include:

- completed-session append
- HealthKit body-weight sample append
- HealthKit imported-workout sample append into derived display-only storage
- profile scalar edit
- unit setting edit
- screening list edit
- program scalar config edit
- logged-set correction
- saved-session exercise replacement (forward exercise-swap override, FR-T5)
- coach-action dismissal intent (FR-T5)
- coach-action volume-boost intent (frequency acknowledgement; adds no session, mutates no prescription, FR-T5)
- notification preference edit (FR-NT1/2 toggles; open-bag additive, absent = off, no schema bump; scheduling is platform-side via `RedeNotifications`, never canonical)
- plan-frequency adjustment adopt/rollback (FR-PL3/4; the public writer accepts a clean current/from value in 1...14 but constrains every new target/to to 2...6, and fails closed before backup/save on an unknown kind, stale/missing current program value, wrong direction/no-op, dirty existing profile-day value, non-object program/profile container, or non-array history; one gated mutation keeps `programTemplate.daysPerWeek` and `userProfile.weeklyTrainingDays` synchronized and appends each field's own before/after snapshot to the open-bag `planAdjustmentHistory` array capped at 20 raw elements; existing raw history values and their unknown fields remain intact rather than being decoded/re-encoded, while typed reads skip malformed elements and rollback removes only the last valid layer, preserves every dirty sibling, and independently restores the two recorded before values including an explicitly absent profile value; an array with no valid layer performs no write; reads synthesize a one-item stack only when the new array is absent and a valid legacy `planAdjustment` is present, accepting the former clean 1...14 range and necessarily inferring its unavailable profile snapshot from the legacy program from/to, while all real new writes stop writing and clear that legacy field; no schema bump)
- plan customization edit (FR-PL6/PL7; open-bag additive `planCustomization{dayPlans, daySequence}`, absent = nil = default coach plan = byte-identical to current → golden zero-change; no schema bump). The four editor writer methods remain `applyCustomDayPlan` / `removeCustomDayPlan` / `applyCustomDaySequence` / `removeCustomDaySequence`. **User decides WHAT exercises / order / day-sequence; engine still decides load/reps/progression/verdict** (decision-first preserved — custom exercises become `userPinned` slots that still pass `prescribe()`). Editor rollback = remove (default template is a deterministic pure function, no snapshot needed). Raw `planCustomization` is validated through the clean view before reaching the engine (§8: raw never enters engines directly). Engine/system contract: system-logic §8.2.
- completed-session plan adoption / raw rollback (FR-TR14; two additional narrow capabilities on the same `CanonicalSessionWriter`, not a parallel store or engine writer): `compareAndApplyCompletedSessionPlan` loads the latest canonical state once, lets an app-layer read-only resolver derive a `CleanTrainingDecisionInput`, reuse the existing prescription API to compare the completed target with that day’s real next effective exercise order (including sticky and permanent substitutions), and return only no-op / write exercise IDs / clear day; the writer performs that decision in the same gated transaction. A default-equivalent target clears only when projecting the day without its custom override still yields that target; when an overlay would pull the default away, the default IDs are a necessary `userPinned` custom write and the substitution/sticky sources remain untouched. No-op and identical output skip gate, backup, and save. A real write captures the actual pre-write raw `dayPlans[dayCode]` node plus whether this write created the `dayPlans` container. `restoreCompletedSessionPlanDayRaw` restores a non-nil node verbatim; nil removes only the target day and removes the now-empty container only when that provenance says this write created it, preserving pre-existing empty `dayPlans`, empty `daySequence`, unknown keys, and malformed siblings skipped by typed views. Both paths fail closed on unreadable plan containers, preserve the existing four editor writer signatures/semantics, add no schema, never pass raw AppData into an engine, and never mutate `exerciseSubstitutions` or sticky state.

Coach-action adopt, dismiss, and the swap/volume undos all flow through this single writer; undo is a single-step reverse write (no separate undo stack). The dismiss intent has a writer-level reverse (`removeCoachActionDismissal`) but no surfaced user undo — it is a one-way throttle signal. Engine contract: system-logic §6.4a.

Rules:

- No fake success.
- No overwrite of unreadable user data.
- No parallel store.
- No schema bump unless explicitly approved.
- No engine outputs written back as truth.

---

## 8. Engine Input Boundary

Raw AppData must not enter training engines. Engine inputs must come from:

- DataHealth clean views
- explicit clean input contracts
- typed domain values that have passed the relevant clean/validation boundary

HealthKit imports, widget snapshots, local snapshots, UI receipts, and future platform observations are not engine truth unless a specific architecture amendment and implementation slice promote them through a clean input contract.

---

## 9. Platform Boundaries

Allowed platform integrations:

- `FileManager` for local JSON persistence and sanctioned backups.
- HealthKit only inside `RedeHealthKit` (created, FR-PR8 scope A: read-only body-weight `HKBodyWeightReader` behind the `BodyWeightReading` seam; display-only, never engine truth; v3.8 adds the read-only `HKSessionVitalsReader` and the `HKWatchWorkoutLauncher` launch request, and neither writes Health data), plus the watch target's workout-session exception in the §5 Apple Watch Companion Boundary rules 10 and 13 (v3.7/v3.8).
- UserNotifications only inside `RedeNotifications` (created, FR-NT1/2: local rest/weekly reminders behind `NotificationScheduling`).
- WidgetKit only inside the widget target and `RedeWidgetShared` adapter.
- App Groups only for the read-only widget snapshot handoff.
- ActivityKit only for the rest Live Activity (v3.7): the app-target `RestLiveActivityController`, the `#if os(iOS)` `RestActivityAttributes` in `RedeWidgetShared`, and the widget-target `RestLiveActivity` UI. Local only (`pushType: nil`, no push tokens, no frequent-update entitlement); display-only, derived from the phone's rest countdown; never writes canonical data and is never engine input. Any other Live Activity or ActivityKit use needs a further amendment.
- WatchConnectivity only inside `RedeWatchLink`, for the `RedeWatch` companion app, under the §5 Apple Watch Companion Boundary (v3.6): applicationContext for the single phone-rendered prescription, `transferUserInfo` for watch-logged facts (plus their reachable-only `sendMessage` wake copy, v3.9), reachable-only `sendMessage` for watch command intents.
- StoreKit 2 only inside the `RedeEntitlements` iOS platform/UI adapters described in §5. The app may render the exported subscription-view wrapper but must not import StoreKit directly. StoreKit state may gate explicitly approved Paid Coach UI, but may not gate or alter Free Core engines, persistence, export, or safety behavior.
- `URLSession` only inside the app-target App Store lookup adapter approved by v3.5. It may issue one direct, throttled anonymous HTTPS GET to Apple's public Lookup catalog using only Rede's public app ID; the expected bundle ID is never sent and is used locally to validate the returned record. It must refuse every redirect, validate the final response URL plus the expected Rede record, decode only the public marketing version needed for comparison, carry no user/device/training identifiers or credentials, and remain independently injectable for deterministic tests. Automatic checks run at most once per 24 hours; a per-version “Later” action suppresses the prompt for seven days. Network/decoding errors are silent for automatic checks and honest but non-blocking for an explicit Settings check. Built-in `RedeL10n` copy—not remote release notes—owns every visible string. The only action is user-initiated navigation to Rede's App Store product page.

The update-awareness surface is informational infrastructure, part of Free Core, and never a compatibility or purchase gate. It may show a non-blocking Today signal, a Settings version/check surface, and a one-time built-in What's New sheet after an installed-version change. It must not interrupt an active training flow. A binary that predates this boundary cannot be retroactively made to prompt; the first build containing it establishes protection only for later releases.

Forbidden without amendment:

- CloudKit / iCloud
- Supabase client/runtime implementation
- URLSession / remote networking except the bounded Apple public-catalog lookup above
- WebView
- account/auth SDKs
- UserDefaults as source-of-truth storage
- SQLite
- CoreData
- SwiftData
- remote push notifications
- watchOS / WatchConnectivity beyond the §5 Apple Watch Companion Boundary (v3.6/v3.7)
- CRDT storage or sync
- RevenueCat or any other third-party subscription SDK
- Rede-hosted receipt validation or entitlement servers

> **Status note (2026-10-14):** within the watch / Readiness widget / Live Activity scope of the 2026-10-14 reconciliation, v3.6 and v3.7 resolved every conflict with this section (WatchConnectivity, the watch HealthKit session, ActivityKit); the lists above now carry them. Separately, cloud sync (`RedeSync` / `RedeSyncSupabase` from #727) conflicts with the Supabase, `URLSession` and account/auth entries; it is not reconciled here.

---

## 10. Validation

Every change must run the smallest relevant real verification. For documentation-only rewrite planning, `git diff --check` plus targeted consistency scans are sufficient. When clean runtime code exists, typical commands are:

```bash
cd ios/packages/RedeTrainingDecision
swift test
```

```bash
for package in ios/packages/*; do
  if [ -f "$package/Package.swift" ]; then
    (cd "$package" && swift test) || exit 1
  fi
done
```

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build
```

The GitHub workflow must remain Swift/Xcode based. Do not reintroduce Node, Vite, browser tests, or web build checks.

CI and the quality gate also run `RedeEntitlements` under Thread Sanitizer (`swift test --sanitize=thread`, 2026-10-17). A race in its test double had shown up only as an intermittent CI crash (#754); under TSan the same kind of race fails on every run.

The iOS build above only produces a resource-only stub of the embedded watch app, so CI and the quality gate also build the watch app through the shared `RedeWatch` scheme (v3.7):

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme RedeWatch \
  -destination 'generic/platform=watchOS Simulator' \
  build
```

Status (2026-10-14): `-target RedeWatch` fails to resolve the local packages (#746), so the scheme form above is the supported build. CI and the quality gate run all package tests, including `RedeWatchLink` and the app-hosted watch-set intake tests, and since v3.7 (proposal E) also build the `RedeWatch` scheme; if the first build attempt fails, the CI step downloads the watchOS platform and retries once (meant for a runner that lacks the platform); a second failure fails the job, and the quality gate does not retry. The §5 Apple Watch Companion Boundary rule 12 lists the watch validation.

Update awareness must additionally prove pure version ordering, invalid-version fail-closed behavior, equal/older-store suppression, 24-hour automatic throttling, version-scoped seven-day snooze, and newer-version snooze bypass. App tests must prove Apple response validation plus automatic/manual error semantics without live-network dependence. Simulator acceptance must visibly cover update available, up to date, offline/error, Later, Settings manual check, one-time What's New, maximum Dynamic Type, VoiceOver labels, and a return to the training loop. A live Apple response is useful operational evidence but is not a deterministic test fixture and must never be required for launch.

The subscription runtime must additionally prove all of the following before release:

- pure policy/state tests with a fake `SubscriptionProviding` implementation;
- StoreKitTest coverage for purchase success, user cancellation, pending purchase, verification failure, renewal, expiration, refund/revocation, and explicit restore;
- Sandbox or TestFlight acceptance for localized products, purchase, renewal state, restore, billing grace period where configured, cancellation/refund/revocation, reinstall/new-device behavior, offline launch, and working Privacy Policy / Terms of Use destinations;
- regression proof that Free Core training, saving, export, and existing Rede 1.8 surfaces work when the product catalog is unavailable and when entitlement state is unknown.

Xcode StoreKit tests are necessary but do not prove App Store Connect product configuration or production-store behavior.

Current dated status (2026-07-18): 23 pure policy/state/configuration tests pass, including stale-query/write, stale-delivery acknowledgement, mixed-trust, purchase-verification, unverified-update, purchase-gate, and automatic-expiration regressions. The authoritative gate also passes the generic iOS build and an app-hosted production fail-closed XCTest. Production `Rede` and local `Rede-StoreKitTest` are separate shared schemes. The end-to-end `SKTestSession` source covers success, cancellation, pending, verification failure, renewal, grace, expiration, refund/revocation, and restore, but Xcode 26.6 with the installed iOS 26.5 Simulator runtime fails before catalog load with `SKInternalErrorDomain Code=3`. This is recorded as an open validation failure, not waived. Production configuration therefore stays disabled and the subscription release remains No-Go until StoreKitTest plus Sandbox/TestFlight acceptance are green.

---

## 11. Documentation Discipline

The living-doc set is governed by `docs/DOCS_MANIFEST.md`.

Code changes must update the affected living docs. New top-level Markdown files are not allowed unless registered in the manifest first.

---

## 12. Branch And PR Workflow

- Use a normal branch from latest `origin/main`.
- Do not work directly on `main`.
- Open a PR.
- Wait for checks.
- Do not bypass branch protection.
- Do not force-push unless the user explicitly asks and the risk is explained.
