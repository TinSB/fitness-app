# SR-3 — Smart Replacement Engine Port + Parity Fulfillment V1

> Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (read/obey first).
> This slice is allowed-change-pattern **§19.2** (extend an active package with new
> pure logic, parity-pinned) and amends **§27** with the SR-3 milestone row.

SR-3 is the third (and top) layer of the smart-replacement port track:

- **SR-0** froze 4 `smart-replacement/*` parity goldens + a **decode-only** Swift
  mirror (`SmartReplacementGolden`/`SmartReplacementRecommendation`).
- **SR-1** ported the exercise-library DATA tables + pure parse functions.
- **SR-2** ported the underlying `replacementEngine` LOGIC + its engine-knowledge
  subset (`ReplacementEngine` / `ReplacementEngineKnowledge`).
- **SR-3 (this)** ports the TOP-LEVEL `buildSmartReplacementRecommendations` and
  **fulfills parity** — the SR-0 goldens are upgraded from decode-only to
  *the Swift engine computes the output and asserts it equals the golden*.

---

## Goal

Faithfully transcribe `buildSmartReplacementRecommendations` + every helper from
`src/engines/smartReplacementEngine.ts` into the `IronPathTrainingDecision`
package, **consuming** the SR-1/SR-2 ports (re-porting nothing they own), and turn
the 4 committed `smart-replacement/*` goldens into a computed-output parity lock:
Swift output `==` golden `recommendations`, item-by-item, in order.

---

## Scope — what was ported

`SmartReplacementEngine.swift` — the pure top-level engine + all helpers, mirrored
line-by-line with TS source-line citations:

- entry: `buildSmartReplacementRecommendations` (smartReplacementEngine.ts:470-525)
- candidate build: `buildBaseCandidates` (explicit-alternatives → priorityMap-avoid
  → equivalence-chain → shared-muscle/movement-pattern similar scan), `addCandidate`
  dedup (keep-higher-score / replace-`similar`)
- scoring: `applyContextScoring` (samePattern/sharedMuscle, readiness high-fatigue
  boost/penalty, `too_heavy` feedback, recent-candidate feedback, history pain
  match, beginner/unknown skill-demand penalty, equipment-preference nudge)
- resolution: `priorityFromCandidate`, `reasonFromCandidate`, the final sort
  (`priorityOrder` → `fatigueRank` when high-fatigue → `localeCompare(zh-Hans-CN)`),
  and `alignWithEquipmentContext` (re-sort + reason notes when `unavailableEquipment`)
- string/identity helpers: `normalizeKey`, `normalizeText`, `isChinese`,
  `getExerciseId`, `getOverride`, `mergeExercise`, `buildLibraryMap`,
  `getFatigueCost`, `getSkillDemand`, `getPrimaryMuscles`, `hasSharedMuscle`,
  `samePattern`, `chainForExercise`, `mapExplicitPriority`, `getEquipmentType`,
  `hasHighFatigueSignal`, `feedbackValuesFromInput`, `collectRecentExerciseFeedback`,
  `collectHistoryPainPatterns`, `painMatchesExercise`, `appendReason`

`SmartReplacementKnowledge.swift` — ports **only the ADDITIONAL**
`EXERCISE_KNOWLEDGE_OVERRIDES` fields the smart engine reads that SR-2 left out:
`movementPattern` / `primaryMuscles` / `skillDemand` / `kind` / `contraindications`
(63 ids, exact TS source order). The fatigueCost / equivalenceChainId /
alternativeIds / alternativePriorities slice + the equivalence chains are
**consumed from SR-2 `ReplacementEngineKnowledge`** — not re-ported.

### Faithfulness notes

- **Pinyin collation.** The final sort tiebreak is
  `left.exerciseName.localeCompare(right.exerciseName, 'zh-Hans-CN')` — a Chinese
  pinyin order. It is reproduced via Foundation's ICU locale-aware compare with
  `Locale("zh-Hans-CN")`. The 60-odd display names are unique, so the comparator
  never reports two distinct rows as equal. *(This is the one piece of behavior
  with cross-runtime collation risk; the 4 parity goldens pin it exactly.)*
- **Stable sort.** JS `Array.prototype.sort` is stable; Swift `sorted(by:)` is not,
  so both sorts go through a `stableSorted` helper that breaks comparator ties on
  the pre-sort index (only observable in the unavailable-equipment realignment).
- **`Map` semantics.** `new Map()` preserves insertion order and `Map.set` on an
  existing key keeps its slot — reproduced by an `InsertionOrderedMap`.
- **`mergeExercise` spread order.** `{ id, name: DISPLAY[id] || source.name,
  ...override, ...source }` — the source (current-exercise / library-item) object
  overlays the override, so e.g. an explicit `alternativeIds`/`alternativePriorities`
  on the current exercise wins (the explicit-priority-spread fixture).
- **Output type.** The engine emits the SR-0 `SmartReplacementRecommendation`
  (priority/fatigueCost stored as TS raw-value strings) via a same-module producing
  initializer added in an extension — the SR-0 `SmartReplacementGolden.swift` is
  left byte-identical, and `Equatable` drives the item-by-item parity assertion.

---

## Non-goals (hard boundaries)

- **No write path.** `applyExerciseReplacement` / `restoreOriginalExercise` (the
  session-mutating functions) are NOT ported — that is SR-4 integration.
- **No re-porting.** SR-1 `ExerciseLibrary` + SR-2 `ReplacementEngine` /
  `ReplacementEngineKnowledge` are consumed, not duplicated.
- **No new fixtures, no golden edits.** The 4 existing `smart-replacement/*`
  goldens (and all 24 parity goldens) are byte-unchanged; the parity count guards
  are NOT bumped (still 24). Goldens remain generator-produced (§22).
- **No TS / generator / source-of-truth / `project.pbxproj` / deps changes.** Pure
  Swift additions only; zero `: Date`, no IO, no clock, no randomness.

---

## Parity mechanism (fulfillment)

The smart-replacement golden does NOT echo its `engineInput` (unlike the
replacement-engine goldens), and existing goldens must not be modified — so the
engine input is read from the committed **INPUT** fixture's `params`
(`tests/fixtures/parity/inputs/smart-replacement/*.json`), the SAME object the TS
generator's `generateSmartReplacement` feeds `buildSmartReplacementRecommendations`.

`SmartReplacementEngineParityTests` for each of the 4 fixtures:

1. decode the INPUT `params` into the typed `SmartReplacementParams`,
2. run the ported `SmartReplacementEngine.buildSmartReplacementRecommendations`,
3. decode the committed golden,
4. assert `actual == golden.recommendations` (exerciseId order, count, every field
   item-by-item, then whole-array), and re-derive `currentExerciseId` +
   `priorityCounts` to cross-check the golden's echoed summary.

The fixtures collectively exercise: explicit alternativeIds/priorities (all four
priorities), the natural library-seeded path, the readiness high-fatigue branch
(+ fatigue-rank tiebreak), and the history-derived pain + `too_heavy` feedback
branch — all asserted to EXACT equality. The SR-0 decode tests are retained.

---

## Files

- `ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision/SmartReplacementEngine.swift` (new)
- `ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision/SmartReplacementKnowledge.swift` (new)
- `ios/packages/IronPathTrainingDecision/Tests/IronPathTrainingDecisionTests/SmartReplacementEngineParityTests.swift` (new)
- `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§27 SR-3 row)
- `docs/ios-native-migration/IOS_SR3_SMART_REPLACEMENT_ENGINE_PORT_V1.md` (this doc)

All three Swift files are SPM-auto-included; `project.pbxproj` is untouched.

---

## Verification

- `npm run typecheck` — `EXIT=0` (no TS changed).
- `npx vitest run tests/ios` — `EXIT=0` (iOS guard suite; parity count guards stay
  green, fixtures byte-unchanged).
- `swift test --package-path ios/packages/IronPathTrainingDecision` — `EXIT=0`,
  incl. the 4-fixture `SmartReplacementEngineParityTests` computed-output lock
  (parity fulfilled) and the retained SR-0 decode tests.
- `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` — `BUILD SUCCEEDED`.
- `git diff --diff-filter=M -- tests/fixtures/parity/golden/` — empty (zero golden
  drift); `package.json` / `package-lock.json` byte-unchanged; `git diff --check` clean.

**Source-of-truth impact: none** (no write path; §8/§11 semantics unchanged — §11
smartReplacement output is now parity-reproduced by Swift). **Data-safety impact: none.**
