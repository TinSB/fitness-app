# Data Integrity Remediation Planning V1

Status: planning-only (no code edits, no schema bump, no data rewrite)
Branch: `claude/data-integrity-remediation-planning-v1`
Owner: data-health architecture
Last updated: 2026-05-27

This document is a **planning artifact**. It decides scope, layering, sequencing, schema impact and test requirements for the three remaining real-data integrity issues that the [Real Data Health Repair System V1](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md) intentionally deferred. **No code under `src/` is modified by this PR.** Implementation is split into follow-up tasks listed in [DATA_INTEGRITY_REMEDIATION_TASKS_V1.md](DATA_INTEGRITY_REMEDIATION_TASKS_V1.md).

Cross-references:
- [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md) — 10-question policy and layer taxonomy.
- [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md) — V1 delivery (10 repair IDs, registry, ledger).
- [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md) — ingress pipeline used by every future repair.
- [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md) — upload guard.
- [CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md) — subsequent upload flow.

## 1. Executive summary

The V1 repair system shipped 9 active repair IDs covering lifecycle residue, duration anomalies, stale today-status, stale health data, issue-score caps, legacy advice isolation, setIndex renumbering, and a single audit-only entry (`replacementEquivalenceAuditV1`). Three real-data integrity classes were intentionally **deferred** with no auto-rewrite:

| Audit area | Current state | V1 verdict |
|---|---|---|
| Partial completion vs full completion | `session.completed=true` + `session.earlyEndReason='incomplete_main_work'` co-exist. No first-class `completionQuality`. | Deferred — requires either a derived runtime field or a schema bump. |
| Replacement / equivalence chain mismatch | `assisted-pull-up`/`assisted-dip` records carry `baseId`/`chainId` from incompatible patterns. | `replacementEquivalenceAuditV1` ships audit-only; no auto remap. |
| Duplicate set IDs across sessions | `set.id` like `lat-pulldown-1` reused in 4 different sessions. | Deferred — needs downstream consumer audit before deciding rewrite vs derived. |

This plan decides for each area: **runtime guard vs safe-auto vs audit-only vs schema bump vs curated mapping**, plus the recommended implementation order, the tests each follow-up must ship, and the precise data safety boundaries.

**Headline verdict:**
1. **Partial completion → derived `completionQuality` on CleanAppDataView (no schema bump in V1).** Persist only behind a separate, explicitly approved schema migration in a later phase.
2. **Replacement equivalence → curated remap table + runtime canonicalization (no record rewrite in V1).** Auto-rewrite only after the curated mapping ships and a regression fixture covers every member of every chain.
3. **Duplicate set IDs → audit-only + downstream consumer audit (no historical ID rewrite).** Introduce a derived `stableSetUid` ONLY if a future consumer actually needs global uniqueness; current consumers do not.

## 2. Why this is planning-only

The 10-question policy in [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md) requires every data-semantic change to ship: code fix + registry entry + repair module + regression fixture + tests + PR-body answers. None of the three areas can answer those questions without making decisions that span: schema (`completionQuality`), content curation (equivalence remap), and downstream contracts (set ID consumers). Forcing implementation now would either:

- write a destructive auto-repair (rewriting `completed`, rewriting `actualExerciseId`, or rewriting `set.id`) **before** the consumer surface is audited — violating the "no destructive rewrite without consumer audit" rule that already governs V1;
- ship a schema bump that has not been agreed by the program owner, breaking the policy gate in §6.4 of [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md);
- or introduce a runtime canonicalization that silently overrides user data without a curated mapping, which the V1 audit explicitly flagged as not safe.

Therefore this PR ships **docs only**. Follow-up implementations are tracked in [DATA_INTEGRITY_REMEDIATION_TASKS_V1.md](DATA_INTEGRITY_REMEDIATION_TASKS_V1.md), each gated on explicit approval.

## 3. Three issue areas at a glance

### 3.1 Partial completion (Class C in V1 fixture)

Real-data shape (`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`): 2/10 sessions have:

```json
{
  "id": "session-X",
  "completed": true,
  "finishedAt": "...",
  "earlyEndReason": "incomplete_main_work",
  "earlyEndSummary": "本次有效组较少，因为部分动作未完成。"
}
```

The session is finalized, the per-set `completionStatus` is correctly marked `incomplete` for skipped sets, and the per-exercise `completionStatus` is `partial` / `not_started`. The gap: there is **no first-class `completionQuality`** ever surfaced by Progress / History / Calendar, and TrainingDecision must rediscover the partial state from a mix of `earlyEndReason`, per-set `completionStatus`, and per-exercise `completionStatus` (see [trainingDecisionEngine.ts:1359](../src/engines/trainingDecisionEngine.ts:1359)).

### 3.2 Replacement / equivalence chain mismatch (Class J)

Real-data shape: 9 exercises with `actualExerciseId='assisted-pull-up'` carry `baseId='barbell-row'` and inherit a `horizontal-pull` equivalence chain; symmetric problem for `assisted-dip` inheriting the `fly` chain. The PR / e1RM record pool uses [`getExerciseRecordPoolId`](../src/engines/e1rmEngine.ts:29) which preferentially reads `actualExerciseId`, so **historical PR/e1RM is internally consistent** — the breakage is downstream:

- `equipmentFallbackEngine` matches by `equivalenceChainId`, so a vertical-pull lift is silently grouped with horizontal-pull rows.
- `smartReplacementEngine` (line 166) computes alternatives from the chain.
- `warmupPolicyEngine` (lines 111/114/133/143) derives technique cues from chain text.
- Programming engines that group by `baseId` (`exercisePrescriptionEngine` line 649; `programAdjustmentEngine` line 157, line 546) see the wrong primary pattern.

The audit (`replacementEquivalenceAuditV1`) detects the two known mismatch shapes but never rewrites. Auto-rewriting requires a **curated remap table** because the legacy `baseId` / `chainId` may have been carried in by an arbitrary set of older code paths.

### 3.3 Duplicate set IDs (Class I)

Real-data shape: 42/48 set IDs reused across sessions. `set.id='lat-pulldown-1'` appears in 4 sessions in the fixture. The addressing tuple used by every consumer that mutates a set is `(sessionId, exerciseId, setId)`:

- `apps/api/src/recordDataHealthMutation.ts:179` scopes by `sessionId` before calling `updateSessionSet`.
- `sessionEditEngine.matchesSet` (line 340) **already falls back to array index** when `set.id` does not match — so the duplicate is harmless inside the session.
- React keys (`set.id || index`) are stable per-session.
- Cloud sync uploads whole AppData snapshots; no `set.id` join key exists.

`focusModeStateEngine` lines 662, 744 use `set.id` to look up active-session warmup logs — this is **active session only**, and new sessions always write step-derived IDs (`main:${exerciseId}:warmup:...`) via `sessionBuilder` / `focusModeStateEngine`. The historical duplicate problem is a **statistics curiosity**, not a runtime hazard, but a future global-uniqueness consumer (e.g. a join-only analytics export) could surface the issue. The honest fix is **derived `stableSetUid = sessionId:exerciseIndex:setIndex:set.id`** — never rewrite historical `set.id` because that destabilizes record-edit URLs and ledger receipts.

## 4. Full inventory table

Columns: file/symbol — area — reads data? — writes data? — user-visible? — affects PR/e1RM? — affects TrainingDecision? — affects cloud/localStorage/sync? — safe to auto repair? — needs schema bump? — needs curated mapping? — action recommendation.

### 4.1 partialCompletion area

| file:symbol | reads | writes | user-visible | PR/e1RM | TD | cloud/sync | safe auto | schema? | curated? | recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| `src/models/training-model.ts:775` `TrainingSession` (completed, earlyEndReason, earlyEndSummary) | n/a (schema) | n/a | no | no | no | no | n/a | optional V2 | no | source-of-truth definitions; no V1 edit |
| `src/models/training-model.ts:255` `TrainingSetLog.completionStatus` | n/a | n/a | no | no | no | no | n/a | no | no | already complete |
| `src/models/training-model.ts:417` `ExercisePrescription.completionStatus` | n/a | n/a | no | no | no | no | n/a | no | no | already complete |
| `src/engines/trainingCompletionEngine.ts:67` `annotateExerciseCompletion` | yes | yes (on finalize only) | indirect | no | no | no | already safe | no | no | unchanged; correctly writes per-set completionStatus |
| `src/engines/trainingCompletionEngine.ts:149` `finalizeTrainingSession` | yes | yes (on finalize only) | yes | yes (via downstream filters) | yes | no | already safe | no | no | unchanged |
| `src/engines/trainingCompletionEngine.ts:206` `earlyEndReason='incomplete_main_work'` write | n/a | yes | yes | yes (via TD) | yes | no | already safe | no | no | unchanged |
| `src/engines/sessionQualityEngine.ts:139,217,272,290` partial penalty | yes | no | yes (training quality screen) | no | indirect | no | already safe | no | no | unchanged |
| `src/engines/trainingDecisionEngine.ts:1359` `incompleteMainWork` detection | yes | no | yes (next-time recommendation) | no | yes | no | already safe | no | no | unchanged |
| `src/engines/engineUtils.ts:92,98` `isCompletedSet` / `completedSets` | yes | no | indirect | yes (filters out incomplete from volume / PR) | yes | no | already safe | no | no | unchanged |
| `src/engines/analytics.ts:212,235,252,267` PR computation | yes | no | yes (Progress page) | yes | no | no | already safe | no | no | already filters via `completedSets` |
| `src/engines/e1rmEngine.ts:114` `collectCandidates` | yes | no | indirect | yes | no | no | already safe | no | no | already filters via `completedSets` + `isWorkSet` |
| `src/dataHealth/cleanAppDataView.ts:86` `buildCleanAppDataView` | yes | no (pure projection) | indirect | yes | yes | no | safe | no | no | **add derived `completionQuality` field on CleanAppData session view (planning-only doc)** |
| `src/features/RecordView.tsx:1277,1366,1333` partial UI markers | yes | no | yes | no | no | no | already safe | no | no | unchanged |
| `src/features/ProgressView.tsx:557,1484,1487` partial UI markers | yes | no | yes | no | no | no | already safe | no | no | unchanged |
| `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | no | no | already represents both partial sessions; reuse as Partial Completion V1 fixture |

### 4.2 replacementEquivalence area

| file:symbol | reads | writes | user-visible | PR/e1RM | TD | cloud/sync | safe auto | schema? | curated? | recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| `src/models/training-model.ts:255-264` `TrainingSetLog` identity fields (`actualExerciseId`, `originalExerciseId`, `baseId`, etc.) | n/a | n/a | no | no | no | no | n/a | no | no | unchanged; already validated by `replacementEngine` |
| `src/models/training-model.ts:305-344` `ExerciseEquivalenceChain` + `ExerciseMetadata.equivalenceChainId` | n/a | n/a | no | no | yes (chain) | no | n/a | no | no | unchanged |
| `src/data/exerciseLibrary.ts:EXERCISE_EQUIVALENCE_CHAINS` | n/a | n/a | no | no | yes | no | n/a | no | yes (content) | source of truth for chain identity |
| `src/engines/replacementEngine.ts:309` `metadata.equivalenceChainId` consumer | yes | no | indirect | no | yes | no | already safe | no | no | unchanged |
| `src/engines/smartReplacementEngine.ts:166` chain matching | yes | no | yes | no | yes | no | already safe | no | yes | reads incorrect chain when record has poisoned `equivalenceChainId` |
| `src/engines/equipmentFallbackEngine.ts:89` chain matching | yes | no | indirect | no | yes | no | already safe | no | yes | same — poisoned chain causes wrong fallback group |
| `src/engines/warmupPolicyEngine.ts:111,133,143` chain text | yes | no | yes | no | yes | no | already safe | no | yes | inherits poisoned text |
| `src/engines/exercisePrescriptionEngine.ts:507,533,574,649` baseId / canonicalExerciseId lookup | yes | no | indirect | no | yes | no | already safe | no | yes | same |
| `src/engines/e1rmEngine.ts:29-42` `getExerciseRecordPoolId` | yes | no | yes (PR) | yes | no | no | already safe | no | no | reads `actualExerciseId` first — PR pool already correct |
| `src/engines/analytics.ts:457` `key = exercise.baseId || exercise.id` | yes | no | yes | yes | no | no | already safe | no | yes | grouping uses poisoned baseId — should canonicalize |
| `src/engines/programAdjustmentEngine.ts:157,546,631,880` mainExerciseIds from baseId | yes | no | yes | no | yes | no | already safe | no | yes | poisoned baseId in legacy history may leak into program-template diffs |
| `src/engines/dataHealthEngine.ts:511` identity timestamp | yes | no | indirect | no | no | no | already safe | no | no | unchanged |
| `src/dataHealth/repairs/replacementEquivalenceAuditV1.ts:43-69` `collect` detector | yes | no | indirect | no | no | no | already safe (audit-only) | no | yes | extend in V2 — add curated remap |
| `src/dataHealth/cleanAppDataView.ts:86` (proposed canonicalization) | yes | no (projection) | indirect | yes (via consumers) | yes (via consumers) | no | safe (planning) | no | yes | **add runtime canonicalization for known curated remap entries** |
| `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` 9 mismatched exercises | n/a | n/a | n/a | n/a | n/a | n/a | n/a | no | no | reuse as remap regression fixture |

### 4.3 duplicateSetId area

| file:symbol | reads | writes | user-visible | PR/e1RM | TD | cloud/sync | safe auto | schema? | curated? | recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| `src/models/training-model.ts:255` `TrainingSetLog.id` | n/a | n/a | no | no | no | no | n/a | no | no | unchanged |
| `src/engines/sessionEditEngine.ts:340-341` `matchesSet` (sessionId+id OR index fallback) | yes | no (selector) | no | no | no | no | already safe | no | no | unchanged — fallback to index already correct |
| `src/engines/sessionEditEngine.ts:368` `updateSessionSet` | yes | yes (per record edit) | yes | indirect | no | no | already safe | no | no | unchanged |
| `apps/api/src/recordDataHealthMutation.ts:173,179` API set-edit | yes | yes (per record edit) | yes | indirect | no | no | already safe | no | no | unchanged |
| `src/devApi/devApiHistorySetEditClient.ts:67-481` dev API client | yes | yes (per record edit) | dev-only | indirect | no | no | already safe | no | no | unchanged |
| `src/devApi/DevApiHistorySetEditExperiment.tsx:51-797` UI | yes | yes (per record edit) | dev-only | indirect | no | no | already safe | no | no | unchanged |
| `src/engines/sessionDetailSummaryEngine.ts:104,110,191` `set.id` warmup detection | yes | no | yes | no | no | no | already safe (regex on id) | no | no | unchanged |
| `src/engines/effectiveSetExplanationEngine.ts:65,96` `set.id` warmup detection | yes | no | indirect | no | no | no | already safe | no | no | unchanged |
| `src/engines/focusModeStateEngine.ts:662,744` `focusWarmupSetLogs.find(set.id===...)` | yes (active session) | yes (active session) | yes | no | no | no | already safe (active session only) | no | no | unchanged — active session uses derived step IDs |
| `src/engines/replacementEngine.ts:396,399,450,453` `migrateStepId` for replacement | yes | yes (active session only) | yes | no | no | no | already safe | no | no | unchanged |
| `src/engines/dataHealthRepairEngine.ts:100,163` `set.id` in repair receipt key | yes | no | indirect | no | no | no | already safe (fallback to source+index) | no | no | unchanged |
| `src/engines/dataHealthEngine.ts:153,299,304,312,317,324,329,342,347,497,502,543,548,557,562` `set.id` in issue IDs | yes | no | indirect | no | no | no | already safe (fallback to setIndex) | no | no | unchanged |
| `src/features/RecordView.tsx:298,463,543,942,1148,1152,1160` `set.id` in keys + mutation paths | yes | yes (record edit) | yes | indirect | no | no | already safe | no | no | unchanged |
| `src/features/ProgressView.tsx:534,555` React keys | yes | no | yes | no | no | no | already safe | no | no | unchanged |
| `src/features/TrainingFocusView.tsx:1438` React keys | yes | no | yes | no | no | no | already safe | no | no | unchanged |
| `src/storage/apiStorageAdapter.ts:128` `ApiStorageHistorySetEditBody.setId` | n/a | n/a | no | no | no | no | already safe | no | no | unchanged |
| `src/cloudProduction/*` / `src/cloudSync/*` / `src/sync/*` | none (no `set.id` reads) | n/a | n/a | n/a | n/a | snapshot only | n/a | no | no | not affected |
| `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` 42/48 dup ids | n/a | n/a | n/a | n/a | n/a | n/a | n/a | no | no | reuse as audit fixture |

## 5. partialCompletion diagnosis

### 5.1 How are completed sessions represented today?

A fully completed session in `AppData.history`:

```ts
{
  completed: true,
  finishedAt: ISO,
  startedAt: ISO,
  durationMin: number,
  exercises: [{
    completionStatus: 'completed' | 'partial' | 'not_started',
    sets: TrainingSetLog[]  // each with done=true / completionStatus='completed' for finished sets
  }],
  earlyEndReason?: undefined  // omitted for a clean full completion
}
```

`finalizeTrainingSession` ([src/engines/trainingCompletionEngine.ts:149](../src/engines/trainingCompletionEngine.ts:149)) is the single authoritative writer.

### 5.2 How are partial sessions represented today?

A partial session is the same shape as above **plus**:

```ts
{
  completed: true,                         // still true — the session was ended
  earlyEndReason: 'incomplete_main_work',  // marker
  earlyEndSummary: '本次...',              // Chinese summary
  exercises: [{
    completionStatus: 'partial' | 'not_started',
    incompleteReason: 'ended_early',
    sets: [
      { done: true,  completionStatus: 'completed',   ... },
      { done: false, completionStatus: 'incomplete', incompleteReason: 'ended_early', ... }
    ]
  }]
}
```

### 5.3 What does `earlyEndReason='incomplete_main_work'` mean?

It is set by `finalizeTrainingSession` when both `options.endedEarly===true` AND `buildIncompleteMainWorkGuard(session).hasIncompleteMainWork===true` (line 188-206). The condition checks main working sets only (warmup / corrective / functional / support are excluded). It is therefore a **strong signal** that the user ended a session before completing the prescribed working sets.

### 5.4 Does `completed=true` currently imply full completion?

**No.** `completed=true` only means "this session has been finalized into history". The presence of `earlyEndReason` and per-set `completionStatus='incomplete'` is what distinguishes partial from full. This is the semantic gap — UI / analytics consumers that read `session.completed` alone cannot tell.

### 5.5 Which engines consume completed sessions?

Every engine that reads `session.history` goes through one of:

- `filterAnalyticsHistory` ([sessionHistoryEngine.ts:18](../src/engines/sessionHistoryEngine.ts:18)) — drops `dataFlag=test/excluded` and backfilled sessions; partial sessions remain.
- `completedSets(exercise)` ([engineUtils.ts:98](../src/engines/engineUtils.ts:98)) — filters incomplete sets and identity-invalid exercises; volume / PR / e1RM are therefore **already partial-safe at the set level**.
- `isAnalyticsSession` ([sessionHistoryEngine.ts:9](../src/engines/sessionHistoryEngine.ts:9)) — same.

### 5.6 Does TrainingDecision treat partial completion differently?

Yes. `trainingDecisionEngine.ts:1359-1414` checks the union `(session.earlyEndReason === 'incomplete_main_work' || analysis.incompleteWorkingSets.length || exercise.completionStatus === 'partial' || exercise.incompleteReason === 'ended_early')` and routes the recommendation to `repeat_next_time` with reasonCodes `['ended_early','incomplete_main_work']`. **TrainingDecision already distinguishes partial vs full at the per-exercise level**; the gap is upstream — there is no single canonical predicate.

### 5.7 Does Progress / history / calendars show partial sessions differently?

Yes — but only via the existing UI string surface (`未完成`, `未完成组`, `不计入完成、总量和有效组`, `earlyEndSummary`). There is no badge, no `completionQuality` chip, no calendar marker for a partial session. The data is correct; the surface is implicit.

### 5.8 Should `completionQuality` be persisted, derived, or schema-bumped?

**V1: derived only.** Add a derived `completionQuality: 'full' | 'partial' | 'aborted'` field on the CleanAppDataView session projection (or on the existing `buildSessionQualityResult`'s output) computed from already-present fields. No schema change. No AppData mutation. Engines that already check `earlyEndReason` keep working unchanged; new consumers (Progress badges, calendar dots) read the derived field.

**V2 (separate gated PR):** schema bump that adds `TrainingSession.completionQuality` as a first-class persisted field, written by `finalizeTrainingSession`. Until then, V1 ships zero schema risk.

### 5.9 Can V1 do runtime-derived `completionQuality` without schema change?

Yes. Derivation rule (formal):

```ts
const completionQuality = (session: TrainingSession): 'full' | 'partial' | 'aborted' | 'unknown' => {
  if (!session.completed) return 'unknown';
  if (session.earlyEndReason === 'incomplete_main_work') {
    const everyMainNotStarted = (session.exercises || [])
      .filter((e) => hasMainWorkingSet(e))
      .every((e) => e.completionStatus === 'not_started');
    return everyMainNotStarted ? 'aborted' : 'partial';
  }
  const someMainIncomplete = (session.exercises || [])
    .some((e) => e.completionStatus === 'partial' || e.completionStatus === 'not_started');
  return someMainIncomplete ? 'partial' : 'full';
};
```

This is pure, idempotent, and uses only fields already written by `finalizeTrainingSession`. No data is mutated.

### 5.10 What future schema would be ideal?

```ts
// V2 schema bump (gated by separate approval)
interface TrainingSession {
  // ... existing fields
  completionQuality?: 'full' | 'partial' | 'aborted';  // written by finalizeTrainingSession
  completionQualityRule?: 'derived_v1' | 'persisted_v2';  // provenance marker
}
```

`completionQualityRule='derived_v1'` is what `autoRepairOrchestrator` would write during a one-time backfill once the schema migration is approved. Until then, only the runtime-derived value is used.

## 6. replacementEquivalence diagnosis

### 6.1 Where does replacement / equivalence metadata come from?

Three sources, listed in **read priority**:

1. **`src/data/exerciseLibrary.ts:EXERCISE_EQUIVALENCE_CHAINS`** — the catalogue of canonical chains. The only authoritative source.
2. **`ExerciseMetadata.equivalenceChainId` / `canonicalExerciseId` / `baseId`** on the active library template (also from `exerciseLibrary.ts`).
3. **Per-record embedded copies** on `TrainingSession.exercises[].equivalence` / `baseId` / `canonicalExerciseId` — written by older code paths and frozen into history. **This is the poisoned source.**

### 6.2 Which fields conflict?

The mismatch in real data: an exercise with `actualExerciseId='assisted-pull-up'` (a vertical-pull lift in current catalogue) carries `baseId='barbell-row'` and `equivalence.chainId='horizontal-pull'`. The current catalogue says `assisted-pull-up` is on the `vertical-pull` chain. The historical record contradicts the catalogue.

### 6.3 Which field is authoritative today?

`actualExerciseId` is authoritative for the **record pool** ([e1rmEngine.ts:41](../src/engines/e1rmEngine.ts:41)): `actualExerciseId || replacementExerciseId || canonicalExerciseId || (replacedFromId ? id : baseId || id)`. This means PR / e1RM identity is **correct** even when the embedded chain is wrong. The chain mismatch breaks **programming and substitution suggestions**, not historical PR aggregation.

### 6.4 How does PR / e1RM use exercise identity?

`buildE1RMProfile` ([e1rmEngine.ts:171](../src/engines/e1rmEngine.ts:171)) calls `collectCandidates(history, exerciseId)` which uses `getExerciseRecordPoolId(exercise) === exerciseId`. Since `actualExerciseId` wins, the e1rm pool keyed by `assisted-pull-up` correctly contains the `assisted-pull-up` sets. PR/e1RM is **safe**.

### 6.5 How does TrainingDecision use movement pattern / equivalence?

`trainingDecisionEngine` does not directly read `equivalenceChainId`. It does read upstream engine outputs (`exercisePrescriptionEngine`, `programAdjustmentEngine`, `volumeAdaptationEngine`) that group by `baseId` / `canonicalExerciseId`. So the leak path is: poisoned `baseId` → wrong grouping → wrong daily-adjustment delta → wrong TrainingDecision. The runtime canonicalization in CleanAppDataView is therefore the right surface for the fix.

### 6.6 Which mismatches can be auto repaired safely?

Two deterministic cases the audit V1 already detects:

- `actualExerciseId ∈ {assisted-pull-up, pull-up, chin-up}` (vertical-pull) but `equivalence.chainId` is `horizontal-pull` → canonicalize to vertical-pull.
- `actualExerciseId ∈ {assisted-dip, dip, bench-dip}` (vertical-push) but `equivalence.chainId === 'fly'` → canonicalize to chest / vertical-push (curated).

These are the only safe deterministic remaps because they collapse a **wrong** chain to a **catalogue-confirmed** chain. Any other mismatch requires a curated remap.

### 6.7 Which require curated remap?

Everything else. Examples that real users may surface but the V1 detector does not flag:

- Variations of `seated-row` / `barbell-row` mis-pointing to a fly / vertical chain.
- Old custom exercises (deleted from catalogue) still referenced by `baseId` — these have **no canonical resolution** and must stay audit-only with a UI warning.

### 6.8 What should the remap table shape be?

```ts
// Proposed for Replacement Equivalence Curated Remap V1 follow-up
// Location: src/data/replacementEquivalenceRemap.ts (new file in follow-up task)
export type ReplacementEquivalenceRemapEntry = {
  // match clause
  match: {
    actualExerciseId?: string;
    legacyBaseId?: string;
    legacyChainId?: string;
  };
  // canonical resolution
  canonical: {
    baseId: string;
    chainId: string;
  };
  // provenance
  reason: string;
  approvedBy: 'content_owner_2026' | 'data_health_v2';
};

export const REPLACEMENT_EQUIVALENCE_REMAP: readonly ReplacementEquivalenceRemapEntry[] = [
  {
    match: { actualExerciseId: 'assisted-pull-up', legacyChainId: 'horizontal-pull' },
    canonical: { baseId: 'pull-up', chainId: 'vertical-pull' },
    reason: 'assisted-pull-up is vertical-pull; legacy horizontal-pull chain is incorrect',
    approvedBy: 'content_owner_2026',
  },
  // ... etc, one entry per known curated mismatch
];
```

### 6.9 Should repair update records or runtime canonicalize only?

**Runtime canonicalize only in V1 follow-up.** Add the remap to `CleanAppDataView` so engines see correct chain ids without rewriting `AppData.history`. This:

- preserves the original record (no data destruction);
- is reversible (delete a remap entry → engines see original chain again);
- does not break PR/e1RM (already keyed by `actualExerciseId`, not chain);
- satisfies the `"no destructive identity rewrite"` rule in [DATA_REPAIR_POLICY.md §"Anti-patterns"](DATA_REPAIR_POLICY.md).

Persisted rewrite is gated on a separate "Exercise Identity Migration V1" task that requires manual content review and a regression fixture for every member of every chain.

### 6.10 What are the risks of rewriting exercise identity?

- **PR history breakage.** If a future engine ever switches from `actualExerciseId` to `baseId` as pool key (currently it does not, but the prescription / programming engines do group by `baseId`), rewriting `baseId` historically would silently move PR data between pools.
- **Audit trail loss.** The original `baseId='barbell-row'` is evidence that the record was written by a buggy code path; deleting it loses diagnostic value.
- **Cloud sync conflict.** Rewriting historical records changes `appDataHash` and triggers a sync conflict on every device that has the old snapshot.

These risks are why runtime canonicalization is the V1 follow-up choice. Persisted rewrite is V3-or-later.

## 7. duplicateSetId diagnosis

### 7.1 Are set IDs intended to be unique only within exercise/session or globally?

**Session-scoped.** The addressing tuple `(sessionId, exerciseId, setId)` is the contract — every API and engine path scopes by `sessionId` first. There is no design document, code comment, or test that mandates global uniqueness. The duplicate-across-sessions shape (`lat-pulldown-1`, `lat-pulldown-2`) is consistent with a session-local generator that resets per session.

### 7.2 Which code assumes global uniqueness?

A grep across `src/` and `apps/api/` finds **no** consumer that joins on `set.id` across sessions. All consumers either:

- scope by sessionId before resolving setId (record edit, history mutation API);
- use `set.id || index` for React keys (session-scoped renders);
- match by regex `/^main:.*:warmup:/` on the id text for warmup-detection — works regardless of duplicates.

### 7.3 Which code only needs session-scoped uniqueness?

All current consumers:

- `sessionEditEngine.matchesSet` (line 340-341) — session-scoped + index fallback.
- `apps/api/src/recordDataHealthMutation.ts:179` — scoped by sessionId.
- `focusModeStateEngine.ts:662,744` — active session only.
- `dataHealthEngine.ts:299,304,312,317,324,329,342,347,497,502,543,548,557,562` — issue id generated from `session.id + (set.id || setIndex)`, session-scoped.
- `dataHealthRepairEngine.ts:100,163` — repair id includes session/exercise/set with index fallback.

### 7.4 Which mutation paths target sets by ID?

Three:

1. **Record edit** (`updateSessionSet` via UI or API) — scoped to one session at a time, with index fallback.
2. **Set patch in active session** — keyed by `currentFocusStepId`, not `set.id` directly.
3. **Repair receipts** — `set.id` is only embedded in receipt text, not joined on.

### 7.5 Does cloud sync depend on set IDs?

**No.** Cloud sync uploads whole AppData snapshots and reconciles by `appDataHash` / `lastChangedAt`. No `set.id`-level diff or join exists in `src/cloudProduction/`, `src/cloudSync/`, or `src/sync/`.

### 7.6 Does record edit / data flag use set IDs?

Yes (record edit), with index fallback. Yes (data flag is session-level, not set-level — so set IDs are irrelevant).

### 7.7 Does Focus Mode use set IDs?

Yes, but only on the **active** session, where step IDs are derived from `(exerciseId, stepType, setIndex)` via `buildFocusStepQueue` ([focusModeStateEngine.ts](../src/engines/focusModeStateEngine.ts)). New active sessions always generate unique-within-session IDs. The duplicates in history are a write-once artifact, never accessed by focus mode after finalization.

### 7.8 Can derived `stableSetUid` solve this without rewriting historical IDs?

**Yes.** Proposed derivation:

```ts
// V1+ optional derivation, in clean view or per-call helper
export const stableSetUid = (sessionId: string, exerciseIndex: number, setIndex: number, setId?: string) =>
  `${sessionId}::${exerciseIndex}::${setIndex}::${setId || ''}`;
```

Any future consumer that needs a globally unique key uses `stableSetUid(...)` instead of `set.id` directly. Historical records are never rewritten. This is the **optional** task in [DATA_INTEGRITY_REMEDIATION_TASKS_V1.md](DATA_INTEGRITY_REMEDIATION_TASKS_V1.md) — only ship it if a real consumer needs it.

### 7.9 Is rewriting set IDs safe?

**No, do not rewrite.** Rewriting `set.id` historically would:

- break record-edit URLs / deep links that include `setId`;
- invalidate every repair receipt that captured the old `set.id`;
- change `appDataHash`, triggering cloud sync churn;
- destabilize React keys mid-render if the rewrite happens during a session view.

The honest fix is **never rewrite** + **derive new uniqueness on demand**.

### 7.10 What should future ID policy be?

- **Write path (`sessionBuilder`, `focusModeStateEngine`):** continue to write derived, session-scoped IDs (`main:${exerciseId}:warmup:0`, `main:${exerciseId}:working:0`, etc.). Keep this human-readable.
- **Read path:** if a consumer needs global uniqueness, derive via `stableSetUid(...)` and never trust `set.id` alone.
- **Static enforcement:** add a static guard test (in the optional V1 task) that `src/cloudProduction/`, `src/cloudSync/`, `src/sync/`, and any future export module **does not** key on `set.id` directly.

## 8. Data safety classification

| Issue | V1 layer | Persisted field? | Curated mapping? | Cloud upload impact | TrainingDecision impact | PR/e1RM impact |
|---|---|---|---|---|---|---|
| partialCompletion | Runtime Guard (derived `completionQuality`) | No (V1) — opt-in V2 schema bump | No | None (no mutation) | TD continues to detect partial via existing fields; derived field is a redundant convenience | None — PR/e1RM already filter incomplete sets |
| replacementEquivalence | Runtime Guard (curated canonicalization) | No (V1) — opt-in V3+ persistence | Yes (`src/data/replacementEquivalenceRemap.ts`) | None (no mutation) | TD reads canonical chain via CleanAppDataView; no behavior change for catalogue-correct records | None — PR/e1RM keyed by `actualExerciseId` |
| duplicateSetId | Audit Only + (optional) derived `stableSetUid` | No (ever) — historical IDs are immutable | No | None | None | None |

## 9. Runtime guard recommendations

Add three guards to `CleanAppDataView` in the follow-up tasks (NOT in this PR):

1. **`deriveCompletionQuality(session)`** — returns `'full' | 'partial' | 'aborted' | 'unknown'`, attached to a new `completionQualityBySessionId: Map<string, CompletionQuality>` field on the view.
2. **`canonicalizeExerciseIdentity(session)`** — for each exercise, if `(actualExerciseId, equivalenceChainId, baseId)` matches a curated remap entry, project the canonical `baseId` / `chainId` into the cleaned view. Original record unchanged. Diagnostics: `canonicalizedExerciseIds: string[]`.
3. **`stableSetUid(...)`** — pure helper, exported for ad-hoc consumer use. No view-level state needed.

The view stays pure projection — no AppData mutation, no I/O, no clock dependency.

## 10. Auto repair recommendations

| Repair name (proposed) | Layer | Action |
|---|---|---|
| `partialCompletionDerivedQualityV1` | Runtime Guard | derive `completionQuality` for every history session in CleanAppDataView |
| `replacementEquivalenceCanonicalV1` | Runtime Guard | apply curated remap to embedded chain / baseId in the cleaned view |
| `duplicateSetIdAuditV1` | Audit Only | detect duplicates, report via ledger; no rewrite |
| `partialCompletionPersistedQualityV2` | Safe Auto (after schema bump approval) | one-time backfill of `completionQuality` into history |
| `replacementEquivalenceRecordRewriteV3` | Safe Auto (after content-team approval) | rewrite embedded `baseId`/`equivalenceChainId` on history records |

**V1 ships only layers 1-3.** Layers 4-5 are explicitly out of scope and gated on a separate, approved follow-up PR.

## 11. Audit-only recommendations

Add `duplicateSetIdAuditV1` to the registry (in a follow-up task, not this PR). Detector:

```ts
// proposed in src/dataHealth/repairs/duplicateSetIdAuditV1.ts (follow-up only)
const collect = (history: TrainingSession[]) => {
  const occurrences = new Map<string, number>();
  history.forEach((session) =>
    (session.exercises || []).forEach((exercise) =>
      (Array.isArray(exercise.sets) ? exercise.sets : []).forEach((set) => {
        if (set.id) occurrences.set(set.id, (occurrences.get(set.id) || 0) + 1);
      }),
    ),
  );
  return [...occurrences.entries()].filter(([, count]) => count > 1);
};
```

Severity: `info` (no integrity risk, no PR/e1RM impact). Surfaces in the Data Health ledger only. The detector does not block cloud upload — it is informational.

## 12. Schema bump proposals if needed

| Bump | Driver | When |
|---|---|---|
| `TrainingSession.completionQuality?: 'full' \| 'partial' \| 'aborted'` | partialCompletion area | V2 — only after the V1 runtime-derived field has been live for at least one release and the user-visible Progress / Calendar badges are validated |
| `TrainingSession.completionQualityRule?: 'derived_v1' \| 'persisted_v2'` | provenance marker | bundled with the bump above |
| `TrainingSetLog.stableSetUid?: string` | duplicateSetId area | **never** — `stableSetUid` should remain derived, not persisted. Persisting would re-introduce the same uniqueness drift. |

The plan **does not** require any schema bump for replacementEquivalence — runtime canonicalization is sufficient indefinitely.

## 13. Curated remap table proposal

`src/data/replacementEquivalenceRemap.ts` (new file, follow-up only). Initial population from the V1 fixture:

| match.actualExerciseId | match.legacyChainId | canonical.baseId | canonical.chainId | reason |
|---|---|---|---|---|
| `assisted-pull-up` | `horizontal-pull` | `pull-up` | `vertical-pull` | catalogue says vertical-pull |
| `pull-up` | `horizontal-pull` | `pull-up` | `vertical-pull` | catalogue says vertical-pull |
| `chin-up` | `horizontal-pull` | `pull-up` | `vertical-pull` | catalogue says vertical-pull |
| `assisted-dip` | `fly` | `assisted-dip` | `vertical-push` | catalogue says vertical-push, not fly |
| `dip` | `fly` | `dip` | `vertical-push` | catalogue says vertical-push |
| `bench-dip` | `fly` | `dip` | `vertical-push` | catalogue says vertical-push |

Approval requirement: every row must be co-signed in the PR body by the content owner. **Do not** add a row without a citation to `EXERCISE_EQUIVALENCE_CHAINS` showing the canonical mapping.

## 14. Stable set UID proposal

Pure helper, no schema, no view state:

```ts
// Proposed: src/engines/stableSetUid.ts (only ship if a real consumer needs it)
export const stableSetUid = (
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  setId?: string,
): string => `${sessionId}::${exerciseIndex}::${setIndex}::${setId || ''}`;
```

Static guard test (only ship with the helper): any new analytics / export module under `src/cloudProduction/`, `src/cloudSync/`, `src/sync/` that joins set-level data must import `stableSetUid` instead of using `set.id` directly. The guard is opt-in — not enforced until a consumer ships.

## 15. Impact on TrainingDecision

| Area | TD reads today | TD reads after V1 follow-ups | Behavior change |
|---|---|---|---|
| partialCompletion | `session.earlyEndReason`, `exercise.completionStatus`, `set.completionStatus` (via `analysis.incompleteWorkingSets`) | same, plus optional `cleanView.completionQualityBySessionId.get(session.id)` for convenience | None — derived field is redundant with existing predicates |
| replacementEquivalence | `exercise.baseId`, `exercise.canonicalExerciseId`, `exercise.equivalenceChainId` (indirectly via prescription / programming engines) | same fields but resolved via CleanAppDataView's canonicalization | TD output for legacy-poisoned records changes from "wrong group" to "correct group". This is intentional. Regression fixture must cover both before and after. |
| duplicateSetId | Does not read `set.id` directly | Same | None |

## 16. Impact on PR / e1RM

| Area | PR/e1RM today | PR/e1RM after V1 follow-ups | Behavior change |
|---|---|---|---|
| partialCompletion | `completedSets` filter + `isWorkSet` filter | same | None — incomplete sets already excluded |
| replacementEquivalence | Pool by `actualExerciseId` (e1rmEngine) and `baseId\|id` (analytics PR aggregation) | Pool unchanged for `actualExerciseId`; canonicalization may change `baseId` → may shift `analytics.ts:457` grouping for poisoned records | A user's historical PR for `assisted-pull-up` (vertical pull) currently grouped under `baseId='barbell-row'` would re-bucket. This is a **correction**, not a regression. Acceptance test must show this explicitly. |
| duplicateSetId | None | None | None |

## 17. Impact on cloud / localStorage / sync

All three follow-up tasks are **runtime guards** or **audit-only**. No AppData mutation. No `appDataHash` change. No cloud upload churn. Upload eligibility ([CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md)) and subsequent upload ([CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md)) contracts unchanged.

**If** the V2 partial-completion schema bump is later approved, the one-time backfill becomes a safe-auto repair under the existing orchestrator and goes through the existing upload-eligibility gate. No new ingress path needed.

## 18. Recommended implementation order

1. **Partial Completion Quality V1** — runtime-derived `completionQuality` on CleanAppDataView. Lowest risk, no curation, no schema change. Unblocks Progress / Calendar badges immediately.
2. **Replacement Equivalence Curated Remap V1** — curated remap table + runtime canonicalization. Requires content review but no schema change.
3. **Duplicate Set ID Consumer Audit V1** — add `duplicateSetIdAuditV1` to registry (audit-only), formalize the per-consumer audit table.
4. **Optional: Stable Set UID V1** — only if a new consumer needs global uniqueness. Otherwise skip.
5. **Optional: Exercise Identity Migration V1** — persisted rewrite of historical `baseId`/`equivalenceChainId`. Gated on content team + product approval. **V3+ at earliest.**
6. **(Separate proposal)** Partial Completion Persisted Quality V2 schema bump.

Each task is a separate PR with its own validation gauntlet. Tasks 1-3 can ship in any order; tasks 4-6 are gated on tasks 1-3 plus explicit approvals.

## 19. Future task prompts or issue specs

See [DATA_INTEGRITY_REMEDIATION_TASKS_V1.md](DATA_INTEGRITY_REMEDIATION_TASKS_V1.md) for the per-task spec (scope / non-goals / files / safety / schema / tests / smoke / merge rules).

## 20. Tests required for each future task

| Task | Tests required |
|---|---|
| Partial Completion Quality V1 | (a) unit tests for `deriveCompletionQuality` over all branch (full, partial, aborted, unknown); (b) fixture-driven test using the V1 redacted fixture that exactly 2/10 sessions return `'partial'`; (c) static guard that `buildCleanAppDataView` exposes the new map; (d) regression test that TrainingDecision recommendation for the 2 partial fixture sessions still routes to `repeat_next_time`. |
| Replacement Equivalence Curated Remap V1 | (a) unit tests for every row in the remap table over the V1 fixture; (b) regression test that engines reading via CleanAppDataView see canonical chain ids; (c) static guard that the remap module is only imported by `cleanAppDataView.ts` (not by `e1rmEngine` or `analytics.ts` — those must stay keyed by `actualExerciseId`); (d) static guard that no `apply()` path in any repair rewrites `baseId` / `equivalenceChainId`. |
| Duplicate Set ID Consumer Audit V1 | (a) unit test for `duplicateSetIdAuditV1.detect` against the V1 fixture (≥1 duplicate); (b) ledger receipt parity test; (c) static guard that the registry contains `duplicateSetIdAuditV1`; (d) static guard that the audit's `apply()` returns `status='skipped'`. |
| Stable Set UID V1 (optional) | (a) pure unit test; (b) static guard that no `src/cloudProduction/` / `src/cloudSync/` / `src/sync/` file imports `stableSetUid` AND `set.id` at the same time (use one or the other). |
| Exercise Identity Migration V1 (optional, V3+) | (a) per-row regression fixture with every member of every chain; (b) PR/e1RM parity test that pool composition is unchanged; (c) cloud-upload parity test confirming the new `appDataHash` is uploaded exactly once. |

## 21. Remaining risks

- **Schema bump owner not yet identified.** The V2 `completionQuality` schema bump requires explicit owner sign-off; until then the runtime-derived value is the only surface. Risk: a future engineer "promotes" the derived field to a persisted field without going through the gate.  **Mitigation**: static doc test on this planning doc that the persisted variant is `(V2, owner approval required)`.
- **Content team availability for remap curation.** If the content team is slow to sign off on remap rows, V1 ships with a partial table. Risk: some poisoned chain records remain uncanonicalized.  **Mitigation**: audit-only fallback already in place; runtime canonicalization is opt-in per row.
- **Future global-uniqueness consumer.** A new analytics export may need globally unique set IDs.  **Mitigation**: derived `stableSetUid` available as a helper; no historical rewrite needed.
- **Cloud restore on a fresh device.** When a user restores from cloud, the V1 ingress pipeline ([appDataIngressPipeline.ts:processIncomingAppData](../src/dataHealth/appDataIngressPipeline.ts)) already runs the V1 repair set. The three follow-ups (runtime guard + audit) are pure and idempotent, so cloud restore will see the same derivations on every device.  **Mitigation**: confirmed by reading the pipeline; no additional risk.
- **TrainingDecision behavior shift for canonicalized records.** When the curated remap lands, TrainingDecision recommendations for the 9 poisoned exercises will shift from a "wrong group" rec to a "correct group" rec. Some users may have memorized the old (wrong) recommendation.  **Mitigation**: regression fixture + manual acceptance test in the Replacement Equivalence follow-up task explicitly captures the diff.

## 22. Final verdict

This planning doc is the gate between the V1 repair system and the next wave of data-health work. The verdict is:

- **Partial completion**: ship a derived `completionQuality` on CleanAppDataView in a follow-up task. Do not bump the schema. Do not rewrite history.
- **Replacement equivalence**: ship a curated remap + runtime canonicalization in a follow-up task. Do not rewrite history. Persistence is V3+.
- **Duplicate set IDs**: ship an audit-only repair + (optional) derived `stableSetUid`. **Never rewrite historical IDs.**

Implementation is BLOCKED until each follow-up task is individually approved. See [DATA_INTEGRITY_REMEDIATION_TASKS_V1.md](DATA_INTEGRITY_REMEDIATION_TASKS_V1.md) for the task specs.
