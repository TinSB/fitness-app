# Agent 7 — Security / Privacy / App Store Audit (iOS Native Migration V1)

Status: docs-only audit, no runtime changes.
Audit window: iOS Native Migration Entry Gate V1, single-user-multi-device product scope.
Worktree: `peaceful-hugle-21e407`.

---

## 1. Mission

Identify, for the iOS-native rewrite of IronPath:

- What personal data the app collects, processes, and persists today, and what categories Apple's privacy nutrition labels map to.
- The minimum HealthKit permission set the iOS app must request, plus user-facing `Info.plist` usage description strings.
- Logging, telemetry, and observability policy for V1, including what MUST NEVER appear in any log or audit record.
- Export and delete flows the user controls, and the App Store Review Guidelines they intersect with (specifically 5.1.1(v) "account deletion in-app").
- Encryption Export Compliance answer that ships in the `Info.plist`.
- Whether Sign in with Apple (SIWA) is required given the current auth surface.
- How env/secret handling on iOS should mirror the existing web posture so secrets never end up in the app binary.

Out of scope (handed to other agents):

- The end-to-end UX of the account / export / delete screens (Agent 5).
- Cloud sync conflict resolution UX (Agent 4 / cloud agent).
- Native HealthKit integration architecture choices (Agent 3 / iOS data agent).
- Final privacy policy text. This report drafts only the `Info.plist` strings — the website-hosted privacy policy is owner-authored later.

---

## 2. Inputs inspected

Code:

- `src/engines/healthImportEngine.ts` — file-import entry point, validates XML/CSV/JSON.
- `src/engines/healthSummaryEngine.ts` — derived readiness summary, never logs raw samples.
- `src/engines/appleHealthStreamingImportEngine.ts` — streaming XML parser with raw-attr allow-list.
- `src/engines/appleHealthXmlImportEngine.ts` — non-streaming XML parser with the same raw-attr allow-list.
- `src/engines/appleHealthTypeMap.ts` — the authoritative list of HealthKit identifiers IronPath understands.
- `src/features/HealthDataPanel.tsx` — health import UI shell.
- `src/storage/backup.ts` — JSON export/import; sanitizer-gated.
- `src/auth/authBoundary.ts`, `src/auth/authProviderTypes.ts` — auth surface; today returns `auth_runtime_not_implemented`.
- `src/cloudProduction/supabaseEnvironmentProjectGuard.ts` — rejects service-role keys in browser config.
- `src/cloudProduction/productionSecretsEnvironmentGuard.ts` — rejects secret-shaped keys in browser config.
- `src/cloudProduction/supabaseDataModelRlsContract.ts` — RLS contract: every cloud table is keyed by `owner_user_id = auth.uid()`.
- `src/cloudProduction/cloudOperationJournal.ts` — idempotency journal; stores only hashes, scope, status.
- `src/cloudProduction/monitoringAuditBoundary.ts` — in-memory audit collector with key-fragment redaction (`secret`, `token`, `password`, `private`, `authorization`, `rawAppData`).
- `src/cloudProduction/monitoringAuditAdapterCandidate.ts` — adapter candidate; explicitly `externalTransport: 'none'`, `noExternalUpload: true`, and drops metadata keys containing `appdata`, `localstorage`, `traininglog`, `workoutlog`, `secret`, `token`, `servicerole`, `note`, `payload`, `password`, `private`.
- `src/observability/redaction.ts` — privacy-safe log redactor matching `password`, `secret`, `token`, `credential`, `authorization`, `cookie`, `session`, `appdata`, `storage`, `email`.
- `src/diagnostics/cloudSyncDiagnostic.ts` — explicitly documents "no tokens, no env, no service-role keys, no raw AppData, no full Supabase userId — at most the first 8 hex chars of a non-secret content hash."
- `src/cloudProduction/supabaseAuthRuntimeAdapter.ts` — only `signInWithPassword` and `signUp` are wired; no OAuth provider call sites exist anywhere in `src/`.
- `src/cloudProduction/supabaseProjectRuntimeReadinessCheck.ts` — defines the four required `VITE_*` browser-safe env keys.
- `scripts/scan-production-dist-safety.mjs` — CI guard that scans the built bundle for JWT-shaped tokens, `sk_*`/`pk_*`/`sb_secret_*` keys, Google API keys, `SUPABASE_SERVICE_ROLE*` env names, literal `access_token`/`refresh_token` assignments, and destructive `localStorage.clear(`. Already wired into CI.
- `package.json` — confirms zero analytics/crash SDKs (only `@supabase/supabase-js`, `ajv`, `lucide-react`, `react`, `react-dom`).
- `src/models/training-model.ts` — `AppData` shape, including `UserProfile` (name, sex, age, height, weight), `ScreeningProfile` (health-adjacent), `painNotes`, free-text `notes` fields on sessions/templates.

Docs:

- `docs/PHASE10_PRODUCTION_AUTH_CLOUD_SYNC_DEPLOYMENT_ENTRY_GATE.md` — Phase 10 entry-gate authorisation; confirms cloud is explicit opt-in and `localStorage` remains source of truth.
- `docs/CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md` — Supabase Postgres as cloud database, document-first AppData snapshot, RLS-protected.
- `docs/REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md` — historical iPhone PWA conflict diagnostic; reaffirms "no service-role access in .env.local", "anon key only".
- `docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md` — existing privacy/security control matrix (already aligned with App Store posture).
- `docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md` — account deletion lifecycle policy gate.
- `docs/AUTH_PROVIDER_STRATEGY_DECISION.md` — current auth strategy.
- `SECURITY.md` — existing threat model and accepted compromises.

Env:

- `.env.example` is intentionally empty other than a Chinese comment: "IronPath 当前是纯前端本地存储应用，默认不需要环境变量。"
- `.env.local` referenced in docs holds the Supabase anon key + project URL only. No `SUPABASE_SERVICE_ROLE_KEY` exists in any environment file or in the repo.

---

## 3. Personal data inventory

For each category, this row also notes the iOS-side App Privacy nutrition-label mapping (Apple's [Data Type list](https://developer.apple.com/app-store/app-privacy-details/)).

| Data class | Concrete fields | Where it lives today | Touches cloud? | iOS App Privacy mapping |
|---|---|---|---|---|
| User profile basics | `UserProfile.name` (display name only, not legal name), `sex`, `age`, `heightCm`, `weightKg` | `AppData.userProfile` in `localStorage` (web) / on-device store (iOS) | Only if user opts into cloud sync | **Health & Fitness → Fitness**; `name` is optional self-set display name and is NOT tied to identity/ad targeting → not "Name" in Apple's identifier sense, but the safer label is **Identifiers → User ID** if used as account display |
| Screening / injury profile | `ScreeningProfile.postureFlags`, `movementFlags`, `painTriggers`, `restrictedExercises`, `correctionPriority`, `painNotes[]` (free text) | `AppData.screeningProfile` (local) | Only if user opts into cloud sync | **Health & Fitness → Health** (movement limitations and pain notes are health-adjacent) — TREAT AS SENSITIVE |
| Training history | `AppData.history[]` — sessions, sets, reps, loads, e1RM, RPE, free-text `notes` on sessions and template entries | Local AppData | Only if user opts in | **Health & Fitness → Fitness** |
| Body weight series | `AppData.bodyWeights[]`, plus body weight samples imported from Apple Health | Local AppData | Only if user opts in | **Health & Fitness → Health** |
| Apple Health imported samples | `HealthMetricSample` (sleep, RHR, HRV, heart rate, steps, active energy, exercise minutes, body weight, body fat %, VO2Max) and `ImportedWorkoutSample` (workout type, duration, energy, avg/max HR, distance) | Local AppData | Only if user opts in | **Health & Fitness → Health** for HR/HRV/sleep/body composition; **Health & Fitness → Fitness** for workouts/steps/energy/exercise minutes |
| Today status | `AppData.todayStatus` (sleep state, energy state, soreness, available time) | Local AppData | Only if user opts in | **Health & Fitness → Fitness** |
| Plan / templates | `AppData.templates`, `AppData.programTemplate`, `AppData.mesocyclePlan` — includes user-modified free-text `name`, `note`, `notes` | Local AppData | Only if user opts in | **User Content → Other User Content** (training plan notes); plus **Health & Fitness → Fitness** for plan metrics |
| Adaptive / coach state | `AppData.dismissedCoachActions`, `dismissedDataHealthIssues`, `pendingSessionPatches`, `adaptiveCalibration` | Local AppData | Only if user opts in | **Health & Fitness → Fitness** (derived) |
| Data-health repair ledger | `AppData.settings.dataHealthRepairLedger` — keyed by `repairId`, `idempotencyKey`, `appliedAt`, `affectedIds[]`, `appDataHashBefore/After` (hashes, not raw payloads) | Local AppData | Only if user opts in (carried as part of `settings`) | **Diagnostics → Crash Data / Other Diagnostic Data** — but it is on-device and never uploaded by default |
| Auth identity (cloud-only) | Supabase `user.id` (UUID), email if user enters one; password handled by Supabase SDK | Supabase Auth, in browser memory only via SDK | Yes (only if cloud enabled) | **Contact Info → Email Address**; **Identifiers → User ID** |
| Auth session token (cloud-only) | Supabase `access_token` / `refresh_token` | Held by Supabase SDK in browser `localStorage` keys it owns; we never read them | Yes (cloud session) | NOT collected by IronPath itself per Apple's definition — Supabase manages it. Still: NEVER copy into our own logs or AppData |
| Operation journal entries | `CloudOperationJournalEntry` — `operationId`, `cloudIdempotencyKey`, `sourceSnapshotHash`, `targetSnapshotHash`, `status` | Local AppData (today) | Yes if cloud enabled | **Diagnostics → Other Diagnostic Data** — hashes only, no PII |
| Crash data | None today; no Crashlytics, no Sentry, no any analytics SDK | n/a | n/a | If we add it later: **Diagnostics → Crash Data** with explicit opt-in |

App Privacy summary card (proposed for App Store Connect):

- Data Linked to You: **Health & Fitness (Health)**, **Health & Fitness (Fitness)**, **User Content (Other User Content — training plans / notes)**, **Identifiers (User ID)** when cloud sync is enabled; **Contact Info (Email Address)** only if user signs up for cloud sync.
- Data Not Linked to You: none collected automatically — IronPath does not collect device identifiers, advertising IDs, location, contacts, photos, microphone, etc.
- Data Used to Track You: NONE. IronPath does not use any data for tracking under Apple's definition. App Tracking Transparency prompt is therefore NOT required (and must not be added).

---

## 4. HealthKit permission strategy + draft Info.plist strings

### 4.1 Strategy

- **Read-only, minimal scope.** IronPath today only ingests Apple Health data; it never writes back to HealthKit. The iOS rewrite MUST request `HKHealthStore.requestAuthorization` with read types only.
- **No `share` (write) types requested in V1.** This means `NSHealthUpdateUsageDescription` is OPTIONAL — Apple only requires it if you set non-empty share types. Recommendation: omit `NSHealthUpdateUsageDescription` in `Info.plist` until a future feature explicitly needs write access. If we add session-write later (e.g. publish completed strength sessions back to Apple Health as `HKWorkout` with `HKWorkoutActivityType.traditionalStrengthTraining`), revisit then with a separate review.
- **Request lazily, on user action.** Do not request HealthKit permission at app launch. Request only when the user first taps "导入 Apple 健康数据 / Connect Apple Health" on the Health panel. Apple rejects apps that gate the whole experience behind a permission prompt with no context.
- **Show purpose in-app before the prompt.** A pre-prompt screen explaining "We will read your weight, workouts, heart rate, and sleep to adjust today's training" is recommended (App Review Guideline 5.1.1(i) — purpose strings must be meaningful and reflect actual use).
- **Per-type granular request.** Request only the types from `APPLE_HEALTH_RECORD_TYPE_MAP` in `appleHealthTypeMap.ts`, mapped to the canonical `HKObjectType` constructors below. Do NOT request additional types "in case we need them later" — Apple's review can flag broad health-data requests.

### 4.2 Minimum HealthKit read set

Mapped 1:1 from `src/engines/appleHealthTypeMap.ts`. The web export.xml path already shows these are the only identifiers IronPath has runtime logic for.

| iOS-native HealthKit type | Source identifier in repo | Used for |
|---|---|---|
| `HKQuantityType.quantityType(forIdentifier: .restingHeartRate)` | `HKQuantityTypeIdentifierRestingHeartRate` | Readiness assessment |
| `HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)` | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | Readiness assessment |
| `HKQuantityType.quantityType(forIdentifier: .heartRate)` | `HKQuantityTypeIdentifierHeartRate` | Activity load |
| `HKQuantityType.quantityType(forIdentifier: .stepCount)` | `HKQuantityTypeIdentifierStepCount` | Activity load |
| `HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)` | `HKQuantityTypeIdentifierActiveEnergyBurned` | Activity load |
| `HKQuantityType.quantityType(forIdentifier: .appleExerciseTime)` | `HKQuantityTypeIdentifierAppleExerciseTime` | Activity load |
| `HKQuantityType.quantityType(forIdentifier: .bodyMass)` | `HKQuantityTypeIdentifierBodyMass` | Bodyweight series, e1RM-relative load |
| `HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)` | `HKQuantityTypeIdentifierBodyFatPercentage` | Composition trend |
| `HKQuantityType.quantityType(forIdentifier: .vo2Max)` | `HKQuantityTypeIdentifierVO2Max` | Conditioning trend |
| `HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)` | `HKCategoryTypeIdentifierSleepAnalysis` | Readiness assessment |
| `HKWorkoutType.workoutType()` | implicit (Workout records) | External workouts ingested as `ImportedWorkoutSample` |

Open question: whether the iOS app reads "heart rate during workout" via `HKWorkoutRoute` / `HKQuantitySeriesSampleQuery` or only the workout's summary average/max. The web export.xml path uses summary (`avgHeartRate`, `maxHeartRate`) — recommend the iOS app match that until a clear UX need justifies series queries.

### 4.3 Draft Info.plist usage description strings

These are user-facing. They appear in the iOS permission sheet. Apple requires the strings to explain the actual purpose; vague strings get rejected.

`NSHealthShareUsageDescription` (REQUIRED — we read from Health):

- English: `IronPath reads your workouts, body weight, heart rate, HRV, sleep, steps, and active energy from Apple Health so it can adjust today's training load to your recovery and progress. Your Health data stays on your device unless you turn on optional cloud sync.`
- 简体中文: `IronPath 会从 Apple 健康读取你的训练、体重、心率、HRV、睡眠、步数和活动能量，用来根据你当前的恢复状态调整今天的训练强度。除非你主动开启可选的云同步，否则这些健康数据只保存在你的设备上。`

`NSHealthUpdateUsageDescription` (OMIT in V1 — no write access needed):

- We do NOT request `share` types in V1, so this key MUST be absent. If iOS-side reviewers ever see `NSHealthUpdateUsageDescription` in our Info.plist without a corresponding write-type request, that's a red flag — remove it.
- (Future write feature draft, for reference only — DO NOT ship in V1): `IronPath publishes your completed strength training sessions back to Apple Health as workouts so they appear in your daily activity rings.` / `IronPath 会把你完成的力量训练作为 workout 写回 Apple 健康，让你的训练能体现在每日活动环里。`

Other privacy-relevant `Info.plist` keys that may or may not be needed:

- `NSCameraUsageDescription`: NOT NEEDED in V1 — no camera use.
- `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription`: NOT NEEDED in V1 — no photo upload feature.
- `NSMicrophoneUsageDescription`: NOT NEEDED — no audio.
- `NSLocationWhenInUseUsageDescription`: NOT NEEDED — no location.
- `NSMotionUsageDescription`: NOT NEEDED — we use HealthKit, not raw CMMotion.
- `NSUserTrackingUsageDescription`: NOT NEEDED and MUST NOT be added — we do not track across apps. Adding this key would trigger an unnecessary ATT prompt and is a downgrade in user trust.
- `NSFileProviderDomainUsageDescription` / Files-app entitlement: needed only if the iOS app allows importing user-picked CSV/JSON backup files via the Files picker (recommended for the "import backup" flow). This is the standard document-picker pattern and does not require a usage-description string for read access via `UIDocumentPickerViewController`.

---

## 5. Logging policy

### 5.1 What MUST NEVER be logged (any sink — Xcode console, OSLog, future Sentry/Crashlytics, future analytics, support bundle, audit collector, diagnostic snapshot)

Hard exclusion list. Test/guard infrastructure for this on the web side already exists (`src/observability/redaction.ts` matches these key fragments, and `src/cloudProduction/monitoringAuditAdapterCandidate.ts` explicitly drops them). The iOS-side logger MUST implement an equivalent redactor before V1 ships.

| Class | Examples | Why |
|---|---|---|
| Auth credentials | Email value, password (any form), Supabase `access_token`, `refresh_token`, any JWT-shaped string | Account takeover risk; Apple requires no plaintext credential logging (5.1.1) |
| Service-role / admin keys | `SUPABASE_SERVICE_ROLE_KEY`, any `sb_secret_*`, `sk_*`, `pk_*`, `AIza*`-shaped Google API keys | They must never exist client-side, and never appear in any binary or log |
| Raw AppData payloads | The entire `AppData` blob, sub-trees (`history`, `templates`, `programTemplate`, `screeningProfile`), or any serialized snapshot | Contains all personal training, screening, and bodyweight data |
| Raw HealthKit samples | Any `HealthMetricSample` value (bodyweight kg, RHR bpm, HRV ms, sleep duration), any `ImportedWorkoutSample`, the entire raw export.xml | Health data; both sensitive and subject to App Store Health-data review |
| Free-text user content | `UserProfile.name`, `painNotes`, session `notes`, template `note`, `SupportExerciseLog.notes`, `adjustmentNotes` | May contain personal context (injuries, identifying info); also user content under App Review Guidelines |
| Identity values | Full Supabase `user.id` (UUID), email, IP, device fingerprint, Apple ID | Linkable PII |
| LocalStorage contents | Any raw `localStorage` key/value pair | Includes auth tokens managed by Supabase SDK and all AppData |
| Repair receipt details | Raw `before`/`after` blobs from `DataRepairLogEntry`, raw `affectedIds[]` payloads — only the count and stable IDs are safe | `before`/`after` can carry session payloads |
| File system paths revealing user identity | `/Users/<realname>/...` paths | Identifies the device owner |

### 5.2 What MAY be logged at INFO / ERROR

A log line is acceptable iff every field is one of:

- A stable enum/code from a closed allow-list (e.g. `last_sync_status: 'conflict_review_required'`, `repair_status: 'applied' | 'no_op' | 'failed'`).
- A non-secret content hash, truncated to ≤ 8 hex chars (the existing diagnostic snapshot pattern from `src/diagnostics/cloudSyncDiagnostic.ts`).
- A count or duration in milliseconds.
- A boolean.
- An `operationId` / `requestFingerprint` that is generated client-side, contains no PII, and is randomized per session.
- An ISO timestamp.
- A bounded build identifier (`build=<sha-short>`) for support correlation.

Example acceptable log lines (modeled on existing repo style):

- `health.import: source=apple_health_export samples=42 workouts=3 dropped=1 durationMs=812`
- `cloud.sync: status=accepted source_hash=ab12cd34 build=cd63b67`
- `repair.apply: repairId=duration_sanity status=applied occurrences=2 affected=3`

Anything that can't be expressed in that vocabulary belongs in a user-visible message, not a log.

### 5.3 Default log sinks for V1

- **Xcode debug log (`os_log` / `Logger`) — DEBUG builds only.** Strip in release. Use `Logger(subsystem: "com.ironpath.app", category: "...")`. Apply the redactor before write.
- **OSLog at `.default` privacy level in release** — anything redactable should be marked `\(value, privacy: .private)` so it does not appear in the unified log unless a developer profile is installed. Anything that would leak PII even with `.private` masking must not be logged at all.
- **In-memory diagnostic ring buffer** — last N events, viewable from `设置 → 诊断信息` and copyable for support bundles. Same redaction.
- **NO remote upload sink in V1.** No Sentry. No Crashlytics. No Firebase. No analytics. (See §11 for the policy and the "future opt-in" gate.)

---

## 6. Data minimization rules

- **Default: nothing leaves the device.** No telemetry, no analytics, no crash upload. Cloud sync is OFF by default and must be explicitly toggled by the user.
- **HealthKit samples are filtered at ingest.** `appleHealthTypeMap.ts` already constrains the schema to a small allow-list; the iOS-native ingest MUST match that allow-list, NOT pull everything HealthKit offers. If a HealthKit type isn't on the list, drop it at the boundary.
- **`raw` attribute allow-list.** The web XML parsers (`appleHealthXmlImportEngine.ts:53-68`, `appleHealthStreamingImportEngine.ts:54-65`) keep only `type`, `sourceName`, `unit`, `startDate`, `endDate`, `value`, `workoutActivityType`, `duration`, `durationUnit` in the `raw` object on each sample, dropping every other XML attribute. The iOS equivalent should reuse the same allow-list — do not store the full HKObject describing a workout's app source, device, metadata, hardware version, etc.
- **No telemetry on health-import contents.** "User imported N samples" is OK; "user imported these RHR values" is NEVER OK.
- **No background HealthKit observers in V1.** Observer queries (`HKObserverQuery`, background delivery) silently grow the data the app sees. V1 should pull on user action only. If background fetch is added later (e.g. to keep readiness up to date), it must be a separate, user-toggleable setting.
- **No tracking SDKs.** None in `package.json` today. None to be added on iOS.
- **No advertising SDKs.** Same.
- **No IDFA / IDFV access.** No `ASIdentifierManager`, no `UIDevice.identifierForVendor` for cross-launch identification beyond what `KeychainAccess`-style local-only use requires.
- **Hash before journal.** The `cloud_sync_operations` design (`supabaseDataModelRlsContract.ts:170-175`) and the `CloudOperationJournalEntry` (`cloudOperationJournal.ts`) already store hashes (`source_snapshot_hash`, `target_snapshot_hash`) rather than payloads. iOS must keep this discipline.

---

## 7. Export / delete flows (user-controlled)

This section sets the policy; Agent 5 owns the screen design.

### 7.1 Export

- **User-initiated only.** No background export, no auto-cloud-export.
- **Scope: the full local AppData JSON.** Match the existing `exportAppData` (`src/storage/backup.ts:13`): `JSON.stringify(sanitizeData(data), null, 2)`. The sanitizer is gate-kept; do not re-implement on iOS — port the sanitize rules verbatim.
- **Filename: `getBackupFileName(date)`** → `ironpath-backup-YYYY-MM-DD.json` (existing format).
- **iOS delivery channel:** `UIActivityViewController` so the user picks where to save (Files, AirDrop, mail, third-party app). Use `UTType.json`. Do NOT default-upload to iCloud Drive or anywhere else without user choice.
- **Encryption at rest of the exported file:** out of IronPath's control — once it leaves the app via Share Sheet, iOS-system handles. The export file IS plaintext JSON. Communicate clearly: "this file contains all your training data and personal info; treat like a password."
- **No HTTP export endpoint.** Phase 10 policy already blocks `backup/import/export over HTTP` (see `PHASE10_PRODUCTION_AUTH_CLOUD_SYNC_DEPLOYMENT_ENTRY_GATE.md`). iOS V1 should likewise have no server export — it goes through Share Sheet to wherever the user wants.

### 7.2 Delete

The control matrix (3 cases, ordered by destructiveness):

1. **Delete local data only** — clears AppData in the iOS app's container (`UserDefaults`, Core Data store, or whatever the iOS rewrite chooses). Does NOT touch the cloud snapshot. Requires explicit confirmation (e.g. type "DELETE" or hold-to-confirm). Must offer "Export first" as the same-screen affordance.
2. **Delete cloud snapshot only** — deletes the row in `cloud_appdata_snapshots` keyed by the signed-in user, plus its derived rows in `cloud_sync_operations`, `cloud_devices`, `cloud_conflicts`, `cloud_export_delete_requests`. RLS already enforces "you can only delete your own rows" (`supabaseDataModelRlsContract.ts`). Local data remains.
3. **Full account deletion (App Store-compliant deletion)** — deletes #1 + #2 + the Supabase Auth user itself. THIS MUST BE A SINGLE TAP-PATH FROM IN-APP per App Review Guideline 5.1.1(v). See §10.

All three cases must:

- Show the user, in plain Chinese, exactly what will be deleted.
- Offer "Export before delete" inline.
- Show a final, undismissable confirmation.
- Be irreversible — no undo.
- Produce a privacy-safe receipt (in `cloud_export_delete_requests` for cases 2/3; in a local audit log for case 1) containing only `request_type`, `status`, `confirmed_at` — no PII.

### 7.3 Open question for Agent 5

How long after "Delete cloud snapshot" does the user have to recover, if at all? Current cloud data lifecycle docs say "no auto-restore"; iOS V1 should match. If we want a 7-day soft-delete window, that's a separate decision and requires server-side scheduled cleanup that is currently NOT implemented.

---

## 8. App Store review risk list

Ordered by severity (impact × likelihood at the V1 review).

| # | Risk | Likelihood | Mitigation in V1 |
|---|---|---|---|
| 1 | **Health-data misuse: usage description is too vague, app stores Health data for ads / sells to third parties.** Guideline 5.1.1(i), 5.1.1(ii), 5.1.3 explicitly forbid using Health data for advertising or selling to third parties. | High impact, low likelihood | Use the draft `NSHealthShareUsageDescription` in §4.3 — specific, names the data classes and the purpose. Never add any advertising SDK. Document in App Privacy that Health data is "linked to user, not used for tracking, not shared." Privacy policy URL must say the same. |
| 2 | **Missing in-app account deletion (Guideline 5.1.1(v), required since 2022-06).** Apps that allow account creation must allow in-app account deletion. | Medium impact, medium likelihood | Ship a "Delete account" path in V1 IFF cloud sync (which creates a Supabase account) is exposed. If cloud sync ships in V1, deletion must ship in V1. See §10. |
| 3 | **Encryption Export Compliance.** Apple asks `ITSAppUsesNonExemptEncryption`. Wrong answer here can block release or require ERN. | Low impact, medium likelihood | Set `ITSAppUsesNonExemptEncryption = NO` in `Info.plist` (we only use HTTPS via standard URLSession + Supabase SDK = exempt). See §9. |
| 4 | **Background HealthKit observers triggering surprise data access.** Apple penalizes apps that pull more Health data than the user agreed to. | Medium impact, low likelihood | V1: no background observers. Pull on user tap only. |
| 5 | **HealthKit write access requested but unused.** If `NSHealthUpdateUsageDescription` is set but the app never writes, review may flag it. | Low impact, medium likelihood | OMIT `NSHealthUpdateUsageDescription` in V1. |
| 6 | **User-Generated Content moderation (Guideline 1.2).** If users can write free-form text (`painNotes`, session `notes`) that is shareable to other users, App Store wants report/block flows. | Very low — IronPath is single-user, content is not shared | DOCUMENT in the App Store Connect notes: "Notes are single-user, never shared with other users; no UGC moderation flow is required." If future versions add social/sharing, revisit. |
| 7 | **Sign in with Apple required (Guideline 4.8).** SIWA is required IF the app offers another third-party login (Google, Facebook, Twitter, etc.). | Low impact, low likelihood | Current `supabaseAuthRuntimeAdapter.ts` only uses email/password (`signInWithPassword`, `signUp`). NO third-party OAuth provider is wired anywhere in `src/`. SIWA is therefore NOT required for V1. If a future task adds Google/etc., SIWA MUST be added alongside. |
| 8 | **App Tracking Transparency (Guideline 5.1.2).** ATT prompt required IF the app tracks across apps/websites. | n/a | We don't track. NSUserTrackingUsageDescription MUST be absent. No prompt to add. |
| 9 | **PWA / WKWebView shell rejection (Guideline 4.2).** If the iOS app is a thin WebView wrapping the existing PWA, review can reject "We don't allow web apps repackaged as native apps." | High impact, depends on architecture | This is for the iOS architecture agent; from a privacy standpoint, a true native rewrite eliminates this risk class and is what V1 plans. |
| 10 | **App Store secrets in binary.** Supabase anon key, project URL embedded into `Info.plist` / `xcconfig`. Anon key is OK to ship (it's public-by-design); service role key must NEVER end up in the binary. | Medium impact, low likelihood | Mirror the web posture: `.xcconfig` carries `SUPABASE_URL`, `SUPABASE_ANON_KEY`. CI scans the `.ipa` for JWT shapes, `sb_secret_*`, `SUPABASE_SERVICE_ROLE` — same `scan-production-dist-safety.mjs` patterns ported to a Swift script or `grep`-against-`.ipa`. |
| 11 | **Medical / fitness misclassification (Guideline 1.4.1).** Apps that make medical claims need stronger evidence. | Low impact, low likelihood | IronPath is explicitly NOT medical advice. `SECURITY.md:10` already states this. Reinforce in app copy ("不提供医疗诊断") and on the App Store description. |
| 12 | **Local data persistence in iCloud backup.** iOS-default iCloud backup will include AppData unless `.isExcludedFromBackup` is set. This isn't a rejection risk, but is a privacy choice. | n/a | Recommendation: ALLOW iCloud backup by default (users expect their training data to survive a phone restore). Document this in privacy policy. Add a setting "Exclude IronPath from iCloud backup" for privacy-sensitive users. Open question for Agent 5 / iOS data agent. |

---

## 9. Encryption Export Compliance

`Info.plist` must declare `ITSAppUsesNonExemptEncryption`.

**Recommendation: `ITSAppUsesNonExemptEncryption = NO`.**

Rationale (per Apple's [Export compliance documentation](https://developer.apple.com/documentation/security/complying_with_encryption_export_regulations)):

- IronPath does not implement custom cryptography.
- IronPath uses HTTPS via `URLSession` (system-provided) and the Supabase JS SDK, both of which use standard, exempt encryption.
- IronPath uses Keychain via Security.framework, which is exempt.
- IronPath does not export, re-export, or sell encryption functionality. The crypto is all OS- or library-provided for the purpose of "secure communication" / "authentication" / "secure storage of data," which fall under the broad exemptions in §740.17(b)(2).

Therefore the app qualifies for the standard exemption and the `NO` declaration is accurate.

Action items for the iOS migration:

- Set `ITSAppUsesNonExemptEncryption = NO` (Boolean) in the iOS app's `Info.plist`.
- DO NOT submit an ERN (Encryption Registration Number) — not required at the NO declaration level.
- If a future feature adds custom crypto (e.g. client-side AppData encryption with user-derived key), flip to `YES` and re-evaluate; will likely still be exempt under §740.17(b)(1) but the declaration changes.

---

## 10. Account deletion in-app requirement

Apple App Review Guideline 5.1.1(v), effective 2022-06-30, requires:

> "Apps that support account creation must also offer account deletion within the app."

### 10.1 Applicability to IronPath V1

- **If V1 of the iOS app exposes cloud sync (signup/sign-in via Supabase email+password):** account deletion IS in scope and MUST ship in V1.
- **If V1 ships local-only (no Supabase account creation surface):** account deletion does NOT apply because no account is created. Recommended path if cloud sync UX isn't ready.

Given current code state — `supabaseAuthRuntimeAdapter.ts` has a wired `signUp` path and the cloud database contract (`supabaseDataModelRlsContract.ts`) explicitly includes `cloud_export_delete_requests` as a required table — the project is preparing for cloud sync. The honest reading is that V1 likely DOES expose account creation and therefore DOES need deletion.

### 10.2 Required UX (single tap-path from in-app)

Must be reachable from a clearly labeled menu, no more than a couple of taps deep. App Review explicitly tests for this. Suggested location: `Settings / 我的 → 账号与同步 → 删除账号`.

Functional spec:

1. Initiate from "Delete account" entry — show what will be deleted (cloud snapshot + auth identity + optional local data wipe).
2. Offer "Export my data first" same-screen link (Section 7.1).
3. Final confirmation that user must actively perform (type "DELETE" or hold-to-confirm).
4. Server-side: row in `cloud_export_delete_requests` with `request_type='account_delete'`, `status='pending'` → confirmed → `confirmed_at` set. Then: delete `cloud_appdata_snapshots`, `cloud_sync_operations`, `cloud_devices`, `cloud_conflicts` rows for this user; finally call Supabase `auth.admin.deleteUser` (server-side function, NOT client) or its equivalent.
5. Client receives confirmation, signs out, returns to local-only mode.
6. No "are you sure you want to come back?" within 7 days — deletion is final. Document this clearly.

### 10.3 Open question: server-side execution

`auth.admin.deleteUser` requires service-role key, which by IronPath's own contract MUST NOT exist in the client. Options:

- Supabase Edge Function with service role binding, invoked from client with authenticated `user.id` from `auth.uid()` — the function verifies `user.id === auth.uid()` then deletes.
- Postgres function (`SECURITY DEFINER`) that performs the same checks.

This is an open server-side implementation task, NOT a client decision. Flag to Agent 4 (cloud agent).

---

## 11. Sentry / Crashlytics / analytics policy for V1

**Default: OFF. No remote logging or analytics in V1.**

Concretely:

- No Sentry SDK in iOS dependencies (no `sentry-cocoa`, no `sentry-react-native`).
- No Crashlytics, no Firebase SDK of any kind.
- No Amplitude, no Mixpanel, no Segment, no PostHog, no Adjust, no AppsFlyer, no Google Analytics, no Meta SDK.
- No bespoke "phone home" endpoint (no `POST /telemetry` etc.).
- No `MetricKit` opt-in for transmitting data to a developer-controlled endpoint. `MetricKit` may be queried on-device but the report must stay local unless §11.2 is satisfied.

Current `package.json` already complies (no analytics deps). The iOS rewrite MUST hold this line.

### 11.1 What's allowed instead

- The in-memory audit collector pattern from `src/cloudProduction/monitoringAuditBoundary.ts` and `monitoringAuditAdapterCandidate.ts` — both with `externalTransport: 'none'`, `noExternalUpload: true`. Ported as a Swift type.
- The local diagnostic ring buffer surfaced under `设置 → 诊断信息` and exported via Share Sheet on user demand (matches the existing web pattern).
- Apple's own opt-in "Share with Developers" via `MetricKit` standard channels, but ONLY if the user has opted in via iOS Settings → Privacy → Analytics → Share With App Developers. That toggle is owned by the user, not the app.

### 11.2 If we ever want remote crash reporting (post-V1)

Required gates (must all be true):

- Default OFF. Explicit per-user opt-in via "帮助改进 IronPath" / "Help improve IronPath" toggle, default unchecked.
- Apple's App Privacy section updated to declare `Diagnostics → Crash Data`.
- The chosen SDK must support PII scrubbing and we must configure it accordingly.
- Stack traces only. NEVER include AppData / HealthKit samples / auth tokens.
- Toggle is reversible. Toggling off must stop all transmission immediately.
- Documented in privacy policy.

These gates apply to crash reporting OR analytics — same bar.

---

## 12. Secrets / env handling on iOS

### 12.1 Current web posture (good — mirror it)

- `.env*` are git-ignored. Verified via `runtimeBoundaryTestHelpers.ts` test harness referenced in `SECURITY.md`.
- `.env.example` is intentionally empty (only a Chinese comment).
- Browser-safe config goes through `productionSecretsEnvironmentGuard.ts` and `supabaseEnvironmentProjectGuard.ts`, both of which reject any key whose name contains `secret`, `token`, `password`, `private`, `clientSecret`, `serviceRole`.
- `scripts/scan-production-dist-safety.mjs` is wired into CI and scans the built bundle for JWT-shaped strings, `sk_*`/`pk_*`/`sb_secret_*` keys, `AIza*` Google API keys, the env-var name `SUPABASE_SERVICE_ROLE_KEY`, and literal `access_token` / `refresh_token` assignments.
- The only browser-safe environment values are `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_IRONPATH_AUTH_CALLBACK_URL`, `VITE_IRONPATH_CLOUD_ENVIRONMENT`. Anon key is public-by-design (RLS protects rows).

### 12.2 iOS-side mapping

- Use **`xcconfig` files** for project URL and anon key, keyed per build configuration (`Debug`, `Release`, `Staging`). Both files git-ignored unless they hold ONLY public-by-design values like the anon key + URL.
- **Do not** hard-code anon key in source files. Read from `Bundle.main.infoDictionary` via a typed wrapper.
- **NEVER ship `SUPABASE_SERVICE_ROLE_KEY` in any xcconfig, any plist, any Swift source.** The CI gate must scan the built `.ipa` for this. Practical implementation: extend `scripts/scan-production-dist-safety.mjs` patterns into a `.ipa` scanner (`unzip -p Payload/Ironpath.app/* | grep -E ...`).
- **OAuth callback URLs** if any future flow needs them: must be HTTPS production hosts; the existing `authEnvironmentCallbackGuard.ts` already rejects localhost/preview hosts for production.
- **Local-only secrets** (e.g. a randomly-generated per-install device ID for `cloud_devices`): generated client-side, stored in Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, never synced to iCloud, never logged.
- **Supabase auth tokens** are managed by the Supabase Swift SDK. They MUST be stored in Keychain via the SDK's `LocalStorage` protocol implementation rather than `UserDefaults`. Default `@supabase/supabase-swift` behaviour does this; verify and lock it down via configuration.

### 12.3 Build-time secret-scan recommendations

- Add a Run Script Build Phase that fails the build if:
  - Any source file (`*.swift`, `*.plist`, `*.xcconfig`) contains `SUPABASE_SERVICE_ROLE`, `service_role`, `sk_live_`, `sb_secret_`, `AIza` prefixes.
  - Any compiled `.app` bundle string-dumps to contain JWT-shaped values (3 base64url segments).
- Mirror the existing `scan-production-dist-safety.mjs` deny-list so iOS doesn't drift.

---

## 13. Non-goals

Explicitly out of scope for V1, by policy and by privacy posture:

- **No third-party analytics.** None on web today, none on iOS in V1.
- **No advertising SDKs.** Health data may not be used for advertising (App Review 5.1.1(ii)). IronPath has no ad surface and no ad SDK; this MUST remain true.
- **No off-device PII processing.** All ML / analytics / readiness / e1RM math runs on-device (it does today in the web app; nothing changes for iOS).
- **No "share to social" surface that uploads training data to a third party.** Sharing must go through `UIActivityViewController` so the user picks the destination — IronPath itself does not maintain integrations with Instagram / Twitter / WeChat etc.
- **No fingerprint / device-tracking SDKs** (Branch, Adjust, AppsFlyer, etc.).
- **No silent background HealthKit reads.** V1 is pull-on-tap only.
- **No A/B testing infrastructure** (Optimizely, Firebase Remote Config, LaunchDarkly, etc.) — would require data transmission that conflicts with §11.
- **No "support upload" of the user's full AppData to our backend.** Diagnostic snapshot stays on device, copied via Share Sheet on user demand.
- **No iCloud sync of raw AppData via iCloud Drive / NSUbiquitousKeyValueStore by default.** If we add iCloud as a sync backend later, that is a separate review against the same privacy bar as Supabase.
- **No automatic crash upload.** Even MetricKit data transmission requires the user's iOS-level opt-in.
- **No password-recovery emails sent to a domain we don't control.** Supabase handles password reset; emails go via Supabase. No third-party email service.
- **No Supabase service role key on the client.** Ever.

---

## 14. Open questions

For the human owner / other agents to resolve before V1 freezes.

1. **(For Agent 4 / cloud agent)** Account deletion server-side: Edge Function or `SECURITY DEFINER` Postgres function? Both work; the Edge Function path is more typical and has clearer error handling, but Postgres `SECURITY DEFINER` keeps everything in the database.
2. **(For Agent 5 / UX)** Does the "Delete cloud snapshot" flow include a soft-delete grace period (e.g. 7 days) or is it immediate-final? Immediate-final is simpler and matches Phase 10 docs but is a worse UX for accidental taps.
3. **(For iOS data agent)** Excluding `AppData` from iCloud backup: ship as opt-in setting, opt-out setting, or always allow iCloud backup with a documentation note? Recommend "always allow backup, with explicit toggle to exclude" so power users have an escape hatch.
4. **(For iOS data agent)** Should completed strength sessions be written back to Apple Health as `HKWorkout` records (would expose them in the iOS Fitness app and Activity rings)? If yes, V1 needs `NSHealthUpdateUsageDescription`; if deferred, V1 omits it.
5. **(For UX / product)** Is the "name" field on `UserProfile` displayed publicly anywhere or only inside the user's own app? If it stays in-app, treat as preference data; if any UGC sharing is added later, treat as PII.
6. **(For owner)** Does the iOS V1 launch include the email/password Supabase signup path? If yes, account deletion is required at launch. If no, V1 can ship as "local-only on iOS, cloud sync coming later" and the deletion requirement is deferred.
7. **(For owner)** Privacy policy URL: required for any App Store submission. Where is the policy hosted? It must explicitly cover the Health-data class and the "Health data is never used for advertising" assertion. This report does NOT draft the policy itself.
8. **(For Agent 4)** Should we offer an account-export "everything" download from the cloud side (`GET cloud_appdata_snapshots/me` → JSON download)? Today's design is "local export only." Cloud-side export would require a new server-side surface.
9. **(For iOS data agent)** Keychain access control class for the persisted Supabase session: `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (recommended — survives reboot once unlocked, doesn't sync to iCloud) vs `kSecAttrAccessibleWhenUnlocked` (requires phone unlocked). Either is acceptable; the choice affects whether sync works during a phone-locked iOS background fetch.
10. **(For Agent 4)** When the user toggles cloud sync OFF, do we delete the cloud row, retain it for re-enable, or prompt? Today's docs are ambiguous. Recommendation: retain for re-enable, document plainly, and offer "also delete cloud copy" as a follow-up affordance.

---

End of Agent 7 report.
