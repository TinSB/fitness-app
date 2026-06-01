# SR-0 — Smart Replacement Parity Scaffold V1

> **Status:** shipped. **Scope:** parity *pipeline* only — **no engine logic.**
> The Swift port of `buildSmartReplacementRecommendations` lands in **SR-1+**.

This is the first slice of the **Smart Replacement Engine** native-iOS
migration (SR-0…SR-4). It applies the same parity discipline the
TrainingDecision port used (iOS-4B0/4B1): **the TypeScript generator produces
goldens → the Swift package decodes and asserts them → goldens are never
hand-edited.** SR-0 builds that pipeline for the smart-replacement engine and
stops there; it ports none of the scoring / candidate / equivalence-chain
algorithm.

See also:

- `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` — canonical contract (§22
  parity goldens, §27 migration milestones). **Read/obey before any change.**
- `tests/fixtures/parity/README.md` — the parity contract + generator usage.
- `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md` — the parity
  fixture export design SR-0 reuses verbatim.

---

## 1. The engine under test (TS source of truth)

`src/engines/smartReplacementEngine.ts` exports
`buildSmartReplacementRecommendations(params): SmartReplacementRecommendation[]`.
Its output element shape (smartReplacementEngine.ts:22-31) is:

```ts
export type SmartReplacementPriority = 'primary' | 'secondary' | 'angle_variation' | 'avoid';

export type SmartReplacementRecommendation = {
  exerciseId: string;
  exerciseName: string;
  priority: SmartReplacementPriority;
  fatigueCost: 'low' | 'medium' | 'high';
  reason: string;
  warnings: string[];
};
```

Two properties make it an ideal parity target with **no extra machinery**:

1. **Clockless / deterministic** — the engine reads no `Date.now()` and no
   `Math.random()`; output depends only on the input `params` and the frozen
   exercise library (`src/data/exerciseLibrary.ts`). So the goldens are
   byte-stable across runs, and the fixtures use `generatedAtPolicy: "none"`
   (no deterministic clock is threaded, unlike the TrainingDecision fixtures).
2. **Library-driven** — candidates are seeded from
   `EXERCISE_KNOWLEDGE_OVERRIDES` + `EXERCISE_EQUIVALENCE_CHAINS`, so a bare
   `currentExercise` id already produces a rich, representative result.

---

## 2. Fixtures selected (4)

All four live under `tests/fixtures/parity/{inputs,golden}/smart-replacement/`
and carry a synthetic `SmartReplacementParams` payload under `params`. They were
chosen to exercise distinct engine branches while **collectively covering all
four `SmartReplacementPriority` values**.

| Fixture id | What it pins | Priority coverage (generated) |
| --- | --- | --- |
| `explicit-priority-spread-v1` | **Controlled anchor.** A `currentExercise` whose explicit `alternativePriorities` force `db-bench-press=primary`, `machine-chest-press=secondary`, `incline-db-press=angle_variation`, `cable-fly=avoid` — robust to library drift. | all 4 in one golden |
| `bench-press-natural-v1` | **Real-data path.** A bare `"bench-press"` id; candidates come purely from the committed library (override `alternativePriorities` + horizontal-press chain + similars). | all 4 |
| `low-readiness-fatigue-v1` | **Readiness branch.** A low `ReadinessResult` trips `hasHighFatigueSignal`, boosting low-fatigue squat alternatives (+reason), penalising high-fatigue ones (+warning), and applying the `fatigueRank` sort tiebreak. | all 4 |
| `pain-history-substitute-v1` | **Pain-history + load-feedback branch.** A completed session with a `painFlag` set on `pull-up` (→ `collectHistoryPainPatterns` substitute pattern) and a `too_heavy` `loadFeedback` on the current `lat-pulldown`. | all 4 |

The anchor fixture alone guarantees the 4-priority coverage even if the exercise
library changes later; the other three add real-branch coverage.

### Golden shape

Each golden wraps the engine's ordered output array with a small,
Swift-decodable summary (keys are canonical-sorted by the generator):

```jsonc
{
  "parityGolden": { /* shared envelope: sourceFixtureId, generatedFromCommit, generatorVersion … */ },
  "sourceFixtureId": "smart-replacement/<id>",
  "currentExerciseId": "<resolved current exercise id>",
  "recommendationCount": <n>,
  "priorityCounts": { "primary": …, "secondary": …, "angle_variation": …, "avoid": … },
  "recommendations": [ { "exerciseId", "exerciseName", "fatigueCost", "priority", "reason", "warnings" }, … ]
}
```

`priorityCounts` always carries all four keys (including zeros) so the Swift
mirror can assert coverage + count integrity without recomputing anything.

---

## 3. The parity pipeline

```
SmartReplacementParams (inputs/smart-replacement/*.json)
        │  scripts/parityGoldensEntry.ts → generateSmartReplacement()
        │      runs the REAL buildSmartReplacementRecommendations
        ▼
golden/smart-replacement/*.json   ← GENERATED, never hand-edited (§22)
        │
        ▼
IronPathTrainingDecision (Swift package, decode-only)
   • SmartReplacementGolden.swift  — Codable mirror of the OUTPUT shape
   • SmartReplacementGoldenDecodeTests.swift — decodes the committed goldens
     and asserts shape / count / priority coverage / enum resolvability
```

### TypeScript side

- `scripts/parityGoldensEntry.ts` gains a `generateSmartReplacement` generator
  (registered for the 4 new ids in `FIXTURE_IDS` + `GENERATORS`). It imports the
  **real** engine entrypoint — goldens are computed, never authored.
- Run via `node scripts/generate-parity-goldens.mjs`
  (`--check` = drift detector, `--list` = enumerate). No new npm dependency, no
  `package.json` change.
- The two parity contract guards were updated in sync for the new ids + count:
  `tests/parityFixturesContract.test.ts` (the exact-inventory assertion) and
  `tests/parity/parityFixturesGenerationConsistency.test.ts` (the
  `checked 18 fixture(s)` summary — 5 iOS-0 + 9 iOS-4B0 TrainingDecision + 4
  SR-0).

### Swift side

- `Sources/IronPathTrainingDecision/SmartReplacementGolden.swift` — a minimal
  **decode-only** `Codable`-style mirror: `SmartReplacementPriority` /
  `SmartReplacementFatigueCost` enums, `SmartReplacementRecommendation`, and the
  `SmartReplacementGolden` envelope. Stable string fields expose non-failing
  typed enum accessors; unknown future keys are preserved. It **computes
  nothing** and holds **zero `: Date`** (every field is `String`/`Int`/`Bool`/
  `[String]`/enum). New file → SPM auto-includes it; **`project.pbxproj` is not
  touched.**
- `Tests/IronPathTrainingDecisionTests/SmartReplacementGoldenDecodeTests.swift`
  — decodes the SAME committed goldens (via a `#filePath` walk-up, no copies)
  and asserts: discovery, decode, `recommendationCount == recommendations.count`,
  `priorityCounts` (all four keys + sums + agreement with a recount), enum
  resolvability, the anchor + the union covering all four priorities, the
  `parityGolden` envelope, unknown-key tolerance, and value stability.

---

## 4. What SR-0 deliberately does NOT do

- **No engine algorithm.** No scoring, candidate building, equivalence-chain
  traversal, pain/readiness/feedback handling, or equipment alignment in Swift.
  That is SR-1+.
- **No source-of-truth / write-path change.** No `AppData` read or mutate, no
  new persistence path. The Swift mirror is a pure value type.
- **No existing golden / engine-logic edit.** Only the 4 new
  `smart-replacement/*` goldens are added; the 14 pre-existing parity goldens
  regenerate byte-identically (`generated 18 fixture(s); 4 changed`).
- **No `project.pbxproj` / dependency / lockfile change.**

---

## 5. SR-1…SR-4 roadmap (proposed)

SR-0 fixes the acceptance bar; the engine is ported behind it in slices, each
re-using these goldens as the parity target (extend fixtures as new branches are
ported — never hand-edit a golden):

- **SR-1 — Action library port.** Port `EXERCISE_DISPLAY_NAMES`,
  `EXERCISE_EQUIVALENCE_CHAINS`, `EXERCISE_KNOWLEDGE_OVERRIDES`, and the id
  validators (`validateReplacementExerciseId` / `isSyntheticReplacementExerciseId`)
  into a Swift action-library leaf, with static guards that the Swift data
  matches the TS source.
- **SR-2 — Candidate building.** Port `buildBaseCandidates` (explicit
  alternatives, equivalence chain, shared-muscle/pattern similars) + the
  `mapExplicitPriority` mapping.
- **SR-3 — Context scoring + classification.** Port `applyContextScoring`
  (readiness / load-feedback / pain / training-level / equipment) and
  `priorityFromCandidate` / `reasonFromCandidate`; the goldens’ scores +
  priorities + reasons + warnings become the parity assertion.
- **SR-4 — Equipment alignment + ordering.** Port `alignWithEquipmentContext`
  and the final deterministic sort, and (if needed) add an equipment-unavailable
  fixture. At SR-4 the Swift engine reproduces the goldens end-to-end.

---

## 6. Verification (run after any TS or Swift edit in this area)

```sh
node scripts/generate-parity-goldens.mjs            # GEN — regenerate goldens (NEVER hand-edit)
node scripts/generate-parity-goldens.mjs --check    # drift detector (exit 1 on diff)
npm run typecheck
npx vitest run tests/parityFixturesContract.test.ts tests/parity
npx vitest run tests/ios                             # all iOS guards
swift test --package-path ios/packages/IronPathTrainingDecision
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

Goldens are **generated** (`node scripts/generate-parity-goldens.mjs`), never
hand-written or hand-edited (§22). If a regenerate appears to change a
pre-existing golden, **stop and escalate** — SR-0 only adds the
`smart-replacement/*` goldens.
