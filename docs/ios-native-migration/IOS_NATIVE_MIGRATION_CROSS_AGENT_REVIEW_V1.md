# iOS Native Migration Entry Gate V1 — Cross-Agent Grill Review

Author: Cross-Agent Grill Reviewer (starting cold).
Audit scope: docs / planning only. Stress-tests the 8 sibling agent reports under
`docs/ios-native-migration/agents/` against 8 specific failure modes and looks for
inter-agent contradictions before the entry-gate doc is finalised.
Date: 2026-05-27.

---

## 1. Mission

Eight independent agents each wrote a planning report for the iOS native migration.
None of them saw any other's work. This review's job is to stress-test all 8 reports
against the 8 failure modes the user named, surface every cross-agent contradiction,
and issue a single verdict: APPROVE / REVISE / REJECT.

Output: this document, plus a short summary returned to the orchestrator.

Hard constraint: this review does not change any of the 8 reports. It only proposes
the revisions the final entry-gate doc must absorb.

---

## 2. Reports reviewed (with line counts)

| # | Agent | Path | Lines |
|---|---|---|---|
| 1 | Product / Training Domain | `docs/ios-native-migration/agents/PRODUCT_TRAINING_DOMAIN_AGENT.md` | 493 |
| 2 | TS Core Logic / Engines | `docs/ios-native-migration/agents/TS_CORE_LOGIC_AGENT.md` | 475 |
| 3 | Data Model / AppData / Repair | `docs/ios-native-migration/agents/DATA_MODEL_REPAIR_AGENT.md` | 755 |
| 4 | Cloud Sync / Supabase / Auth | `docs/ios-native-migration/agents/CLOUD_SYNC_AUTH_AGENT.md` | 862 |
| 5 | iOS Native Architecture | `docs/ios-native-migration/agents/IOS_ARCHITECTURE_AGENT.md` | 813 |
| 6 | QA / Test / Parity | `docs/ios-native-migration/agents/QA_PARITY_AGENT.md` | 842 |
| 7 | Security / Privacy / App Store | `docs/ios-native-migration/agents/SECURITY_PRIVACY_AGENT.md` | 433 |
| 8 | Migration Program Manager | `docs/ios-native-migration/agents/MIGRATION_PROGRAM_MANAGER_AGENT.md` | 1045 |

Total: 5,718 lines across 8 reports.

---

## 3. Verdict

**REVISE.**

The 8 reports are individually strong and broadly coherent on the load-bearing
contracts (single TrainingDecision, repair ledger preserved, no background sync,
no silent overwrite, JSON snapshot first, no premature SwiftData, fixtures-before-Xcode).
The migration approach itself is sound — there is no WebView wrapper hiding anywhere
and the engines layer is correctly preserved.

But three HIGH-severity cross-agent contradictions block a clean APPROVE:

1. **Parity-fixture directory paths diverge** between Agent 6 (`tests/fixtures/parity/`)
   and Agent 8 (`tests/fixtures/ios-contract/`). iOS-0 cannot be written until one
   path wins.
2. **Cloud SDK choice contradicts third-party-package stop condition.** Agent 4
   recommends `supabase-swift`; Agent 8 forbids any SwiftPM dependency without
   explicit user approval. Either Agent 4's recommendation needs to be conditioned
   on user approval, or Agent 8's stop condition needs to be relaxed for Supabase
   specifically.
3. **Architecture and Program Manager disagree on which phase HealthKit ships in.**
   Agent 5 puts HealthKit in P1 (immediate post-MVP feature parity). Agent 8 puts
   it in iOS-8, after Cloud Sync in iOS-7. They also disagree on what "earliest
   usable iPhone build" includes (Agent 5: no HealthKit, no cloud; Agent 8: no
   HealthKit, no cloud — these match — but the larger sequence differs).

Six MEDIUM-severity revisions are also needed (see §13). The 8 challenges
themselves pass at PASS or WEAK; nothing FAILs at the failure-mode level. So
this is not a REJECT.

The final entry-gate doc must absorb the §13 revisions before the iOS-0 PR opens.

---

## 4. Challenge 1 — Accidentally copying PWA architecture into iOS

**Stress-testing**: Agent 5 (Architecture), Agent 1 (Product), Agent 2 (TS Core Logic).

**Where to look**: `IOS_ARCHITECTURE_AGENT.md` §2.1 (PWA → iOS mapping table),
§2.2 (PWA-only infrastructure left behind), §4.1 (`AppRootViewModel` shape),
§13.1 (over-engineering risk).

**Findings**:

Agent 5 is explicitly aware of the trap and addresses it head-on at lines 652–657:
"`App.tsx` is a regulator antipattern — it holds dozens of `useState` + a single
`setData` mutation funnel + dozens of handlers. Directly porting that to one
`AppRootViewModel` produces a 2000-line Swift file that nobody can review.
Mitigation: enforce that `AppRootViewModel` owns only the **state**…"

Agent 5 also deletes the right things:
- `AddToHomeScreenHint`, `manifest.webmanifest`, service worker, `apple-mobile-web-app-status-bar-style`
  plumbing, Tailwind, `lucide-react`, Vite manualChunks (§2.2 lines 43–56).
- Apps/api dev runner (line 50): "Not ported. Agent 3 picks the iOS-native
  persistence story from scratch."
- React.lazy / React.memo / useSyncExternalStore (lines 53–54).

Agent 5 chooses iOS-native idioms over React-shaped equivalents:
- `@Observable` (Swift 5.9 Observation) instead of an `ObservableObject`
  port of `useState<AppData>` (§5.1 lines 314–326).
- SwiftUI `TabView` + per-tab `NavigationStack` rather than a single global
  router mimicking React Router (§6.2 lines 366–372).
- `UISheetPresentationController` for sheet/drawer instead of polyfilling the
  React `BottomSheet.tsx` (Agent 1 §6 line 289 confirms "the *content* is
  product (must port); the *container* is artifact").
- HealthKit live read instead of `appleHealthXmlImportEngine` (§8.4).

Agent 2 (TS Core Logic) classifies the engine surface honestly. 96% of engine
LOC is `PURE_DOMAIN` or `UI_COUPLED` (decision-only). Only `analytics.downloadText`
and `healthImportEngine.isLikelyMobileDevice` are flagged BROWSER_DEPENDENT and
both are tiny scoped helpers, not load-bearing logic. The big TrainingDecision
engine (2,097 LOC) is explicitly recommended for **re-derive from tests, do not
literal-translate** (Agent 2 §3a row 98, also §8 "Engines that look pure but
secretly aren't" risk block).

Agent 1 keeps the right boundaries: `src/uiOs/` is treated as a layout reference,
not a Swift spec ("Use these files as a layout reference for what data each
screen needs, what cards exist, what their hierarchy is. Do **not** treat them
as Swift specs", §4.3 lines 304–305).

**Concern**: Agent 5's tab order says "honor the evolved UI" with Plan as a
sub-route of Progress (§6.4 lines 378–379). That is correct relative to the
PWA's *current* evolution — but it bakes a PWA-era navigation decision into
iOS without re-evaluating whether iOS users would want Plan as a top-level
tab. This is borderline "copying PWA accidentally". Not blocking — but worth
documenting as an intentional choice, not a default.

**Verdict: PASS**.

The agents have actively distinguished engine logic (port verbatim) from PWA
architecture (delete). The one borderline case (tab navigation copying the
evolved PWA) is conscious, documented, and reversible.

---

## 5. Challenge 2 — Losing TrainingDecision semantics

**Stress-testing**: Agent 1 (Product), Agent 2 (TS Core Logic), Agent 3 (Data),
Agent 6 (QA Parity), Agent 8 (Program).

**Where to look**:
- `PRODUCT_TRAINING_DOMAIN_AGENT.md` §3.1 "TrainingDecision as the sole arbiter",
  §3.2 reentry productive-dose floor, §5.2 reentry productive-dose floor non-negotiable.
- `TS_CORE_LOGIC_AGENT.md` §3a row 98 (`trainingDecisionEngine.ts`, P0),
  row 96 (`trainingDecisionCleanInput.ts`, P0), §7 Tier 4 "TodayView decision stack".
- `DATA_MODEL_REPAIR_AGENT.md` §5.3 "branded-input contract" with compile-time
  Swift factory pattern.
- `QA_PARITY_AGENT.md` §4 critical-path parity bar including `TrainingDecisionEngineParityTests`
  and `TrainingDecisionCleanInputContractTests`.
- `MIGRATION_PROGRAM_MANAGER_AGENT.md` iOS-4 acceptance + Stop Condition #3.

**Findings**:

The TrainingDecision contract is the most heavily defended surface in the entire
audit. Every relevant agent flags it as load-bearing:

- Agent 1 §3.1 line 76: "A single function `buildTrainingDecision(input) → TrainingDecision`
  now owns every per-surface user-facing payload" — and §5.1 "Single decision per
  render" is explicitly listed as one of the cannot-be-simplified contracts.
- Agent 1 §3.2 documents the role-aware floor (compound 2, accessory 1) and the
  full gap state machine with all transition rules. The 0.65 × 0.6 = 0.39 → 1-set
  bug is named.
- Agent 1 §5.2 says the floor cannot be reduced to "if 14+ days, do deload".
- Agent 1 §5.3 documents the effective-set scoring constants as evidence-backed
  and non-negotiable.
- Agent 1 §5.4 documents the 4-ID exercise identity model as non-collapsible.
- Agent 1 §5.6 documents the `CleanTrainingDecisionInput` brand and its rationale
  (three feature surfaces caught passing raw AppData after V1 was deployed).

Agent 2 §3a row 98 explicitly tags `trainingDecisionEngine.ts` as the largest
single port effort and warns "Re-derive from tests in Swift, do not literal-translate".
Agent 2 §7 Tier 4 sequences the decision stack correctly: context → engine →
todayStateEngine → readiness → nextWorkoutScheduler → daily adjustment → pipeline.

Agent 3 §5.3 implements the branded factory in Swift using `fileprivate` init +
single factory entrypoint — stricter than the TS brand (runtime-only) because
Swift can enforce it at compile time. This actively improves the contract.

Agent 6 §4 critical-path parity bar requires byte-equal `userFacing.*` payloads
between TS and Swift. Agent 6 §4 "Forbidden-copy parity scan" preserves the
V2 forbidden-copy invariant (the 4 phrases that must never appear).

Agent 8 Stop Condition #3 (line 874): "iOS V1 MUST NOT feed raw AppData into
TrainingDecision — only CleanAppDataView equivalents. Enforced by Swift
compile-time type contract … and by static guard test on imports".

Agent 1 §3.7 (four-ID identity) and §8 (PR/e1RM keying risks) both spell out
the data-corruption consequences of getting `recordExerciseId` wrong.

**Concern**: AR-1..AR-9 arbitration trace is named in Agent 1 §3.1 ("every
AR-1..AR-9 rule that fired this turn") but no other agent explicitly requires
the Swift port to preserve the `hiddenDebugSignals.arbitrationTrace` array.
Agent 6's parity tests cover the user-facing output but the dev-only trace
could regress silently. Recommended revision: Agent 6's `TrainingDecisionEngineParityTests`
should explicitly assert `arbitrationTrace` is byte-equal.

**Verdict: PASS** (with one MEDIUM revision — see §13 #4).

All five named TrainingDecision semantics (clean-input contract, reentry floor,
restart, role floors, AR-1..AR-9 trace coverage) are addressed. The compile-time
Swift enforcement of the branded contract is actively stronger than TS.

---

## 6. Challenge 3 — Losing Data Health repair semantics

**Stress-testing**: Agent 3 (Data Model / Repair), Agent 4 (Cloud Sync),
Agent 5 (Architecture), Agent 6 (QA), Agent 8 (Program).

**Where to look**:
- `DATA_MODEL_REPAIR_AGENT.md` §6 (repair engine port), §6.3 ("Ledger lives where
  data lives"), §7 (`AutoRepairOrchestrator` on iOS launch), §7.2 sample Swift
  launch sequence, §9.5 deletion-banned list.
- `IOS_ARCHITECTURE_AGENT.md` §4.3 `IronPathDataHealth` module surface, §5.3
  mutation pipeline.
- `QA_PARITY_AGENT.md` §4 `DataRepair<Name>ParityTests` and
  `AutoRepairOrchestratorParityTests` (P0 priority).
- `MIGRATION_PROGRAM_MANAGER_AGENT.md` iOS-3 acceptance criteria.

**Findings**:

Agent 3 is rigorous on this. Every repair receipt + ledger + backup invariant
is preserved:

- Receipt cap 500 (`MAX_DATA_REPAIR_LOG_ENTRIES`), ledger cap 1000, ledger
  idempotency 24h — all named with file/line and listed in Appendix A as
  identifiers Swift must match exactly (Appendix A line 729–731).
- `idempotencyKey` formula must port byte-identical (§6.2 line 343).
- `computeAppDataHash` and `buildAppDataSnapshotHash` listed as Swift-port-must-match
  identifiers (Appendix A lines 726–728).
- Backup-first rule: "The orchestrator never mutates if the backup write fails"
  (§7.1 step 4 + §9.2). Mirrored in Agent 6 `AutoRepairOrchestratorParityTests.case_backup_fail_no_mutation`.
- Ledger travels with the snapshot (Agent 3 §6.3: "The PWA-iOS handoff … automatically
  carries the entire repair history. No separate ledger sync step. This is the
  load-bearing design choice — keep it.").
- Deletion-banned list (§9.5) explicitly forbids removing completed sessions,
  sets, body weights, recommendation snapshots, program adjustment history,
  pain history, PR/e1RM history. Static guard against `history.removeAll`
  etc. mandated.

Agent 3 §7.2 ships a concrete Swift `AppLaunchSequence` sample showing the
order: `load → buildCleanAppDataView → adopt → background detached task →
AutoRepairOrchestrator.run`. This means **the clean view is constructed
before TrainingDecision sees anything**, which is the load-bearing rule from
the Real Data Health Repair System V1 doc.

Agent 4 §5.1 step 2 requires `ensureCloudUploadEligible({ appData, source:
'explicit-first-upload', snapshotKind: 'first-upload' })` to be consulted before
the upload button is enabled. Repair receipts and ledger thus gate cloud sync;
they cannot be discarded across migration.

Agent 8 iOS-3 acceptance criteria (lines 277–284) require byte-equal `detect`,
`dryRun`, and `apply` results plus matching `idempotencyKey` and ledger shape.
Stop Condition #4 (line 875): "iOS V1 MUST NOT upload partially-repaired AppData.
Every upload call site must consult `CloudUploadEligibilityGuard.evaluate` first."

Agent 6 §4 puts `DataRepair<Name>ParityTests` (×9), `AutoRepairOrchestratorParityTests`,
and `RepairLedgerParityTests` on the P0 critical-path bar — meaning "if any of
these is red, Swift IronPath is not allowed onto a device" (§4 line 163).

**Verdict: PASS**.

Every named repair semantic carries over. The ledger-lives-with-data design
preserves history across PWA↔iOS migration. The Swift compile-time enforcement
of `CleanTrainingDecisionInput` (Agent 3 §5.3) is stronger than the TS brand.

---

## 7. Challenge 4 — Weakening cloud sync safety

**Stress-testing**: Agent 4 (Cloud Sync), Agent 7 (Security), Agent 8 (Program),
Agent 5 (Architecture) on background-task implications.

**Where to look**:
- `CLOUD_SYNC_AUTH_AGENT.md` §6 subsequent-upload contract (V4 mirror),
  §7 V5 optimistic concurrency (fresh-read preflight mandatory), §9 strict
  non-goals.
- `IOS_ARCHITECTURE_AGENT.md` §10 "Background tasks policy" (no background work),
  §13.5 cloud-sync receipt hash incompatibility risk.
- `SECURITY_PRIVACY_AGENT.md` §11 Sentry/analytics policy (no remote sinks).
- `MIGRATION_PROGRAM_MANAGER_AGENT.md` Stop Conditions #2, #4, #5.

**Findings**:

Cloud safety is the most strictly defended surface across the audit, with each
agent independently catching the same hard rules.

V3/V4/V5 carry verbatim into iOS:
- Agent 4 §6.2 step 4 makes fresh-read preflight MANDATORY on iOS V1 — stricter
  than the TS web build's optional path: "The web build's `gateway: null` no-op
  code path is not supported here."
- Agent 4 §7.2 spells out the contract: "REQUIRE expectedPreviousHash != nil",
  "REQUIRE fresh.source_snapshot_hash == expectedPreviousHash".
- Agent 4 §7.3 V5 invariants listed: no delete, no overwrite on remote_changed,
  no schema mutation, no modals, no retry with different hash, no session
  deletion as side-effect.

No background sync:
- Agent 4 §9.1 explicit: "No `BGTaskScheduler` / `BGAppRefreshTask` / `BGProcessingTask`
  registration for cloud sync. No silent push … No `URLSession` background config
  for snapshot uploads. No `applicationDidEnterBackground` / `applicationDidBecomeActive`
  hook that schedules an upload or pulls."
- Agent 5 §10 same line: "V1 ships with no background activity. None. Zero
  `BGAppRefreshTask`, zero `HKObserverQuery` with background delivery, zero
  silent push. **This is a hard line.**"
- Agent 8 Stop Condition #2 enforces it via static guard test on `BackgroundTasks`
  import.

No upload of partially-repaired AppData:
- Agent 4 §9.4 cites `cloudUploadEligibilityEnforcementStatic.test.ts` and
  requires the equivalent static check on iOS.
- Agent 8 Stop Condition #4 makes it a static guard.

`expectedPreviousHash` plumbed through Swift gateway API from day one:
- Agent 4 Appendix B (line 851): `writeSnapshot(... expectedPreviousHash: String?, ...)`.

Hash parity:
- Agent 3 §10.3 calls out the ISO timestamp drift bug ("`new Date().toISOString()`
  → `'2026-05-27T10:15:30.000Z'` ... `ISO8601DateFormatter().string(from:)` →
  `'2026-05-27T10:15:30Z'` (no ms). … `buildAppDataSnapshotHash` will produce
  a different hash for the same logical AppData. This breaks PWA-iOS round-trip
  parity.") — mitigation: keep timestamps as `String` in Swift `AppData`, never
  `Date`.
- Agent 5 §13.5 names the same risk: "The PWA's `computeAppDataHash` is
  deterministic but specifically tuned for V8 of `JSON.stringify`. If the Swift
  `JSONEncoder` produces byte-equivalent output for the same sanitized AppData,
  the receipt portability works; if not, every user who flips from PWA → iOS
  sees `conflict_review_required`".
- Agent 4 risk 1 names hash-algorithm parity and demands golden test vectors.
- Agent 6 marks `AppDataSnapshotHashParityTests` as P0-critical ("the hash
  function — every other cloud parity check depends on it", line 130).

No silent overwrite, no silent retry, no silent local mutation on conflict:
- Agent 4 §8 conflict-handling contract: "**`canAutoApply: false,
  manualResolutionRequired: true` — always.**"
- Agent 4 §8.4 forbids automatic last-write-wins, three-way merge,
  background-thread conflict resolver, modal alerts.

Service-role keys forbidden in bundle (Agent 4 §9.6, Agent 7 §12 build-time
scan recommendations).

**Verdict: PASS**.

All five listed cloud-safety failure modes are explicitly addressed by multiple
independent agents. V5 fresh-read preflight is mandatory; `expectedPreviousHash`
field is plumbed; partially-repaired data is gated by the V3 eligibility guard;
no background sync; no silent conflict resolution.

---

## 8. Challenge 5 — Overengineering local database too early

**Stress-testing**: Agent 3 (Data Model), Agent 5 (Architecture), Agent 8 (Program).

**Where to look**:
- `DATA_MODEL_REPAIR_AGENT.md` §4 "iOS AppData storage strategy" — JSON snapshot
  first, with explicit profiling thresholds before escalation.
- `IOS_ARCHITECTURE_AGENT.md` §7.3 "Why JSON file, not SwiftData / Core Data".
- `MIGRATION_PROGRAM_MANAGER_AGENT.md` Stop Condition #9, iOS-2 risks.

**Findings**:

This is the most strongly aligned challenge across the audit. All three agents
(Data, Architecture, Program) independently chose JSON-file snapshot and
explicitly rejected SwiftData / Core Data / SQLite as V1 default. Their reasoning
matches:

Agent 3 §4.1: "Use `FileManager.default.url(for: .applicationSupportDirectory, ...)`
… One file: `appData.v8.json`. Atomic write with `Data.writeOptions = [.atomic,
.completeFileProtectionUnlessOpen]`."

Agent 3 §4.2 cites three pieces of evidence the team itself rejected normalization:
- `localStorageToSqliteMigrationDryRun.ts` line 1–207 (never enabled).
- `localStorageToSqliteMigrationApply.ts` gated behind five conditions, returns
  `productionReady: false`.
- `migrationRollbackRecovery.ts` exists to recover from the SQLite experiment if
  ever enabled.

Agent 3 §4.3 sets explicit *measurable* thresholds for when JSON-only should be
escalated (>5 MB file size, p95 save >80ms, p95 cold-start decode >250ms, etc.).
Not "we think it might be slow" — actual numeric bars.

Agent 5 §7.3 echoes the same reasoning independently and reaches the same answer:
"AppData is **document-shaped**, not a query workload. We never need `WHERE
history.exercise = 'bench' AND date > X` indexed lookups … SwiftData adds
object-graph machinery for no win." Also: "Cloud sync uploads a single JSON blob
with a hash. SwiftData would force us to round-trip through `JSONEncoder` anyway
at the sync boundary".

Agent 8 Stop Condition #9: "DO NOT introduce SwiftData / Core Data in iOS-1
through iOS-3. Persistence in V1 is file-system JSON. The decision to adopt
SwiftData (if ever) is a separate V2 task with its own planning doc." Backed
by static guard at iOS-2 (`tests/iosAppDataSwiftModelStaticGuards.test.ts`:
"no `@Observable` / `@Model` (SwiftData) / `@objc` annotation in V1").

Agent 3 §4.4 explicitly preserves an escape hatch: HealthKit samples may need
their own SQLite layer if they grow beyond the threshold, but AppData proper
stays JSON.

Agent 5 §13.5 names the hash compatibility risk between TS `JSON.stringify`
and Swift `JSONEncoder` and routes resolution through Agent 3 + Agent 4
(canonical JSON form, golden tests).

**Concern**: Agent 5 §7.4 mentions "the cloud-sync flow envelope (mirrors
`CLOUD_SYNC_FLOW_STORAGE_KEY`)" stored in UserDefaults. Agent 4 §3.6 says
the three cloud receipt fields (`syncedAppDataHash`, `syncedOwnerUserId`,
`syncedAt`) live in localStorage on web. Storing on iOS in `UserDefaults` is
fine, but the two reports do not explicitly align on which slot — see cross-agent
contradictions §12 #5.

**Verdict: PASS**.

No agent recommends SwiftData / Core Data / SQLite as V1 default. The choice is
defended with PWA-side evidence (the team already rejected normalization). The
thresholds for future escalation are measurable, not "we'll see how it feels".

---

## 9. Challenge 6 — App Store / HealthKit assumptions without proof

**Stress-testing**: Agent 7 (Security / App Store), Agent 5 (Architecture),
Agent 4 (Cloud Sync / Auth), Agent 8 (Program).

**Where to look**:
- `SECURITY_PRIVACY_AGENT.md` §4 (HealthKit permission strategy), §8 (App
  Store review risk list), §9 (Encryption Export Compliance), §10 (Account
  deletion in-app requirement).
- `IOS_ARCHITECTURE_AGENT.md` §8 (HealthKit integration shape), §11 (iPhone-first
  UX scope decisions).
- `CLOUD_SYNC_AUTH_AGENT.md` §4 (auth strategy, including SIWA non-goal).
- `MIGRATION_PROGRAM_MANAGER_AGENT.md` iOS-8 (HealthKit), iOS-10 (App Store
  Readiness).

**Findings**:

Agent 7 is rigorous on the App Store dimension and Agent 5 on the architecture
side. They mostly agree.

HealthKit usage descriptions:
- Agent 7 §4.3 drafts both English and zh-Hans usage strings for
  `NSHealthShareUsageDescription`. The strings are specific, name the data
  classes, and name the purpose — meeting the App Review 5.1.1(i) bar.
- Agent 7 §4.3 EXPLICITLY excludes `NSHealthUpdateUsageDescription` from V1
  because no write-back is requested. This is the correct choice for App Store
  review.
- Agent 5 §8.1 lists the exact `HKObjectType` set: matches Agent 7 §4.2 1:1
  (resting HR, HRV SDNN, HR, step count, active energy, exercise time, body
  mass, body fat %, VO2max, sleep, workout). No mismatch.

HealthKit permission flow:
- Agent 5 §8.2: "Triggered **only from the Settings → Health Data screen**,
  never on cold boot. A pre-prompt explainer screen renders before the system
  sheet".
- Agent 7 §4.1: "Request lazily, on user action. Do not request HealthKit
  permission at app launch. … Show purpose in-app before the prompt."
- Agent 8 iOS-8 acceptance: "Permission is NOT requested at app launch —
  only on explicit opt-in".

SIWA / Sign in with Apple:
- Agent 4 §4.3 deliberately defers SIWA: "No Sign in with Apple yet. Web uses
  email/password against GoTrue. iOS V1 ships the same. SIWA can be added
  later as a second provider on the same project without changing the snapshot
  contract."
- Agent 7 §8 R7 confirms SIWA is NOT required (App Review 4.8) because no
  third-party OAuth provider (Google / Facebook / etc.) is wired. Email/password
  only is sufficient.

Encryption Export Compliance:
- Agent 7 §9 recommends `ITSAppUsesNonExemptEncryption = NO`. Rationale spelled
  out at lines 282–287 (HTTPS via URLSession / Keychain via Security.framework
  are exempt under §740.17(b)(2)). This is technically correct and avoids the
  ERN paperwork.

Account deletion (App Review 5.1.1(v), since 2022-06):
- Agent 7 §10 explicitly addresses this. The honest reading at line 308: "the
  project is preparing for cloud sync. The honest reading is that V1 likely
  DOES expose account creation and therefore DOES need deletion."
- Agent 7 §10.2 specifies the required UX: "Must be reachable from a clearly
  labeled menu, no more than a couple of taps deep. App Review explicitly
  tests for this."

**Concern A**: Agent 8 iOS-7 ships explicit cloud sync (including signup via
Supabase). But Agent 8 iOS-10 (App Store Readiness) does not explicitly include
"in-app account deletion screen ships in V1" in its acceptance criteria. The
deletion requirement only appears in Agent 7's report. **MEDIUM revision
needed**: Agent 8's iOS-7 (or new iOS-7.1) must include an account-deletion
flow with the matching Supabase server-side hook (Edge Function or `SECURITY
DEFINER` Postgres function — Agent 7 §10.3 calls this out as a server-side
implementation task and tags it for Agent 4, but Agent 4 does not mention it).

**Concern B**: Agent 5 §11.1 picks iOS 17 minimum based on `@Observable`
requirement. Agent 1 §10 open question 4 asks for the iOS minimum to be
decided (notes `UICalendarView` is iOS 16+, `SwiftData` is iOS 17+,
HealthKit background delivery semantics differ pre-iOS 15). Agent 6 §13
open question 2 also asks. Agent 8 iOS-1 says "proposed iOS 17.0 — confirmed
by Agent 5" — i.e. defers to Agent 5. This is consistent enough: Agent 5 owns
the call and it propagates. PASS.

**Concern C**: Agent 5 §8.1 line 440 imports `HKQuantityType(...)` syntax,
which is the iOS 14+ initialiser style. Agent 7 §4.2 uses the older
`HKQuantityType.quantityType(forIdentifier:)` syntax. Both compile but the
mismatch suggests neither agent actually checked iOS-17 vs iOS-15 deprecation
status. **LOW**, not blocking.

**Concern D**: Server-side account-deletion mechanism is "open" in Agent 7
§10.3 and Agent 7 §14 question 1. Agent 4 does not mention account deletion at
all. **MEDIUM revision needed** (already covered in Concern A).

**Verdict: WEAK**.

The HealthKit permission shape is correctly minimal (read-only, no write), the
SIWA question is correctly answered (not required in V1), and ECCN is correctly
declared NO. The PASS-blocker is the account-deletion gap: Agent 7 names it as
required-if-cloud-sync-ships, Agent 8's iOS-7 ships cloud sync, but Agent 8's
iOS-10 readiness checklist doesn't include the deletion flow. The final
entry-gate doc must close this loop.

---

## 10. Challenge 7 — Starting Xcode too early

**Stress-testing**: Agent 8 (Program), Agent 5 (Architecture), Agent 6 (QA).

**Where to look**:
- `MIGRATION_PROGRAM_MANAGER_AGENT.md` iOS-0 → iOS-1 sequencing, Stop
  Condition #6.
- `QA_PARITY_AGENT.md` §11 (iOS-0 contract fixture export — the very first task).
- `IOS_ARCHITECTURE_AGENT.md` §12 (P0 / P1 / P2 phases).

**Findings**:

Agent 8 explicitly enforces the order:
- iOS-0 (Contract Fixture Export V1) is the first task. "This is the bedrock
  dependency for iOS-3 and iOS-4. Without it, the Swift port is guess-driven."
  (Agent 8 line 114).
- iOS-1 (Xcode Project Bootstrap V1) is second. "Dependencies: iOS-0 merged."
  (Agent 8 line 177).
- Stop Condition #6 (Agent 8 line 877): "DO NOT create an Xcode project before
  iOS-0 Contract Fixture Export V1 is green. iOS-1 PR opens ONLY after iOS-0
  is merged. Enforced by PR linkage (iOS-1 PR body must cite the iOS-0 merge
  SHA)."

Agent 6 §11 ("iOS-0 contract fixture export — the very first task") independently
agrees: "This is what the user runs on the TS side, **before** any Swift code
is written, to bootstrap parity." (line 671)

Agent 5 §12.1 (P0 phase) does not formally name iOS-0, but its P0 acceptance
includes "Engine outputs match TS fixtures on the 5 highest-signal golden
tests" (line 602), which requires the iOS-0 fixtures to exist first. Implicit
agreement.

**Concern**: Agent 5's project layout (§3.1) and Agent 8's iOS-1 deliverable
(§4 iOS-1) differ:
- Agent 5: single Xcode project at root with `IronPath.xcworkspace` and 8
  SPM packages under `Packages/`.
- Agent 8: "`ios/IronPath.xcodeproj/`" — folder under `ios/`, no workspace,
  no SPM packages mentioned.

Both are valid. The discrepancy is layout, not sequencing. iOS-1 plan doc
(produced when iOS-1 PR opens) is the place to resolve this. Not a CHALLENGE 7
failure — flagged in §12 cross-agent contradictions.

**Verdict: PASS**.

iOS-0 (TS-side fixture export) strictly precedes iOS-1 (Xcode project), and
that is hard-locked by Agent 8 Stop Condition #6. Three agents independently
chose the same sequence.

---

## 11. Challenge 8 — Missing real-data migration risks

**Stress-testing**: Agent 3 (Data Model / Repair), Agent 6 (QA Parity),
Agent 2 (TS Core Logic).

**Where to look**:
- `DATA_MODEL_REPAIR_AGENT.md` §10 "Schema-risk map" — 13 sub-items.
- `QA_PARITY_AGENT.md` §6 "Real-data corruption cases to test" — 25 named
  cases.
- `TS_CORE_LOGIC_AGENT.md` §8 risks block (ISO drift, fingerprint mismatch,
  date arithmetic drift).

**Findings**:

This is the most thoroughly enumerated dimension of the audit. Every named
real-data risk is addressed by at least one agent:

ISO timestamp drift:
- Agent 3 §10.3: "`new Date().toISOString()` → `'2026-05-27T10:15:30.000Z'`
  (includes ms, always `.000` if zero). `ISO8601DateFormatter().string(from:)`
  → `'2026-05-27T10:15:30Z'` (no ms). … breaks PWA-iOS round-trip parity. Fix:
  keep timestamps as `String` in the Swift `AppData`, never `Date`."
- Agent 2 §8: "`adaptiveRecommendationEngine.ts` — `applyCompletedSessionToCalibration`
  writes `lastUpdatedAt = new Date().toISOString()` into persisted state.
  **Fingerprint risk**: if the Swift port writes ISO strings with a different
  fractional-seconds precision or timezone, the diff will look gratuitous."
- Agent 4 §11 risk 1 (hash algorithm parity) covers the downstream cloud
  impact.

Hash canonicalization mismatch:
- Agent 4 risk 1 + golden test vectors.
- Agent 5 §13.5 + canonical JSON form mandate.
- Agent 6 P0 `AppDataSnapshotHashParityTests`.
- Agent 3 Appendix A line 727: `buildAppDataSnapshotHash` listed as Swift-must-match.

Sanitizer non-determinism:
- Agent 3 §10.11: "`appDataSanitize.ts:639`: `pickString(raw.id, \`session-${Date.now()}\`)`.
  These are 'give a deterministic-ish ID to legacy records missing one'. The
  result is that the sanitize pass is NOT deterministic — running it twice on
  the same input produces two different IDs." Mitigation: hash before sanitize
  on read.
- Agent 6 §6 case "NaN / Infinity in load field" + Agent 6 fixture #4
  (`sanitize-roundtrip-v1.json` — sanitize idempotency check).

Schema-ladder open-bag fields lost:
- Agent 3 §3.2 + §6.3 + §10.2: "`AppSettings` cannot be a `struct AppSettings:
  Codable` with closed properties. Either model it as `[String: AnyCodable]`
  (or a custom `JSONValue` enum) with typed accessors for known keys".
- Agent 3 Appendix A bundles this with "additionalProperties: true at the root
  level" (§10.10).
- Agent 6 §6 covers "AppData missing required `userProfile` field" sanitize
  case.

`Date.now()` minted IDs:
- Agent 3 §10.11 names this exactly.
- Agent 2 risk block names `Date.now()` users by file.

Unit kg/lb confusion:
- Agent 1 §3.5 documents the contract: kg storage, lb display.
- Agent 1 §5.3 documents the constants as non-negotiable.
- Agent 6 §6 case "kg / lb unit mismatch (`actualWeightKg = 45` but
  `displayUnit = 'lb'`, `displayWeight = 45`)" with named fixture and parity
  test.
- Agent 3 §10.12 documents `displayUnit` per-set + warns "NEVER convert
  historical sets to a canonical unit on read — convert only at display time."

Four-ID exercise identity collapse:
- Agent 1 §3.7 documents the four IDs.
- Agent 1 §5.4 non-negotiable status.
- Agent 1 §8 ("Reading `TrainingSession.recordExerciseId` from `originalExerciseId`
  directly … High" severity).
- Agent 3 §10.4 normalizeExerciseIdentity rules preserved.
- Agent 6 §6 cases "Dangling exercise ID", "Replacement / equivalence chain
  mismatch" — parity tested.

Additionally caught:
- Agent 3 §10.1 — STORAGE_VERSION = 8 but migration ladder ends at V6 (collapsed
  ladder). Risk: a Swift developer reading the code might believe schemaVersion 7
  has a defined intermediate shape. Documented as non-blocking but called out.
- Agent 3 §10.5 — `restTimerState` shape across history vs active session.
- Agent 3 §10.13 — enum fallback for `pendingSessionPatches.status`.

**Verdict: PASS**.

Every named real-data migration risk is caught by at least one agent and most
are caught by two or three independently. The ISO timestamp drift (the
sneakiest one) is named in three reports and resolved (`String`-typed
timestamps, never `Date`-typed).

---

## 12. Cross-agent contradictions

These are places where two or more agents wrote independently and disagree.
The final entry-gate doc must reconcile them.

### 12.1 Parity-fixture directory paths diverge (HIGH)

- Agent 6 §5 (lines 207–212): "All fixtures live under (proposed new directory):
  `tests/fixtures/parity/inputs/` … `tests/fixtures/parity/golden/`".
- Agent 6 §11 lists 5 concrete paths: `parity/inputs/app-data/...`,
  `parity/inputs/training-decision/...`, etc.
- Agent 8 §4 iOS-0 (line 126): "`tests/fixtures/ios-contract/` —
  `appdata-clean-v1.json` (input), `cleanAppDataView-v1.json` (expected
  projection), `trainingDecision-v1.json` (expected v2 output),
  `dataHealthRepair-v1.json` (expected repair ledger / receipts)."
- Agent 8 also names a different script (`scripts/export-ios-contract-fixtures.mjs`)
  vs Agent 6's `scripts/generate-parity-goldens.mjs`.

These are different directories, different file naming conventions, and different
script names. They must agree before iOS-0 PR opens or the wrong files land.

**Proposed resolution**: The final gate doc adopts Agent 6's path
(`tests/fixtures/parity/`) because (a) Agent 6 owns the parity strategy in
detail, (b) the name "parity" is more accurate (the fixtures are TS↔Swift
parity, not iOS-specific), (c) Agent 6 also covers fixture privacy guard
integration. Agent 8's iOS-0 description should be edited to match Agent 6's
paths.

### 12.2 Cloud SDK choice contradicts third-party-package stop condition (HIGH)

- Agent 4 §4.1 (line 209): "**Use the official Supabase Swift SDK
  (`supabase-swift`).** Do not hand-roll a REST/GoTrue client."
- Agent 4 §4.2 rationale lists Keychain-backed `SupabaseLocalStorage`,
  automatic GoTrue token refresh, etc.
- Agent 8 Stop Condition #10 (line 881): "DO NOT add third-party Swift
  packages without explicit user approval. No SwiftPM dependency, no
  CocoaPods, no Carthage. The V1 baseline is Apple's standard frameworks
  + plain `URLSession` for Supabase REST."
- Agent 8 iOS-7 (line 500): "`SupabaseClient.swift` (plain `URLSession` +
  `Codable`, NO `supabase-swift` SDK in V1)."

This is a direct contradiction. Either:
- Agent 4 wins: explicit user approval is granted up front for the official
  SDK, and Stop Condition #10 carves out a Supabase exception.
- Agent 8 wins: Agent 4's recommendation is downgraded to "plain `URLSession`
  V1, official SDK as V1.5 if hand-rolled auth proves painful". Agent 4 §4.1
  paragraph 6 already allows for this: "If the Supabase Swift SDK is later
  judged unsuitable (build pipeline constraints, version-pin pain), we can
  defer the SDK choice. The wire contract in §3 does **not** depend on the
  SDK; it depends on PostgREST + GoTrue."

Agent 7 §12.2 (line 386) actually assumes the SDK is used: "Supabase auth
tokens are managed by the Supabase Swift SDK. They MUST be stored in
Keychain via the SDK's `LocalStorage` protocol implementation".

This is a meaningful disagreement: hand-rolling GoTrue auth is *security*-sensitive
work, and Agent 4's recommendation rests on security. But adopting a SwiftPM
dependency is a separate trust decision the user wants explicit control over.

**Proposed resolution**: The final gate doc explicitly poses the question to
the user as a P0 decision: "Approve adding `supabase-swift` as the one
allowed SwiftPM dependency, OR keep Stop Condition #10 absolute and accept
hand-rolling GoTrue PKCE + token refresh + Keychain integration in Swift."
This is one of the iOS-0 prerequisites that requires the user to choose, not
agents to choose for them. Until they choose, iOS-7 (Explicit Cloud Sync)
cannot open its planning doc.

### 12.3 Architecture P-phase numbering disagrees with Program iOS-N numbering on HealthKit (HIGH)

- Agent 5 §12.2 (P1): "Adds: `IronPathHealthKit` adapter — fetch daily metrics,
  fetch recent workouts, full authorization flow … Plan view (the
  `progressMode='plan'` branch of Progress). Assessment view (`AssessmentView.tsx`
  port). Coach actions panel, post-workout next-time recommendation. Records /
  PRs view. Equipment profile settings. Data-health full repair registry ported."
  Acceptance: dogfooding for 2 weeks without falling back to PWA.
- Agent 5 §12.3 (P2): "`IronPathCloudSync` real implementation … First-sync
  flow, conflict review screen, override-conflict screen, cloud diagnostics
  panel."
- Agent 8 §4 sequencing: iOS-7 (Explicit Cloud Sync iOS V1) is BEFORE iOS-8
  (HealthKit Adapter V1). Agent 8 §5 parallelization rules: "iOS-7 and iOS-8
  can be developed in parallel ONCE iOS-5 is merged."

Agent 5 sequences HealthKit BEFORE Cloud Sync. Agent 8 says they can ship in
parallel after Focus Mode MVP. There is no strict ordering disagreement
because Agent 8 explicitly allows parallel, but the dependency reasoning
diverges:
- Agent 5 P1 implies HealthKit unblocks the readiness signal for "no PWA
  fallback" dogfooding. Cloud is a "polish" layer that comes after.
- Agent 8 ordering implies Cloud sync is more pressing as a multi-device
  story than HealthKit-as-readiness-source.

Agent 6 §6 puts both HealthKit parity and Cloud sync parity in P2.

**Proposed resolution**: The final gate doc explicitly states HealthKit and
Cloud Sync are *parallel siblings* after iOS-5 (Focus Mode MVP) and iOS-6
(Plan/History/Progress). Both are dogfooding gates; neither blocks the other.
Agent 5's P1/P2 numbering is reconciled to Agent 8's iOS-7/iOS-8 + "can be
parallel" rule.

### 12.4 SwiftUI primitive layer is named differently (LOW)

- Agent 5 §4.9: `IronPathUIKit` module name (deliberate — "NOT UIKit — name is
  product").
- Agent 8 does not name the module — `ios/IronPath/Features/...` and
  `ios/IronPath/UI/...` implied but not specified.

**Proposed resolution**: The final gate doc adopts Agent 5's module map
verbatim. Agent 8's iOS-5/iOS-6 plan docs (when they open) reference
`IronPathUIKit` for primitives.

### 12.5 Persistence slot for cloud-sync receipt is unclear (LOW)

- Agent 4 §3.6: "`CloudSyncFlowPersistedState` envelope … iOS needs an
  equivalent (Agent 3 owns the store)".
- Agent 3 names every other settings field but does not explicitly call out
  `CloudSyncFlowPersistedState` — `settings.dataHealthAutoRepairSummary` is
  named but the cloud receipt slot is not.
- Agent 5 §7.4 puts "the cloud-sync flow envelope (mirrors
  `CLOUD_SYNC_FLOW_STORAGE_KEY`)" in `UserDefaults`.

Three slots are possible: `AppData.settings.cloudSyncReceipt`, separate
`UserDefaults`, or separate file under Application Support. Each agent
proposes a different one (or doesn't say).

**Proposed resolution**: Final gate doc declares one canonical slot. Recommendation:
`UserDefaults` for the cloud receipt (matches the PWA's localStorage-not-AppData
boundary) but **scoped to the signed-in `auth.uid()`** so account switch on the
same device does not bleed receipts. Agent 7 §12.2 already implies Keychain for
the auth tokens but UserDefaults for non-secret receipt fields is the right
slot.

### 12.6 HealthKit type-set initialiser style differs (LOW)

- Agent 5 §8.1: `HKQuantityType(.restingHeartRate)` (iOS 14+ shorthand).
- Agent 7 §4.2: `HKQuantityType.quantityType(forIdentifier: .restingHeartRate)`
  (older shorthand).

Both compile. Just stylistic. **Proposed resolution**: adopt Agent 5's
modern shorthand; Agent 7's draft `Info.plist` text is untouched (the strings
are user-facing, the type-set initialisers are code-only).

### 12.7 Account-deletion server-side hook is unowned (MEDIUM)

- Agent 7 §10.3 names this and tags Agent 4: "This is an open server-side
  implementation task, NOT a client decision. Flag to Agent 4 (cloud agent)."
- Agent 4 does not mention account deletion anywhere in §3 wire contract,
  §10 server-side gaps, or §12 open questions.
- Agent 8 iOS-10 acceptance does not include the deletion flow.

**Proposed resolution**: The final gate doc adds a new sub-task or expands
iOS-7 to include: (a) client UI for "Delete account", (b) Supabase
Edge Function or `SECURITY DEFINER` Postgres function for the server-side
auth + cloud-row deletion. This must ship in V1 if cloud sync ships in V1
(Agent 7 §10.1).

### 12.8 Module-name vs folder-name mismatch for the persistence layer (LOW)

- Agent 5 §3.1 + §4.4: module name `IronPathPersistence`; class name
  `JSONFileAppDataStore`.
- Agent 8 §4 iOS-5: folder `ios/IronPath/Storage/AppDataStore.swift`.

Different names for the same concept. **Proposed resolution**: Adopt Agent 5's
`IronPathPersistence` module name; the SwiftFile is `JSONFileAppDataStore.swift`
inside that module. Agent 8's iOS-5 plan doc (when it opens) is updated to
match.

### 12.9 Diagnostics ring buffer storage not aligned (LOW)

- Agent 7 §5.3: "In-memory diagnostic ring buffer — last N events, viewable
  from `设置 → 诊断信息` and copyable for support bundles."
- Agent 4 §10.3: in-memory `cloudOperationJournal` per the TS reference
  (`cloudOperationJournal.ts:20-32`).
- Agent 3 makes no mention of ring buffer / journal persistence.

Both in-memory, but is there shared diagnostic surface between cloud journal
and security ring buffer? **Proposed resolution**: not blocking. Add a note
to the final gate doc that the diagnostics surface is one ring buffer used
by both subsystems; Agent 5 lays out the UI (`Diagnostics` screen in the
Settings tab).

### 12.10 iOS minimum version is unconfirmed (LOW)

- Agent 5 picks iOS 17 (§11.1) but flags it as "Confirm device matrix"
  (§15 question 7).
- Agent 1 asks "What is the iOS minimum supported version?" (§10 question 4).
- Agent 6 asks "iOS 17 (broader compatibility) or iOS 18?" (§13 question 2).
- Agent 8 cites iOS 17 from Agent 5 (line 181) and risk §11.11 "iOS 17 / 18 /
  26 matrix grows".

Substantive agreement on iOS 17 with one outstanding question on whether iOS 18
is needed for newer SwiftData features. **Proposed resolution**: lock to iOS 17.0
in the final gate doc; SwiftData is out of V1 scope anyway (Stop Condition #9).

---

## 13. Required revisions before merging the entry gate doc

These are the revisions the final gate doc must absorb. Numbered for
trackability. Owners are the agents whose section gets edited; severity is
HIGH/MEDIUM/LOW.

| # | Revision | Owning agent | Severity |
|---|---|---|---|
| 1 | Adopt one parity-fixture directory path. Recommend `tests/fixtures/parity/` (Agent 6 wins); Agent 8 iOS-0 acceptance edited to reference Agent 6's paths and the script name `scripts/generate-parity-goldens.mjs`. | Agent 8 | HIGH |
| 2 | Resolve `supabase-swift` SDK vs Stop Condition #10. Either (a) get explicit user approval to allow this one SwiftPM dependency, or (b) downgrade Agent 4's recommendation to "plain URLSession V1, official SDK as V1.5 if pain materialises". Track as a user-facing P0 decision that gates iOS-7 planning. | Agent 4 + Agent 8 | HIGH |
| 3 | Add iOS-7.x (or expand iOS-7) for "in-app account deletion" client UI + server-side hook (Edge Function or `SECURITY DEFINER` Postgres function). Required if cloud sync ships in V1 (App Review 5.1.1(v)). | Agent 4 (server) + Agent 7 (UX policy) + Agent 8 (sequencing) | HIGH |
| 4 | Agent 6 `TrainingDecisionEngineParityTests` must explicitly assert `hiddenDebugSignals.arbitrationTrace` is byte-equal between TS and Swift. The dev-only AR-1..AR-9 trace can otherwise regress silently. | Agent 6 | MEDIUM |
| 5 | Cloud receipt slot: declare the canonical iOS slot (`UserDefaults` scoped to `auth.uid()`) and the canonical AppData boundary (`CloudSyncFlowPersistedState` is NOT stored inside `AppData.settings`). Mirrors web `localStorage` outside of AppData. | Agent 3 + Agent 4 | MEDIUM |
| 6 | Align module-name / folder-path conventions across agents. Adopt Agent 5's module map: `IronPathDomain`, `IronPathDataHealth`, `IronPathPersistence`, `IronPathCloudSync`, `IronPathHealthKit`, `IronPathBackup`, `IronPathL10n`, `IronPathUIKit`, `IronPathApp`. Agent 8's iOS-N plan docs reference these names. | Agent 5 + Agent 8 | MEDIUM |
| 7 | HealthKit and Cloud Sync are parallel siblings (after iOS-5 + iOS-6), not sequential. Agent 5's P-phase numbering and Agent 8's iOS-N numbering are explicitly aligned: iOS-7 ≈ Cloud, iOS-8 ≈ HealthKit, both ungated by each other. | Agent 5 + Agent 8 | MEDIUM |
| 8 | Lock iOS minimum to iOS 17.0 across all agents (Agents 1, 5, 6, 8 currently agree but with open questions). One-line statement in the gate doc closes this. | Agent 5 | LOW |
| 9 | Agent 5 §6.4 tab-navigation rationale ("honor the evolved UI") is restated as an intentional design choice with rollback path, not a default. The final gate doc records this so a future agent does not unilaterally split Plan into a top-level tab. | Agent 5 | LOW |
| 10 | Stop Condition #1 (no WebView wrapper) is also asserted by Agent 5 §11.1 (no Mac Catalyst, no iPad — implies no WebView). Final gate doc explicitly cross-references Agents 5 / 7 / 8 invariants so the prohibition is locked at three layers. | Agent 5 + Agent 7 + Agent 8 | LOW |

---

## 14. Approved-as-is items

These are contracts that all relevant agents agree on and that the final gate
doc carries forward verbatim:

1. **TrainingDecision is the sole arbiter; no second decision path may exist.**
   Per Agent 1 §3.1, §5.1; Agent 2 row 98; Agent 3 §5.3; Agent 6 P0; Agent 8
   Stop Condition #3.
2. **Branded CleanTrainingDecisionInput contract preserved.** Swift enforces
   at compile time via `fileprivate` init + single factory entrypoint
   (Agent 3 §5.3). Stronger than TS runtime brand.
3. **AppData on-disk format: single JSON file under Application Support, atomic
   write, previous-version backup, version marker last.** Per Agent 3 §4.1,
   §4.2; Agent 5 §7.2.
4. **No SwiftData / Core Data / SQLite in V1.** Per Agent 3 §4.2, §4.4;
   Agent 5 §7.3; Agent 8 Stop Condition #9. Escalation thresholds named by
   Agent 3 §4.3.
5. **`STORAGE_VERSION = 8` is locked; ladder ends at V6 but stamps to 8.**
   Per Agent 3 §3.3, §3.4. Swift port replicates the collapsed ladder.
6. **Data Health repair registry: 9 V1 repairs in defined order, ledger 1000
   cap, receipts 500 cap, idempotency 24h, backup-first MAX_BACKUPS = 5.**
   Per Agent 3 §6.1, §6.2, §6.3, Appendix A; Agent 6 P0 parity tests.
7. **Repair receipts and ledger travel with the snapshot.** PWA↔iOS round-trip
   preserves the full repair history without a separate sync step.
   Per Agent 3 §6.3.
8. **Cloud sync wire contract: single Supabase table `cloud_appdata_snapshots`,
   anon key only, RLS via `auth.uid()`, append-only, no update/delete policies.**
   Per Agent 4 §3.
9. **V5 fresh-read preflight is MANDATORY on iOS V1.** Stricter than the TS
   web build's optional path. `expectedPreviousHash` plumbed through Swift
   gateway from day one. Per Agent 4 §6.2 step 4, §7.2, Appendix B.
10. **No background sync of any kind. No `BGTaskScheduler`, no `BGAppRefreshTask`,
    no `HKObserverQuery` background delivery, no silent push, no
    `applicationDidEnterBackground` upload trigger.** Per Agent 4 §9.1;
    Agent 5 §10; Agent 8 Stop Condition #2.
11. **No silent conflict resolution. `canAutoApply: false,
    manualResolutionRequired: true` — always.** Per Agent 4 §8;
    Agent 8 Stop Condition #5.
12. **No partially-repaired AppData upload. `ensureCloudUploadEligible` gate
    is mandatory.** Per Agent 4 §9.4; Agent 8 Stop Condition #4.
13. **No service-role key in iOS bundle. Build-phase scan blocks JWT-shaped
    strings, `sk_*`, `sb_secret_*`, `SUPABASE_SERVICE_ROLE_KEY`, `AIza*`.**
    Per Agent 4 §9.6; Agent 7 §12.3.
14. **HealthKit read-only V1. `NSHealthShareUsageDescription` ships;
    `NSHealthUpdateUsageDescription` does NOT.** Permission requested lazily
    on user tap, not at cold boot. Per Agent 5 §8.1, §8.2; Agent 7 §4.1,
    §4.2, §4.3; Agent 8 iOS-8 acceptance.
15. **HealthKit type set:** resting HR, HRV SDNN, HR, step count, active
    energy, exercise time, body mass, body fat %, VO2max, sleep, workout.
    Per Agent 5 §8.1, Agent 7 §4.2 (1:1 match).
16. **No Sign in with Apple in V1.** Email/password via Supabase only. No
    third-party OAuth wired, so SIWA is not required by App Review 4.8.
    Per Agent 4 §4.3; Agent 7 §8 R7.
17. **`ITSAppUsesNonExemptEncryption = NO` in Info.plist.** Per Agent 7 §9.
18. **No Sentry / Crashlytics / analytics SDK / advertising SDK / IDFA. No
    `NSUserTrackingUsageDescription`.** Per Agent 7 §11; Agent 8 Stop
    Condition #7.
19. **iOS minimum target: iOS 17.0.** Per Agent 5 §11.1; converged with
    Agents 1 / 6 / 8.
20. **Five tabs in exact order: Today / Train / History / Progress / Settings,
    Plan as sub-route of Progress.** Per Agent 5 §6.1, §6.4.
21. **Focus Mode is full-screen cover, not a NavigationStack push.** Tab
    bar disappears automatically. Per Agent 5 §6.3.
22. **kg is canonical storage, lb is display-only, kg ↔ lb conversion uses
    `KG_PER_LB = 0.45359237` exactly.** Per Agent 1 §3.5, §5.5. Display
    weight `displayUnit` is per-set, never coerced to a canonical unit
    on read.
23. **ISO timestamps stored as `String` in Swift `AppData`, never `Date`.**
    Preserves cross-platform hash parity. Per Agent 3 §10.3.
24. **Open key-bag (`additionalProperties: true`) preserved on Swift side
    via `unknown: [String: JSONValue]` carriers at every level the JSON
    schema permits.** Per Agent 3 §3.2, §6.3, §10.2, §10.10.
25. **`autoRepairOrchestrator` runs on launch via background detached task,
    never blocks the UI.** Per Agent 3 §7.2.
26. **No popup / modal / alert anywhere in the data-health or cloud-sync
    flows.** Passive status line only. Per Agent 3 §7.2; Agent 4 §6.4, §8.4.
27. **iOS-0 (TS-side fixture export) strictly precedes iOS-1 (Xcode project).**
    Per Agent 6 §11; Agent 8 Stop Condition #6.
28. **Eight SPM packages under `Packages/`** for module isolation: `IronPathDomain`,
    `IronPathDataHealth`, `IronPathPersistence`, `IronPathCloudSync`,
    `IronPathHealthKit`, `IronPathBackup`, `IronPathL10n`, `IronPathUIKit`.
    Per Agent 5 §3.1, Appendix A dependency graph.
29. **Forbidden-copy scan** on the shipped `.app` bundle (the 4 V2 forbidden
    phrases must not appear). Per Agent 6 §4 + manual smoke Flow 12.
30. **Real-data redacted fixture (`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`)
    is the canonical end-to-end pipeline parity input.** Per Agent 6 §5
    fixture #15.

---

## 15. Open questions (track but do not block)

These do not block the entry gate but should remain in the program owner's
inbox.

1. **i18n strategy.** Single-locale zh-Hans for V1 vs slot-for-English at
   day 1. Affects every `UI_COUPLED` engine port. Agent 1 §10 Q3, Agent 2 §10
   Q5, Agent 5 §11.2.
2. **Apple Health write-back as V2.** Per Agent 5 §15 Q4, Agent 7 §14 Q4.
   Read-only for V1 is locked; write-back deferred.
3. **HealthKit XML import as fallback.** Currently dropped for V1 (Agent 5
   §8.4). Confirmed via Agent 5 §15 Q9, Agent 7 referenced in §3.
4. **CSV export path on iOS.** Currently `UIActivityViewController` + tempfile
   (Agent 2 §10 Q3). Not specified by Agent 5; not blocking.
5. **Adaptive calibration state lifetime on first iOS install.** Per Agent 1
   §10 Q9 — does iOS inherit web calibration via cloud restore or start fresh?
6. **Push notifications for rest timer.** Per Agent 1 §10 Q10, Agent 5 §10.3
   (P2 reserved slot). Not in V1.
7. **App Store Connect provisioning and bundle ID ownership.** Per Agent 5
   §15 Q10. Not architectural; admin prerequisite.
8. **Diagnostics ring buffer scope.** Per cross-agent contradiction §12.9.
9. **Universal Link for Supabase password reset.** Per Agent 4 §12 Q1.
   Optional; deferred until password-reset feature is built.
10. **Receipt migration: web user installing iOS for the first time.**
    Per Agent 4 §12 Q8. UX walkthrough needed; not blocking the contract.
11. **Multi-device live mirror.** Per Agent 4 §3.6, §10.1. Blocked on V6
    server-side compare-and-insert; advertised as single-device V1.
12. **iCloud backup exclusion setting.** Per Agent 7 §14 Q3. Default ALLOW,
    add opt-in exclusion as a setting.
13. **Privacy policy URL hosting.** Per Agent 7 §14 Q7. Required for App
    Store but content-only; agnostic to V1 architecture.
14. **What does the user actually want the cloud-sync UI to say on iOS?**
    Final Chinese copy is Agent 5 / product call. Agent 4 §6.4 names the
    semantics; the exact strings are open.

---

End of cross-agent grill review.
