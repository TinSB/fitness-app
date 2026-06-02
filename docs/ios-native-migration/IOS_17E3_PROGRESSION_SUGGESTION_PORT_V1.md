# iOS-17e-3 — progressionRulesEngine progressive-suggestion port + function-level parity (V1)

**Track:** iOS-17e (engine consumption of performed sets) · **Slice 3 of 5**
**Status:** implemented · **Scope:** PURE engine logic + parity only — NOT wired into the decision output (that is 17e-5).

## What this slice does

Faithfully ports the progressive-suggestion functions from
`src/engines/progressionRulesEngine.ts` to Swift
(`IronPathTrainingDecision.ProgressionRulesEngine`, `ProgressionRulesEngine.swift`)
and parity-pins them **function-by-function** against goldens GENERATED from the
real TS engine.

Ported (line-by-line, each Swift symbol cites its TS source line):

- `makeSuggestion` (progressionRulesEngine.ts:139) — the full progressive-suggestion
  decision tree: first-session baseline, hit-ceiling → add, hold, volume-drop /
  technique-streak / too-hard backoff, conservativeBias clamps, and the note chain.
- `shouldUseTopBackoff` (progressionRulesEngine.ts:271) — compound|machine ∧ sets≥3 ∧
  startWeight≥30.
- `buildSetPrescription` (progressionRulesEngine.ts:274) — the non-topBackoff working-set
  path and the top+backoff path, with the conservative / adaptiveTopSetFactor /
  adaptiveBackoffFactor / fatigueCost branches and the `保守版` summary flag.

Plus every private helper they read (`averageRir`, `qualityRank`,
`averageTechniqueQuality`, `hitRepCeiling`, `firstSetBelowFloor`, `rirAllowsProgress`,
`roundToUnit` / `roundLoad` reproducing JS `Math.round = floor(x+0.5)`,
`progressionIncrement`, `summarizeRir`, `summarizeTechnique`,
`recentPoorTechniqueCount`, `applyFineTuneIfDataRich`) and the `Suggestion` /
`ExerciseForProgression` types.

Reuse (does **NOT** re-port):

- `AdaptiveFeedbackEngine.findRecentPerformances` / `findPreviousPerformance` +
  `PerformanceSnapshot` (17e-2) — the history lookups `makeSuggestion` consumes.
- `E1RMEngine.number` / `setWeightKg` (17e-1) — the set-math helpers (`setVolume`,
  `number`), so semantics stay identical across engines.

`ProgressionRulesEngine` is PURE: it consumes a `templateExercise` +
`[TrainingSession]` history (a §11 clean input); no IO, no clock, no randomness.

## The one deferral — fineTune is golden-neutral (`zero : Date`)

`makeSuggestion` calls `buildSetWeightFineTune` (`setWeightFineTuneEngine.ts`)
**without an `asOfDate`**, so the TS reads the **wall clock**
(`setWeightFineTuneEngine.ts:119`) — that function is not pure. `setWeightFineTuneEngine`
is **NOT ported in this slice**. Instead, every 17e-3 parity fixture anchors its
history far in the past (an old `deterministicClockIso`) so the live 8-week window is
always empty: the TS `fineTune` returns the `insufficient_history` fallback
(`suggestedWeightKg` 0) and `applyFineTuneIfDataRich` (progressionRulesEngine.ts:88) is
a no-op → the engine output is **exactly the legacy decision-tree baseline**, and the
golden is byte-deterministic regardless of when it is generated.

The Swift port reproduces that fallback verbatim (the `applyFineTuneIfDataRich` gate is
ported in full; the live projection is fed the `insufficient_history` fallback), keeping
the port PURE with **zero `: Date`**. The live e1RM-trend projection ports in a later
slice. This mirrors the prescription-port precedent
(`TrainingDecisionExercisePrescription.swift:16-21`, "no mature fineTune data; documented
golden-neutral … fineTune trust override"). Each golden echoes a `fineTuneNeutrality`
field and the parity test ASSERTS its `fallbackReason == "insufficient_history"`, pinning
the deferral premise per fixture.

## Parity

`scripts/parityGoldensEntry.ts` gains `generateProgression`, producing **6 NEW**
`progression-suggestion/*` goldens under `tests/fixtures/parity/golden/`. Each golden
echoes the engineInput (templateExercise + history) verbatim and pins the REAL TS
outputs (`suggestion` + `shouldUseTopBackoff` + `setPrescription` + `fineTuneNeutrality`):

| fixture | covers |
| --- | --- |
| `no-history-baseline-v1` | empty history → first-session baseline + conservativeBias + isolation(repMax≥20) rangeNote; non-topBackoff conservative `保守版` prescription; `shouldUseTopBackoff` boundary probes + `buildSetPrescription` adaptiveTopSetFactor<1 / fatigueCost=high / adaptiveBackoffFactor<0.92 probes |
| `increase-double-top-v1` | two sessions both hit repMax → `shouldAdd` → +increment(2.5), reps=repMin, '连续两次打满上限'; non-conservative top+backoff |
| `hold-stable-v1` | reps below ceiling, no drop → hold at lastWeight, reps=repMax, default '稳定推进' note |
| `backoff-volume-drop-v1` | newest volume < 90% previous → `dropped` backoff, '最近表现回落' |
| `backoff-technique-streak-v1` | two newest sessions poor technique → `techniqueSuggestsBackoff`, '最近两次动作质量都偏差' + regression + replacement hints + '/ 技术较差' summary |
| `top-backoff-compound-v1` | conservativeTopSet vetoes add → conservative hold ('已经打到过一次上限'); conservative high-fatigue top+backoff prescription (backoff drop 0.86, `保守版`) |

`ProgressionRulesEngineParityTests` (in `IronPathTrainingDecision`) decodes each golden,
re-runs the ported functions on the SAME inputs, and COMPUTE-ASSERTS the produced
`Suggestion` (weight/reps/lastSummary/targetSummary/note) + `shouldUseTopBackoff` +
`SetPrescription` (top/backoff weight+reps+summary) equal the golden item-by-item, plus
the `fineTuneNeutrality` deferral assertion.

## Invariants honored

- **Goldens are GENERATED, never hand-edited** (§22): `node scripts/generate-parity-goldens.mjs`.
- **No existing golden / engine output touched.** Regen reports
  `checked 42 fixture(s); 0 changed` — the 6 new goldens are `--diff-filter=A`
  (additive); the 36 pre-existing goldens (cold-start + iOS-4B0 + **17e-0** + SR-0…SR-2 +
  **17e-1** e1rm + **17e-2** adaptive-feedback) are byte-identical (zero `--diff-filter=M`).
- **Not wired into the decision output.** This slice only ADDS the progressive-suggestion
  functions + their goldens; `TrainingDecision` main output, the 17e-0 decode-only
  scaffold, and the `TrainingDecisionE1RMTrend` GLOBAL-trend boolean are untouched. The
  compute-assert flip of the decision surface lands in 17e-5.
- **Pure engine, no write path:** no `CanonicalSessionWriter` / source-of-truth touch;
  `project.pbxproj` / `package.json` / lockfile byte-unchanged; zero `: Date`.
- **Count guards bumped 36→42** in sync (`parityFixturesContract`,
  `parityFixturesGenerationConsistency`, `iosBootstrapParityStillGreen`, the
  `iosLocal*` / `iosNative*` `--check` guards).

## Verification

```
node scripts/generate-parity-goldens.mjs --check  # checked 42 fixture(s); 0 changed
npm run typecheck
npx vitest run
swift test --package-path ios/packages/IronPathTrainingDecision
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```
