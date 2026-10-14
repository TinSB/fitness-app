# Rede Master Technical Architecture

> **This is the canonical, highest-level engineering contract for Rede.**
> Every human and every AI agent must read this document before making changes and must obey it. If a requested task conflicts with this document, stop and require explicit architecture approval before writing code.

- **Status:** Authoritative / binding
- **Version:** 3.5
- **Last updated:** 2026-10-14 (dated status notes only — watchOS, Readiness widget, rest Live Activity; no amendment, no version bump)
- **Repository:** `TinSB/fitness-app` (the GitHub slug is still `fitness-app`; the product and local working dir are `Rede`)
- **v3.0 amendment:** established a clean code rewrite baseline, written cleanly against the manifest-registered living docs (especially `docs/REDE_iOS_SYSTEM_LOGIC.md`) instead of extending or porting the polluted legacy implementation.
- **v3.1 amendment (2026-06-13):** the clean rewrite is now the **active implementation**. `ios/Rede` has been a clean app shell since M0-1, and the MVP training loop had shipped through milestones M0–M6 (with M6-4 TestFlight upload still open at that dated snapshot). The boundaries and contracts below still bind; where this doc previously said "ios/ is reference-only / not yet implemented," read it as describing the **retired IronPath/PWA-era code** (removed during M1-0, preserved at git tag `legacy-parity-final`), not the then-current clean `ios/Rede` + 7 in-tree packages. Current inventory is recorded by v3.3 and the tables below.
- **v3.2 amendment (2026-07-17):** approved the subscription architecture boundary without implementing it: StoreKit 2 behind a thin future `RedeEntitlements` package, Apple-verified transactions as entitlement truth, no RevenueCat/account/server/remote analytics in the first slice, and no entitlement state in canonical AppData. Product boundary A is binding: everything already available in Rede 1.8 remains Free Core; only capabilities added after 1.8 may be proposed as Paid Coach features through an explicit PRD amendment.
- **v3.3 implementation reconciliation (2026-07-18):** the bounded subscription foundation now exists as the tenth in-tree package. It includes pure access policy, StoreKit 2 product/transaction/restore adapters, a process-lifetime entitlement model, expiration and foreground revalidation, stale-query protection, a package-owned `SubscriptionStoreView` wrapper, Settings plan state, a non-transactional Rede Coach page shell, a fail-closed production launch gate, and local-only monthly/annual StoreKit fixtures. The branded page shell may remain visible while blocked, but Apple product, price, trial, renewal, restore, and purchase controls appear only after the gate is ready. The production `Rede` scheme is isolated from the dedicated `Rede-StoreKitTest` scheme, and CI runs an app-hosted production fail-closed XCTest in addition to all package tests and the generic build. Production purchase presentation remains disabled because no post-1.8 Paid Coach capability, App Store Connect product configuration, final pricing/trial, or validated current Privacy/Terms destinations have been approved. The Xcode 26.6 + iOS 26.5 Simulator StoreKitTest service still returns `SKInternalErrorDomain Code=3` while saving an Apple-v6.3-aligned configuration, so full purchase/renewal/refund lifecycle and Sandbox/TestFlight acceptance remain release blockers.
- **v3.4 implementation reconciliation (2026-07-18):** the first approved post-1.8 capability, `Weekly Coach Review` (FR-SUB3), is now implemented end to end behind verified Paid Coach access. A pure typed engine in `RedeTrainingDecision` consumes narrowly projected, clean prior-week facts; dated dropped-training findings and suspect sets fail closed before a positive trend can be shown; `RedeL10n` owns the approved bilingual states and actions; the app renders the review without persisting a second truth source. Active/grace entitlements retain access even if the purchase catalog or policy configuration is unavailable, while free/checking/unknown/expired/refunded states never receive the paid result. Checking and unknown entitlement states also never reach the purchase surface even if the product gate is already ready; an expired entitlement is presented as Free Core. Local package/app tests, the authoritative quality gate, Release build, and iPhone 17 Pro Simulator flows cover the Chinese empty state to Today, English data-review state to Progress, production Free Core preview, accessibility labels, maximum Dynamic Type, and Reduce Motion. These are L3 local implementation/UX evidence only. Production purchase presentation remains disabled until real App Store Connect products, current policy destinations, a working StoreKit lifecycle environment, and Sandbox/TestFlight acceptance exist; the current `SKInternalErrorDomain Code=3` blocker is unchanged.
- **v3.5 amendment (2026-07-18):** approved one narrow App Store update-awareness boundary. The app may make an anonymous, throttled HTTPS GET to Apple's public App Store Lookup catalog using Rede's public app ID, then locally validate the expected bundle ID, solely to compare the installed marketing version with the public store version. Pure version/cadence/snooze policy belongs in `RedeDomain`; the `URLSession` adapter remains in the thin app platform layer. The response is optional presentation input, never product, entitlement, training, or canonical truth. Invalid data, timeout, offline state, an older/equal store version, or any service failure produces no automatic prompt and never blocks launch, training, saving, export, or subscription access. No Rede server, remote config, push, analytics, device identifier, authentication, remote release copy, forced update, or in-app binary updater is authorized. Loss-tolerant UI receipts for last check, per-version snooze, and last-seen What's New may use namespaced `UserDefaults`; they are not canonical data and may be discarded safely.
- **v3.5 implementation reconciliation (2026-07-18):** FR-SE10 now exists in the clean app. `RedeDomain` owns numeric marketing-version comparison, rolling 24-hour automatic-attempt cadence, and version-scoped seven-day snooze; the app target owns the injectable, non-redirecting Apple Lookup adapter, shared in-flight request, loss-tolerant receipts, Settings rows, non-blocking Today signal, and built-in bilingual What's New. Automatic failures remain silent, explicit failures remain honest, a launch that still needs onboarding conservatively records the current release without presenting, and any other installed-version change presents matching bundled notes once. This means the rare upgrader who never completed onboarding also skips that one automatic sheet, while the permanent Settings entry remains available. Targeted domain/app/localization tests and real iPhone 17 Pro / iOS 26.5 Simulator flows covered current/available/unavailable fixtures, Later, Settings, both locales, maximum Dynamic Type, first install, and an active-training launch. Simulator interaction exposed an observation bug where Later persisted but did not immediately dismiss the signal; a failing observation test now locks the repair. Independent review additionally locked reverse automatic/manual request ordering, stale Settings-result invalidation, exact app-ID/bundle/version response identity, duplicate-record rejection, redirect refusal, and a release guard requiring the current marketing version to have bundled bilingual notes. This is local L3 behavior evidence only: it does not prove a live Apple catalog response, App Store propagation, or TestFlight behavior, and it cannot retroactively notify users running the old 1.8 binary.
- **2026-10-14 status reconciliation — watchOS, Readiness widget, rest Live Activity (WATCH-10; records reality, amends nothing):** verified against the code at `e94cc09` and the history of #431, #550, #701/#704, #719, #732–#748 and #751.
  - *Readiness widget — inside this contract.* `ios/RedeWidget` (target `RedeWidgetExtension`, embedded in the app) is a live production surface, not reference material. Its Readiness widget is a `StaticConfiguration` limited to `.systemSmall` / `.systemMedium` (no lock-screen or accessory family) and only reads a derived schema-v1 `ReadinessWidgetSnapshot` from the App Group `group.com.tinsab.rede`. The app's only writer is `SessionStore.loadToday()` → `refreshWidgetSnapshot()`, which writes only when Today resolves to a readable result and then reloads widget timelines. Nothing else uses the App Group (the watch has none). This matches the §9 WidgetKit and App Group lines. The §5 `RedeWidgetShared` row is incomplete as written; see the dated inventory under §5.
  - *Rest Live Activity (FR-TR13, since 1.7 / build 24) — not named by this contract.* The same extension hosts an `ActivityConfiguration` for `RestActivityAttributes` (lock screen + Dynamic Island). ActivityKit is imported in three places: the app-target `RestLiveActivityController` (thirteen lifecycle endpoints, `pushType: nil`, `staleDate` = rest end + 60 s, one serialized task chain), the iOS-only `RestActivityAttributes` file in `RedeWidgetShared`, and the widget-target UI. It is local-only and display-only and never writes canonical data. ActivityKit appears in neither the §9 allowed list nor the forbidden list (it is mentioned only in these dated notes), and the app-target import falls outside the literal WidgetKit wording.
  - *Apple Watch — present in code without the amendment §2 and §9 require.* A watchOS 10 companion app `ios/RedeWatch` (bundle `com.tinsab.rede.watchkitapp`, embedded through Embed Watch Content, shared scheme `RedeWatch`) and the package `RedeWatchLink` (iOS 17 + watchOS 10; the only `WatchConnectivity` importer) were built in #732–#740 (2026-08-15…18) and iterated in #746/#748/#751. The watch app has been embedded in the iPhone app since #732, at 1.10.2 (build 36); #733's commit records that build 36 went to TestFlight. 1.11.0 (build 38, bumped in #743 on 2026-08-20) is the first marketing version raised for it and the release whose store copy introduces it (#747). The owner's WATCH-10 finding says the watch shipped with 1.11.0; the repo holds no 1.11.0 upload or release record. The quality gate requires App, Widget and Watch versions to match. No commit from #732 onward edited this document. As-built behaviour (descriptive; the code comments call the channel usage "通道纪律", but it is not a rule of this contract): (1) the phone is the only decision maker — the watch recomputes no prescription, renders phone-formatted strings, and never advances a set on its own. This holds by code convention, not by linkage: the watch target links `RedeDomain`, `RedeDataHealth`, `RedePersistence`, `RedeTrainingDecision`, `RedeLocalSnapshot`, `RedeL10n` and `RedeWatchLink`, but imports only `RedeL10n`, `RedeWatchLink` and `RedeTrainingDecision` (using only `RestCountdown`); (2) phone → watch uses only `updateApplicationContext`, carrying one phone-rendered `WatchPrescription`; applicationContext is a single latest-value slot, so today every phone → watch field rides in that one payload, and a second applicationContext sender would overwrite the prescription; (3) watch → phone logged sets use `transferUserInfo` (queued, guaranteed delivery), never `sendMessage`; the phone accepts only the set it is currently waiting for (idempotency key `exerciseId` + `setNumber`). With a live phone flow it goes through the existing in-session `apply(.logSet)` path. With no live flow, a watch-specific draft write path (`appendWatchSetToDraft`) replays the durable, non-canonical `active-session-draft.json`, appends a synthesized `.restFinished` if the replay is resting, appends the set and saves the draft. Watch sets reach canonical AppData only through the phone's existing completion path (`CanonicalSessionWriter.appendCompletedSession`); no canonical writer or canonical mutation class was added; (4) watch → phone rest/skip commands use `sendMessage` and work only while the phone is reachable (an automatic rest-end skip from the watch can advance the phone flow while the phone app is in the background); (5) the watch keeps no data of its own (no App Group, files or `UserDefaults`), and its only persisted output is the Health workout in (6); (6) the watch target imports HealthKit directly: an `HKWorkoutSession` with `HKLiveWorkoutBuilder` follows the phone's `trainingInProgress` flag and keeps the watch app alive. It requests share access for workouts and read access for heart rate and active energy; only heart rate and elapsed time are displayed, on the watch. It writes the workout to Apple Health when that flag turns off (normally when the phone reaches the session summary), except in two cases where it discards the workout and writes nothing: the phone reports an abandoned session, or a set/rest screen has had no phone update for 60 minutes. The whole watch app sits behind a Health workout-write permission gate. None of that HealthKit data reaches the phone, AppData or any engine.
  - *Open conflicts — deliberately not resolved here.* (a) watchOS / WatchConnectivity is still "Deferred" in §2 and "Forbidden without amendment" in §9, yet the runtime exists; (b) the watch's HealthKit use sits outside `RedeHealthKit` (§9) and performs the HKWorkout write that §5 lists as deferred; (c) ActivityKit is used but named in neither §9 list; (d) the as-built phone-authoritative watch design differs from the CRDT co-editing direction recorded in `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` §4. The §2, §5 and §9 contract text is intentionally unchanged; every 2026-10-14 change in this document is a dated note beside it. Each conflict is put to the owner as a proposed amendment (listed in `DEV_LOG.md` 2026-10-14 and the reconciliation PR). The §2 and §9 entries remain in force exactly as written. How they apply to the existing watch code, and to further changes to it, is part of the owner's decision. This note neither authorizes the existing code nor asks for its removal, and it decides nothing about ActivityKit.
  - *Adjacent drift, not reconciled here.* `RedeSync` and `RedeSyncSupabase` (cloud sync, FR-ACC1, #727, 1.10.0) are also on disk and in the CI matrix without an amendment, and they conflict in the same way with the §9 Supabase, `URLSession` and account/auth entries and with the §2 Deferred systems row (account, cloud sync). They need their own reconcile.

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
| Code status | The clean `ios/Rede` app + 10 in-tree Swift packages are the active implementation (M0–M6 shipped plus the fail-closed subscription foundation). Retired IronPath/PWA-era code is reference-only (git tag `legacy-parity-final`) and is not a contract. |
| Target runtime | A clean native iOS SwiftUI app with local Swift packages and local-first persistence. |
| Target source of truth | A single canonical local AppData model, persisted through a gated write path. |
| Target engine boundary | Raw AppData never enters training engines; engines consume clean typed inputs. |
| Target platform scope | Foundation JSON persistence, approved HealthKit adapters, local notifications, WidgetKit/App Group read-only handoff, the implemented-but-production-disabled StoreKit 2 boundary in §5/§9, plus the bounded Apple public-catalog lookup in §9. |
| Deferred systems | Account, cloud sync, CRDT, watchOS, general-purpose remote networking, remote config, remote analytics, referral attribution, third-party subscription SDKs, and server-side entitlement systems require explicit architecture amendments. Subscription runtime and update awareness are authorized only through their bounded slices below. |

> **Status note (2026-10-14, not an amendment):** the code on `main` already contains a watchOS companion app (with WatchConnectivity and a watch-side HealthKit workout session) and an ActivityKit rest Live Activity. The Target platform scope row lists neither, and the Deferred systems row still lists watchOS. `ios/packages/` also holds 13 packages rather than the 10 the Code status row names; see the dated inventory under §5. The table rows are unchanged pending the owner's decision; see the 2026-10-14 header reconciliation.

Removed implementation surfaces:

- Web/PWA runtime and assets.
- Node/Vite build and dev API.
- TypeScript source, contracts, scripts, and Vitest tests.
- Supabase/Vercel implementation candidates, browser sync, account/auth runtime code, and cloud candidate code.
- `RedeCloudSync` Swift package stub.

Active vs reference surfaces:

- The clean `ios/Rede` SwiftUI app, the Readiness widget, and the 10 in-tree Swift packages are the **active implementation**. Status (2026-10-14): the `RedeWidget` extension also hosts the rest Live Activity (ActivityKit, which neither §9 list names). The `RedeWatch` target, `RedeWatchLink`, `RedeSync` and `RedeSyncSupabase` are also merged on `main` and built, but they are not among the approved surfaces above; their architecture status is open (see the 2026-10-14 header reconciliation).
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
├── Rede.xcodeproj        App + widget project
├── Rede.xcworkspace      Workspace
├── ParityFixtures/           Frozen iOS test fixtures
└── packages/                 Local Swift packages
```

This shape is implemented: the clean `ios/Rede` app, `RedeWidget`, `RedeTests`, `ParityFixtures`, and `packages/` all exist. (`RedeCloudSync` and the not-yet-created packages noted in §5 are intentionally absent.) Status (2026-10-14): `ios/RedeWatch/` (watchOS companion app) also exists outside this target tree. `Rede.xcodeproj` holds four targets (`Rede`, `RedeWidgetExtension`, `RedeWatch`, `RedeTests`) and three shared schemes (`Rede`, `Rede-StoreKitTest`, `RedeWatch`). The watch app's architecture status is pending the owner's decision (see header).

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

### Packages present today (10, all in the CI test matrix)

| Package | Responsibility | Depends on |
|---|---|---|
| `RedeDomain` | Codable AppData model, domain values, and small platform-independent app policies such as review/update cadence and semantic version comparison. | Foundation only |
| `RedeDataHealth` | Clean AppData projection, repair logic, and runtime guards. | `RedeDomain` |
| `RedeTrainingDecision` | Training decision, readiness, scheduling, progression, insights, muscle level, support allocation, session prescription, and coach-action engines. | `RedeDomain`, `RedeDataHealth` |
| `RedePersistence` | AppData store protocol, JSON file store, and canonical write orchestration. | `RedeDomain` |
| `RedeLocalSnapshot` | Derived Focus/session history snapshots. Never canonical AppData. | Foundation only |
| `RedeWidgetShared` | Read-only widget snapshot model and App Group snapshot store. | Foundation only |
| `RedeL10n` | Terms and formatting support. | Foundation only |
| `RedeNotifications` | Local-notification policies (FR-NT1/2) + the `#if os(iOS)` UNUserNotificationCenter adapter behind a `NotificationScheduling` seam. Pure policy is host-tested; derived/transient, never canonical, no remote/push. | Foundation only |
| `RedeHealthKit` | Approved read-only HealthKit body-weight adapter (`BodyWeightReading` + `#if os(iOS)` `HKBodyWeightReader`). Display-only; never canonical and never engine truth. Workout import / HKWorkout write remain deferred. | Foundation only |

> **Dated inventory (2026-10-14, status only; the table above is unchanged):** `ios/packages/` holds 13 packages, all in the CI and quality-gate `EXPECTED_PACKAGES`. Three are not in the table, and none of them has an architecture amendment:
> - `RedeWatchLink` (#732): the phone ↔ watch message shapes plus one `WCSession` wrapper; WatchConnectivity is imported only in `WatchLink.swift`. Its as-built channel usage is described in the header.
> - `RedeSync` and `RedeSyncSupabase` (cloud sync, #727): not reconciled here.
>
> Two table rows are incomplete as written:
> - `RedeWidgetShared` also contains the WidgetKit timeline reloader and, in an `#if os(iOS)` file, the rest Live Activity's `RestActivityAttributes`, which imports ActivityKit. ActivityKit is named in neither §9 list.
> - `RedeHealthKit` itself still performs no workout import and no HKWorkout write. The watch target writes HKWorkouts with HealthKit directly, outside this package.
>
> All of these are open conflicts pending the owner's decision; see the header.
| `RedeEntitlements` | Pure Free Core/Paid Coach policy, fail-closed launch configuration, StoreKit 2 product/transaction/restore adapter, entitlement lifecycle model, and package-owned StoreKit subscription/management UI wrappers. Never canonical or engine truth. | Foundation; StoreKit/SwiftUI only in narrow platform/UI files |

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

---

## 6. Source Of Truth

The target source of truth for the clean rewrite is canonical AppData.

| Surface | Source of truth | Derived records |
|---|---|---|
| Native iOS target | `RedeDomain.AppData`, persisted through `RedePersistence.JSONFileAppDataStore` | Local snapshots, widget snapshots, HealthKit exports, UI view models |
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
- HealthKit only inside `RedeHealthKit` (created, FR-PR8 scope A: read-only body-weight `HKBodyWeightReader` behind the `BodyWeightReading` seam; display-only, never engine truth).
- UserNotifications only inside `RedeNotifications` (created, FR-NT1/2: local rest/weekly reminders behind `NotificationScheduling`).
- WidgetKit only inside the widget target and `RedeWidgetShared` adapter.
- App Groups only for the read-only widget snapshot handoff.
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
- watchOS / WatchConnectivity
- CRDT storage or sync
- RevenueCat or any other third-party subscription SDK
- Rede-hosted receipt validation or entitlement servers

> **Status note (2026-10-14, not an amendment):** within the watch / Readiness widget / Live Activity scope of the 2026-10-14 reconciliation, the code on `main` conflicts with this section in three places. (Separately, cloud sync, `RedeSync` / `RedeSyncSupabase` from #727, conflicts with the Supabase, `URLSession` and account/auth entries; it is not reconciled here.) (1) watchOS / WatchConnectivity: the `RedeWatch` app and the `RedeWatchLink` package exist. (2) HealthKit outside `RedeHealthKit`: the watch target runs an `HKWorkoutSession` and writes HKWorkouts. (3) ActivityKit: the rest Live Activity imports it in the app target, `RedeWidgetShared` and the widget target, and ActivityKit appears in neither list above. The WidgetKit and App Group lines match the code. Both lists above are unchanged until the owner decides the proposed amendments; the as-built boundaries are in the 2026-10-14 header reconciliation.

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

Status (2026-10-14): the iOS build above only produces a resource-only stub of the embedded watch app. A real, installable watchOS build needs the shared `RedeWatch` scheme. #746 recorded `xcodebuild build -scheme RedeWatch -destination 'platform=watchOS Simulator,id=…'`; `-target RedeWatch` fails to resolve the local packages. CI and the quality gate run all package tests, including `RedeWatchLink` and the app-hosted watch-set intake tests. They do not build the `RedeWatch` scheme. Whether watchOS becomes a required validation target depends on the open watchOS decision (see header).

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
