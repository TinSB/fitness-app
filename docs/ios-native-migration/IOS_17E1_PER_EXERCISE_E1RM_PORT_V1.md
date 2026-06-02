# iOS-17e-1 — Per-exercise e1RM engine port + function-level parity (V1)

**Track:** iOS-17e (engine consumption of performed sets) · **Slice 1 of 5**
**Status:** implemented · **Scope:** PURE engine logic + parity only — NOT wired into the decision output (that is 17e-5).

## What this slice does

Faithfully ports the per-exercise estimated-one-rep-max functions from
`src/engines/e1rmEngine.ts` to Swift (`IronPathTrainingDecision.E1RMEngine`,
`E1RMEngine.swift`) and parity-pins them **function-by-function** against goldens
GENERATED from the real TS engine.

Ported (line-by-line, each Swift symbol cites its TS source line):

- `getExerciseRecordPoolId` (e1rmEngine.ts:29) — the by-exercise record pool id
  (actual ?? replacement ?? canonical ?? (replacedFrom ? id : base ?? id), or `""`
  for an invalid identity).
- `estimateOneRepMaxForExercise` (e1rmEngine.ts:166).
- `buildE1RMProfile` (e1rmEngine.ts:171) — current (median_recent / single_recent)
  + best + recentValues + method.
- `getE1RMConfidence` (e1rmEngine.ts:137) — low / medium / high.

Plus every private helper they need (`roundToHalfKg` reproducing JS
`Math.round = floor(x+0.5)`, `parseRir`, `epley`, `isWorkSet`, `matchesExercise`,
`isCurrentQualityCandidate`, `median`, `nearestCandidate`, `buildEstimate`,
`collectCandidates`) and the cross-module dependencies they read:

- `engineUtils` — `number` / `isCompletedSet` / `isLegacyCompletedSet` /
  `setWeightKg` / `hasInvalidExerciseIdentityForStats` / `completedSets`.
- `sessionHistoryEngine` — `filterAnalyticsHistory` / `isAnalyticsSession`.
- `sessionBackfillToleranceEngine` — `checkSessionBackfill` (parses the session's
  OWN `date` / `startedAt` / `finishedAt` strings only — **`zero : Date`**, no clock).
- `replacementEngine.hasInvalidExerciseIdentity` — reuses the already-ported SR-2
  `ReplacementEngine.isSyntheticReplacementExerciseId` / `.validateReplacementExerciseId`
  (`isKnownExerciseId`).

`E1RMEngine` is PURE: it consumes a `[TrainingSession]` history (a §11 clean input)
+ an `exerciseId`; no IO, no clock, no randomness.

## Parity

`scripts/parityGoldensEntry.ts` gains `generateE1RMEngine`, producing **5 NEW**
`e1rm-engine/*` goldens under `tests/fixtures/parity/golden/`. Each golden echoes
the engineInput (history + exerciseId) and probe inputs verbatim and pins the REAL
TS outputs:

| fixture | covers |
| --- | --- |
| `progressive-overload-v1` | rising-weight history → `median_recent` current + high best |
| `plateau-stall-v1` | flat history → current == best |
| `insufficient-history-v1` | 1 session → `single_recent_low_confidence` forced-low current, medium best |
| `low-quality-filtered-v1` | poor technique / pain / reps>12 / rir>=4 low branches + `filterAnalyticsHistory` exclusion of a `dataFlag='test'` session AND a back-filled session |
| `pool-confidence-probes-v1` | every `getExerciseRecordPoolId` branch (5 valid + 4 invalid→`""`) + every `getE1RMConfidence` outcome (low×4 / medium / high); empty-history profile |

`E1RMEngineParityTests` (in `IronPathTrainingDecision`) decodes each golden, re-runs
the ported functions on the SAME inputs, and COMPUTE-ASSERTS the produced
`E1RMProfile` / estimate / pool-id / confidence equal the golden item-by-item.

## Invariants honored

- **Goldens are GENERATED, never hand-edited** (§22): `node scripts/generate-parity-goldens.mjs`.
- **No existing golden / engine output touched.** Regen reports
  `generated 32 fixture(s); 5 changed` — the 5 new goldens are `--diff-filter=A`
  (additive); the 27 pre-existing goldens (cold-start + iOS-4B0 + **17e-0** +
  SR-0…SR-2) are byte-identical (zero `--diff-filter=M`).
- **Not wired into the decision output.** This slice only ADDS the per-exercise
  e1RM functions + their goldens; `TrainingDecision` main output, the 17e-0
  decode-only scaffold, and the `TrainingDecisionE1RMTrend` GLOBAL-trend boolean are
  untouched. The compute-assert flip of the decision surface lands in 17e-5.
- **Pure engine, no write path:** no `CanonicalSessionWriter` / source-of-truth
  touch; `project.pbxproj` / `package.json` / lockfile byte-unchanged; zero `: Date`.
- **Count guards bumped 27→32** in sync (`parityFixturesContract`,
  `parityFixturesGenerationConsistency`, `iosBootstrapParityStillGreen`, the
  `iosLocal*` / `iosNative*` `--check` guards).

## Verification

```
node scripts/generate-parity-goldens.mjs        # generated 32 fixture(s); 5 changed
npm run typecheck
npx vitest run tests/ios tests/parity tests/parityFixturesContract.test.ts
swift test --package-path ios/packages/IronPathTrainingDecision
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```
