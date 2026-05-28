# AGENT 1 — AppData Schema Inventory (iOS-2A)

Agent: Agent 1 — AppData Schema Agent
Scope: iOS-2A AppData Swift Models Plan V1
Date: 2026-05-28
Status: planning-only (no runtime / Swift / fixture writes)

## 1. Mission

Produce a complete, citation-linked inventory of the TypeScript `AppData`
contract that the iOS-2 native rewrite must reproduce in Swift. This means:

- enumerate every type `AppData` transitively references,
- classify each as `open-bag` (schema permits unknown keys) or `closed-bag`,
- mark every timestamp, enum and float field that is precision-sensitive,
- list every non-deterministic fallback (`Date.now()` / `new Date().toISOString()`)
  that the Swift code must NOT re-mint on read, and
- carry forward `STORAGE_VERSION = 8` and the `schemaVersion` rule.

This file is the canonical reference for Agent 2 (parity), Agent 3 (Swift
model surface) and Agent 4 (storage layer) inside iOS-2A.

## 2. Inputs inspected

| Source | Path | Coverage |
| --- | --- | --- |
| TS model | `src/models/training-model.ts` | Full file (1387 lines). `AppData` at L1362–1387, all transitive types L1–L1361. |
| JSON-Schema | `src/models/training-data.schema.json` | Full file (728 lines). Counted every `additionalProperties` hit. |
| Storage version | `src/data/appConfig.ts:4` | `STORAGE_VERSION = 8`. |
| Migration ladder | `src/storage/appDataMigration.ts` | Full file (194 lines). Note: ladder only encodes up to v6 (see §6). |
| Sanitizer | `src/storage/appDataSanitize.ts` | Date-fallback grep (L550, L588, L639). |
| Fixture context (non-modifying) | `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json` | Confirms a single canonical AppData snapshot drives parity. |

> Not read: `App.tsx`, runtime engines (other than `engineUtils` referenced by
> migration). Per brief.

## 3. AppData inventory table

`AppData` has **24 own fields** (L1362–1387). The transitive type graph
contains **~70 named types** in `training-model.ts`. Below: one row per type
that is reachable from `AppData` (direct field, nested field, or referenced
helper type). Types that are pure UI/view-model (not persisted in `AppData`)
are omitted with a footnote.

Columns:
- TS — `path:line` of the declaration
- Swift candidate — recommended Swift type kind (no API design, only kind)
- Open-bag — YES if schema declares `additionalProperties: true` (or TS uses
  `[key: string]: unknown` / `Record<string, unknown>`); NO if closed
- TS fallback risk — `Date.now()` / `new Date().toISOString()` / float
  arithmetic / runtime `unknown` cast that the iOS code might wrongly mirror
- Fixture coverage — `snapshot-hash-stable-v1.json` (S) / golden tests (G) /
  none (–)
- Risk — LOW / MEDIUM / HIGH for parity drift in Swift port

### 3.1 Top-level `AppData`

| Field | Type / Citation | Open-bag? | Timestamp / Enum / Numeric notes | Risk | Action |
| --- | --- | --- | --- | --- | --- |
| `schemaVersion` | `number` (L1363) | NO | Integer; canonical = 8 (see §6). | LOW | `Int`. Reject < 1. |
| `templates` | `TrainingTemplate[]` (L1364) | container open via item | n/a | MEDIUM | Array of struct. |
| `history` | `TrainingSession[]` (L1365) | item open-bag | many timestamps | HIGH | Array; preserve unknown keys verbatim. |
| `bodyWeights` | `BodyWeightEntry[]` (L1366) | item open-bag (schema L38) | `date` string, `value` float | LOW | Array. |
| `activeSession` | `TrainingSession \| null` (L1367) | item open-bag | same as history item | HIGH | `Optional<TrainingSession>`. |
| `selectedTemplateId` | `string` (L1368) | NO | n/a | LOW | `String`. |
| `trainingMode` | `TrainingMode` enum (L1369) | NO | `'hybrid' \| 'strength' \| 'hypertrophy'` | LOW | Swift enum with `unknown` fallback. |
| `unitSettings` | `UnitSettings` (L1370) | NO (closed in TS) | float increments | LOW | Struct. |
| `todayStatus` | `TodayStatus` (L1371) | YES (schema L299) | enums + date | LOW | Struct + carry unknown keys. |
| `userProfile` | `UserProfile` (L1372) | YES (schema L335) | numerics min 0 | LOW | Struct + carry unknown. |
| `screeningProfile` | `ScreeningProfile` (L1373) | YES (schema L360) | nested `adaptiveState.lastUpdated` | MEDIUM | Struct + carry unknown; preserve nested open-bag for adaptiveState. |
| `programTemplate` | `ProgramTemplate` (L1374) | YES (external schema `training-program.schema.json`) | n/a | LOW | Struct. |
| `mesocyclePlan` | `MesocyclePlan` (L1375) | YES (schema L640) | `startDate`, `lengthWeeks` enum, multiplier float | LOW | Struct. |
| `programAdjustmentDrafts?` | `ProgramAdjustmentDraft[]` (L1376) | YES per item (schema L559) | `createdAt`, `appliedAt`, `rolledBackAt` | MEDIUM | `[ProgramAdjustmentDraft]?`. |
| `programAdjustmentHistory?` | `ProgramAdjustmentHistoryItem[]` (L1377) | YES (schema L604) | `appliedAt`, `rolledBackAt` | MEDIUM | `[…]?`. |
| `activeProgramTemplateId?` | `string` (L1378) | n/a | n/a | LOW | `String?`. |
| `healthMetricSamples?` | `HealthMetricSample[]` (L1379) | YES (schema L244); has `raw: unknown` | `startDate`, `endDate`, `importedAt` | HIGH | Array; preserve `raw` verbatim, do NOT re-mint timestamps. |
| `importedWorkoutSamples?` | `ImportedWorkoutSample[]` (L1380) | YES (schema L266); has `raw: unknown` | `startDate`, `endDate`, `importedAt` | HIGH | Same. |
| `healthImportBatches?` | `HealthImportBatch[]` (L1381) | YES (schema L287) | `importedAt` | LOW | Array. |
| `dismissedCoachActions?` | `DismissedCoachAction[]` (L1382) | YES (schema L131) | `dismissedAt` | LOW | Array. |
| `dismissedDataHealthIssues?` | `DismissedDataHealthIssue[]` (L1383) | YES (schema L141) | `dismissedAt` | LOW | Array. |
| `pendingSessionPatches?` | `PendingSessionPatch[]` (L1384) | YES (schema L189) | `createdAt`, `consumedAt`, `dismissedAt`, `expiredAt` | MEDIUM | Array. |
| `adaptiveCalibration?` | `AdaptiveCalibrationState` (L1385) | NO at top (TS L618–623, no `[key: string]`), but nested entries leak floats | `version: 1` literal, `lastUpdated`, `frozenUntil` | HIGH | Struct; preserve float bias precision (see §7). |
| `settings` | `AppSettings` (L1386) | YES — `[key: string]: unknown` (TS L1332, schema L118) | mirrors several top-level fields | HIGH | Open-bag bag: must round-trip unknown keys verbatim. |

### 3.2 Transitive types

> Format: **TypeName** — TS path:line / Swift candidate kind / Open-bag /
> Timestamp / Enum / Numeric / Fixture / Risk / Action.

#### Settings & user profile

- **UnitSettings** — `training-model.ts:170` / `struct` / NO (closed in TS) but
  `additionalProperties: true` not enforced (not in schema). Numeric:
  `defaultIncrementKg`, `defaultIncrementLb` floats; `customIncrementsKg/Lb`
  float arrays. Fixture: S. Risk: LOW. Action: Swift struct; preserve float
  precision; `weightUnit` enum `'kg' | 'lb'`.
- **UserProfile** — `training-model.ts:191` / `struct` / YES (schema L335).
  Enums: `sex`, `trainingLevel`, `primaryGoal`. Numerics: `age`, `heightCm`,
  `weightKg` (float), `weeklyTrainingDays`, `sessionDurationMin`. Arrays of
  strings. Fixture: S. Risk: LOW. Action: struct + unknown-keys bag.
- **ScreeningProfile** — `training-model.ts:208` / `struct` / YES (L360).
  Contains nested `AdaptiveState`. Fixture: S. Risk: MEDIUM (nested open).
- **AdaptiveState** — `training-model.ts:182` / `struct` / open via
  `Record<string, number>` intersections. Numeric maps. Timestamp: `lastUpdated`.
  Fixture: S. Risk: MEDIUM. Action: keyed-by-string number maps must allow
  unknown keys.
- **PostureFlags / MovementFlags / WeeklyMuscleTargets** — `training-model.ts:178–180` /
  string-keyed `Record<>`. Schema treats as
  `additionalProperties: { type: "string" }` for posture/movement (L342–343).
  Open-bag YES. Risk: LOW. Action: `[String: …]` dictionaries.

#### Today / readiness

- **TodayStatus** — `training-model.ts:505` / `struct` / YES (L299). Enums:
  `sleep`, `energy`, `time`; `soreness` array of `'无' | MuscleGroup`. Risk: LOW.
- **ReadinessSignal** — `training-model.ts:246` / not directly persisted into
  `AppData`; appears as derived view-model. Skip from inventory.
- **ReadinessInput / ReadinessResult** — `training-model.ts:1012, 1021` / runtime
  only. Skip.

#### Training program

- **TrainingTemplate** — `training-model.ts:513` / `struct` / YES per schema L440.
  Timestamps: `updatedAt`, `appliedAt`. Contains `ExerciseTemplate[]`. Risk:
  MEDIUM. Action: preserve unknown keys at item level.
- **ExerciseTemplate** — `training-model.ts:345` (extends `ExerciseMetadata`) /
  `struct` / YES (schema L421). Many optional metadata floats, enum-like
  strings widened to `string`, `[number, number]` tuples. Fixture: S. Risk:
  HIGH (float tuples, `progressionPercent`, `targetRir`).
- **ExerciseMetadata** — `training-model.ts:313` / inline / open-bag in schema.
  Risk: MEDIUM. Tuples must be modelled as fixed-length arrays in Swift.
- **ExerciseEquivalenceChain** — `training-model.ts:305` / `struct` / open
  (schema not strict). Risk: LOW.
- **TechniqueStandard** — `training-model.ts:240` / `struct` / not open in
  schema; three string fields. Risk: LOW.
- **DayTemplate** — `training-model.ts:218` / `struct` / closed in TS, open in
  schema. Risk: LOW.
- **ProgramTemplate** — `training-model.ts:228` / `struct` / open via external
  schema. Fixture: S. Risk: LOW.

#### Session & set

- **TrainingSession** — `training-model.ts:775` / `struct` / YES (schema L725).
  ~50 fields, many optional, many timestamps (`startedAt`, `finishedAt`,
  `editedAt`, `appliedAt` in nested). Enum: `dataFlag`, `currentFocusStepType`,
  `adjustmentType`. Risk: HIGH. Action: must round-trip unknown keys; iOS code
  must NOT add a default for missing `dataFlag` (sanitizer already does that on
  read; see §5).
- **TrainingSetLog** — `training-model.ts:255` / `struct` / YES (schema L390).
  Numeric: `weight`, `reps`, `actualWeightKg`, `displayWeight`, `painSeverity`,
  `targetRir` tuple. Enum: `type`, `warmupType`, `techniqueQuality`,
  `completionStatus`. Timestamp: `completedAt`. Risk: HIGH (float kg ↔ lb,
  RIR ambiguous union `number | string`).
- **ExercisePrescription** — `training-model.ts:378` (extends
  `Omit<ExerciseTemplate, 'sets'>`) / `struct` / open. Critical inline:
  `sets: number | TrainingSetLog[]` union. Risk: HIGH — Swift cannot directly
  express number-or-array union; must use enum.
- **ActualSetDraft** — `training-model.ts:290` / `struct` / closed. Risk: LOW.
- **DeloadDecision** — `training-model.ts:494` / `struct` / closed in TS; not
  represented in schema separately. Risk: LOW.
- **CorrectionExercise / FunctionalExercise / CorrectionModule / FunctionalAddon** —
  `training-model.ts:440–492` / `struct` / open via schema `supportExercise` /
  `supportModule` L457, L615. Risk: LOW.
- **SupportPlan** — `training-model.ts:625` / `struct` / closed in TS; nested
  ratios floats. Risk: LOW.
- **AdherenceAdjustment** — `training-model.ts:1003` / `struct` / closed. Risk:
  LOW.
- **SupportExerciseLog** — `training-model.ts:895` / `struct` / open (schema L472).
  Risk: LOW.
- **AppliedCoachActionPatch** — `training-model.ts:906` / `struct` / open;
  nested `snapshot` is recursive over session-shape. Timestamp `appliedAt`.
  Risk: MEDIUM.
- **SessionPatch** — `training-model.ts:939` / `struct` / open (schema L166).
  Risk: LOW.
- **PendingSessionPatch** — `training-model.ts:951` / `struct` / open (L189).
  Timestamps `createdAt`, `consumedAt`, `dismissedAt`, `expiredAt`. Risk: LOW.
- **RestTimerState** — `training-model.ts:726` / `struct?` / open (schema L501).
  Timestamp `startedAt`. Risk: LOW. (Nullable in session.)
- **LoadFeedback** — `training-model.ts:540` / `struct` / open (L484). Enum
  `feedback`. Risk: LOW.
- **FeedbackSummary** — `training-model.ts:534` / `struct` / closed. Risk: LOW.
- **SessionEditHistoryItem** — `training-model.ts:759` / `struct` / open
  (schema inline L721). Timestamp `editedAt`. Risk: MEDIUM.
- **SessionEditSummarySnapshot** — `training-model.ts:747` / inline struct /
  open (schema L699, L714). Floats `workingVolume`, `warmupVolume`. Risk: LOW.

#### Mesocycle

- **MesocyclePlan** — `training-model.ts:1313` / `struct` / open (schema L640).
  Date `startDate`. Enum-like `lengthWeeks: 4 | 5 | 6`. Risk: LOW.
- **MesocycleWeek** — `training-model.ts:1305` / `struct` / open (L627). Float
  `volumeMultiplier` constrained 0.4..1.3. Risk: LOW.

#### Adaptive calibration

- **AdaptiveCalibrationState** — `training-model.ts:618` / `struct` / closed in
  TS (no `[key: string]`). Timestamp `lastUpdated`. Risk: MEDIUM.
- **AdaptiveCalibrationEntry** — `training-model.ts:580` / `struct` / closed.
  Floats `loadBias`. Timestamp `frozenUntil`, `lastUpdated`. Risk: HIGH (float
  bias must round-trip exactly for parity goldens).
- **AdaptiveObservation** — `training-model.ts:564` / `struct` / closed.
  Floats `recommendedKg`, `actualKg`, `loadDeltaRatio`, `bias`. Enum
  `outcome`. Timestamp `date`. Risk: HIGH.
- **RecommendationRecord** — `training-model.ts:592` / `struct` / closed.
  Floats, enums, optional fields. Timestamp `date`, `reconciledAt`. Risk: HIGH.

#### Health / import

- **HealthMetricSample** — `training-model.ts:669` / `struct` / open (L244).
  `raw: unknown` MUST round-trip. Timestamps. Risk: HIGH.
- **ImportedWorkoutSample** — `training-model.ts:685` / `struct` / open (L266).
  `raw: unknown` round-trip. Risk: HIGH.
- **HealthImportBatch** — `training-model.ts:704` / `struct` / open (L287).
  Risk: LOW.
- **HealthIntegrationSettings** — `training-model.ts:721` / `struct` / open
  (L115). Risk: LOW.

#### Program adjustment

- **AdjustmentChange** — `training-model.ts:1148` / `struct` / open (L531).
  Risk: LOW.
- **ProgramAdjustmentDraft** — `training-model.ts:1172` / `struct` / open
  (L559). Many timestamps. Risk: MEDIUM.
- **ProgramAdjustmentHistoryItem** — `training-model.ts:1200` / `struct` /
  open (L604). Nested `effectReview`. Risk: MEDIUM.
- **ProgramAdjustmentDiff** — `training-model.ts:1220` / `struct` / closed in
  TS, no schema. Risk: LOW. (View-model — verify before persisting.)
- **AdjustmentEffectReview** — `training-model.ts:1234` / `struct` / open
  (L601). Risk: LOW.

#### Settings open-bag

- **AppSettings** — `training-model.ts:1322` / `struct` / **YES, fully open**
  via `[key: string]: unknown` (L1332) and schema `additionalProperties: true`
  (L118). Risk: HIGH. Mirrors several top-level fields (e.g.
  `selectedTemplateId`, `trainingMode`, `activeProgramTemplateId`). The Swift
  layer MUST preserve ALL extra keys verbatim; otherwise downstream code that
  reads `settings.X` for forward-compat features (e.g. coach action overrides)
  silently loses data.
- **DismissedCoachAction / DismissedDataHealthIssue / DataRepairLogEntry** —
  `training-model.ts:1335, 1341, 1347` / `struct` / open. Schema L131, L141,
  L204. `DataRepairLogEntry.before / after` are `unknown` — round-trip
  verbatim. Risk: MEDIUM.

#### Body weight / misc

- **BodyWeightEntry** — `training-model.ts:644` / `struct` / open (schema L38).
  Float `value`. Risk: LOW.

> **View-only types not persisted in `AppData`** (skipped — Swift inventory
> need not model these): `PerformanceSnapshot`, `WeeklyMuscleBudget`,
> `WeeklyPrescription`, `SupportExerciseDefinition`, `AdherenceReport`,
> `AdherenceSkippedItem`, `PainPattern`, `EstimatedOneRepMax`, `E1RMProfile`,
> `MuscleVolumeDashboardRow`, `WeeklyActionRecommendation`,
> `ExerciseRecommendation`, `ProgramAdjustmentPreview`, `EffectiveSetResult`,
> `EffectiveVolumeSummary`, `PersonalRecord`, `ExplanationItem`,
> `ExerciseWarningSignal`. These are produced by engines from `AppData` on
> demand. Agent 3 (engine surface) owns them.

## 4. Open-bag (`additionalProperties: true`) hot-spots

Total `additionalProperties: true` hits in `training-data.schema.json`: **38**
(including the top-level object). String-valued `additionalProperties` (i.e.
typed maps, not "any extra keys") is **5** (L342, L343, L350, L351, L354) and
does NOT widen the bag — those are typed open maps, not unknown-key holes.

Object-level "permit unknown keys" sites (Swift must round-trip):

| # | path:line in `training-data.schema.json` | What is open |
| --- | --- | --- |
| 1 | `:38` | `bodyWeights[]` item |
| 2 | `:115` | `settings.healthIntegrationSettings` |
| 3 | `:118` | `settings` (top-level) |
| 4 | `:121` | top-level `AppData` |
| 5 | `:131` | `dismissedCoachAction` |
| 6 | `:141` | `dismissedDataHealthIssue` |
| 7 | `:166` | `sessionPatch` |
| 8 | `:189` | `pendingSessionPatch` |
| 9 | `:204` | `dataRepairLog` |
| 10 | `:244` | `healthMetricSample` |
| 11 | `:266` | `importedWorkoutSample` |
| 12 | `:287` | `healthImportBatch` |
| 13 | `:299` | `todayStatus` |
| 14 | `:335` | `userProfile` |
| 15 | `:357` | `screeningProfile.adaptiveState` |
| 16 | `:360` | `screeningProfile` |
| 17 | `:390` | `trainingSet` |
| 18 | `:421` | `exerciseTemplate` |
| 19 | `:440` | `trainingTemplate` |
| 20 | `:457` | `supportExercise` |
| 21 | `:472` | `supportExerciseLog` |
| 22 | `:484` | `loadFeedback` |
| 23 | `:501` | `restTimerState` (non-null branch) |
| 24 | `:531` | `adjustmentChange` |
| 25 | `:559` | `programAdjustmentDraft` |
| 26 | `:597` | `effectReview.metrics` |
| 27 | `:601` | `programAdjustmentHistoryItem.effectReview` |
| 28 | `:604` | `programAdjustmentHistoryItem` |
| 29 | `:615` | `supportModule` |
| 30 | `:627` | `mesocycleWeek` |
| 31 | `:640` | `mesocyclePlan` |
| 32 | `:699` | `editHistory[].beforeSummary` |
| 33 | `:714` | `editHistory[].afterSummary` |
| 34 | `:721` | `editHistory[]` item |
| 35 | `:725` | `trainingSession` |

Plus two outer-level passthrough holes in TS only (not schema): `AppSettings`
`[key: string]: unknown` at `training-model.ts:1332`; `DataRepairLogEntry`
`before / after: unknown` at L1358–1359.

**Swift implication:** every Swift `Decodable` for these types MUST capture
unknown keys (e.g. dictionary side-bag `extraKeys: [String: JSONValue]`) and
re-emit them on encode. Otherwise round-trip parity fails the moment
TypeScript writes an unknown forward-compat key (commonly used for coach-action
overrides and Health raw payloads).

## 5. Non-deterministic fallback sites in migration / sanitize

Swift code reading these files MUST NOT mint a new timestamp / id when one is
missing. The TypeScript runtime currently does so for backwards-compat. Once
the iOS app is the source of truth, this would diverge clocks. Treat the
missing field as truly missing (or carry the TS-written value verbatim).

### 5.1 Migration

| path:line | Code | Risk |
| --- | --- | --- |
| `src/storage/appDataMigration.ts:39` | `` `exercise-${Date.now()}` `` fallback for a missing exercise id during legacy `migrateLegacyExercise`. | Only fires for pre-v1 raw payloads; in 2026-05 we are at v8. Swift may skip migration entirely (see §6). |

### 5.2 Sanitize

| path:line | Code | Risk |
| --- | --- | --- |
| `src/storage/appDataSanitize.ts:550` | `pickString(raw.createdAt, new Date().toISOString())` for `ProgramAdjustmentDraft.createdAt`. | MEDIUM. If Swift mirrors this, two clients re-mint different `createdAt`s and parity breaks. |
| `src/storage/appDataSanitize.ts:588` | Same for `ProgramAdjustmentHistoryItem.appliedAt`. | MEDIUM. |
| `src/storage/appDataSanitize.ts:639` | `` `session-${Date.now()}` `` fallback for `TrainingSession.id`. | HIGH. A blank id would re-mint on every read on Swift — id churn invalidates referential history. |

**Swift rule:** the sanitizer port must surface "missing required field" as a
typed validation error and refuse to back-fill with a wall-clock value. The
parity goldens (Agent 2) must include a fixture that exercises a missing
`createdAt` / `id` and the Swift behavior must match a documented contract
(either: keep the placeholder from the TS-produced file, or hard-fail).

> Cross-check: `Date.now` count in scope = **2**, `new Date()` count = **2**.
> Total non-deterministic fallback sites in this scope = **4** (one in
> migration, three in sanitize).

## 6. `STORAGE_VERSION = 8` and `schemaVersion` rules

- Canonical constant: `src/data/appConfig.ts:4` — `export const
  STORAGE_VERSION = 8;`. Re-exported via `src/data/trainingData` (consumed at
  `appDataMigration.ts:1`).
- Top-level `AppData.schemaVersion` (TS L1363, schema L20: `integer >= 1`) is
  the authoritative version stamp.
- `AppSettings.schemaVersion?` (TS L1323, schema L81) is a duplicate/shadow
  copy. Migration writes both (`migrateToV5` L131–133, `migrateToV6` L162–163).
- Migration ladder reaches **6** explicit stops (`v1..v6`), but the final stop
  `migrateToV6` writes `schemaVersion: STORAGE_VERSION` directly (L159) — so
  v6 effectively jumps to v8 today, and any legacy v6/v7 payload re-runs the
  v6 idempotent body. This is intentional but brittle. **Action for iOS:**
  Swift bootstrap MUST refuse to read anything where the top-level
  `schemaVersion < 8` UNLESS the migration port also lands. The current iOS-2A
  plan can safely assume `>= 8` and surface a typed "needs migration" error
  for anything else; the TS side is the only producer at this stage.
- Comparison rule the iOS code must implement:
  1. `let version = max(top.schemaVersion ?? 0, top.settings.schemaVersion ?? 0)`
  2. if `version < 8` → fail-fast, do NOT silently up-version
  3. if `version > 8` → fail-fast forward-incompat
  4. if `version == 8` → accept, sanitize, run

## 7. Top 3 risks

1. **Open-bag round-trip loss (HIGH).** 35 schema sites and at least 2 TS-only
   sites (`AppSettings`, `DataRepairLogEntry.before/after`) permit unknown
   keys / unknown shapes. If the Swift `Codable` types drop unknown keys on
   decode, any TS-written forward-compat field (e.g. a new
   `settings.coachActionOverride`) will silently vanish on the next Swift
   write. **Mitigation:** every Swift struct for these types needs an
   `extraJSON: [String: JSONValue]` side-bag preserved across decode/encode.
2. **Float precision in `AdaptiveCalibrationEntry.loadBias`,
   `AdaptiveObservation.bias`, `loadDeltaRatio`, `volumeMultiplier`, weights
   (HIGH).** Swift `Double` printing differs from JS `Number` printing for
   edge values (`0.1 + 0.2`). Parity goldens hash JSON output. **Mitigation:**
   golden tests must use a canonical JSON serializer (sorted keys, ECMA-262
   `Number.prototype.toString` semantics) on both sides; the Swift layer
   should NOT do its own rounding. Agent 2 owns this contract.
3. **Non-deterministic fallback sites (HIGH).** Four sites (§5) currently mint
   wall-clock timestamps / random-ish ids when a required field is missing.
   Porting these literally to Swift creates two writers with two clocks. The
   Swift port MUST treat these as validation errors instead of silent
   back-fills, and the TS side should also be hardened (out of scope for this
   agent — flag to Agent 4 / future cleanup).

---

## Notes / unconfirmed

- View-model types (`PerformanceSnapshot`, `WeeklyMuscleBudget`, `AdherenceReport`,
  etc.) are explicitly excluded above on the assumption that they are NOT
  persisted in `AppData`. A quick grep confirms none of them appears as a
  field of `AppData` (the 24 fields are listed in §3.1). Agent 3 / Agent 4
  should re-confirm if a derived snapshot is being cached into `settings.*`.
- The migration ladder gap between `v6 → v7 → v8` is not explicitly
  represented as separate functions; `migrateToV6` writes `STORAGE_VERSION`
  directly. Confirmed by inspection of the file (no `migrateToV7`,
  `migrateToV8` exist). Whether silent v6/v7 inputs are equivalent to v8 is
  asserted by `migrateToV6` but not proven by a parity fixture.
- Fixture coverage breadth: `tests/fixtures/parity/inputs/app-data/` contains
  one canonical snapshot (`snapshot-hash-stable-v1.json`). Agent 2 must add
  fixtures for: (a) a session with `restTimerState != null`, (b) a
  `healthMetricSample` with non-null `raw`, (c) a `settings` object with an
  unknown extra key, (d) an `AdaptiveCalibrationEntry` with a non-trivial
  `loadBias`. Without these, the open-bag and float-precision risks above are
  not actually exercised.
