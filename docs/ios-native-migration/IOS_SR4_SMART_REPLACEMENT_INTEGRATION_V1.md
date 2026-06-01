# SR-4 — Smart Replacement Integration V1

> Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (read/obey first).
> This slice reuses the **§8.3** edit-write boundary (a new typed entry on the ONE
> `performGatedMutation` write path), adds a **§11** note (the smart-replacement engine
> now produces recommendations, fed clean-derived input), and amends **§27** with the
> SR-4 milestone row. It is the SR track's WRITE slice — the only one touching the
> source-of-truth write (§8.3), the engine boundary (§11), and the contract.

SR-4 is the integration that makes the ported smart-replacement engine actually take
effect in the app, closing the SR-0…SR-4 track:

- **SR-0** froze 4 `smart-replacement/*` parity goldens + a decode-only Swift mirror.
- **SR-1** ported the exercise-library DATA tables + pure parse functions.
- **SR-2** ported the underlying `replacementEngine` LOGIC + its knowledge subset.
- **SR-3** ported the top-level `buildSmartReplacementRecommendations` and fulfilled
  parity (compute-and-assert against the committed goldens).
- **SR-4 (this)** INTEGRATES: engine recommendations → "换动作" UI → a gated write of the
  user's chosen actual exercise → display attribution → restore. **It only CONSUMES the
  engine — no engine logic edit, no golden change.**

## Goal

Mirror the PWA "smart exercise replacement" behaviour natively:

1. **(a)** produce recommendations from the ported engine, fed input DERIVED FROM the
   DataHealth clean view (§10/§11);
2. **(b)+(c)** when the user picks one, write the user-override identity through the
   ONE sanctioned, DataHealth-gated write path;
3. **(d)** reflect the replacement in the UI — show the ACTUAL exercise, attribute the
   per-set results to it;
4. and make it **restorable**.

## Scope — what landed

### (a) Engine recommendations (read-only, clean-fed)

`FocusModeMvpState.replacementRecommendations(forSnapshot:exerciseId:)` reads canonical
AppData **read-only** through `processIncomingAppData` → its `cleanView` (§10), locates
the target exercise in the cleaned `history`, and calls the ported
`SmartReplacementEngine.buildSmartReplacementRecommendations(_:)` with a
`SmartReplacementParams` assembled **from the clean view** (the effective current exercise
id + a clean training-history pain signal mapped via `smartReplacementSession(from:)`).
The engine output is flattened into the app-presentation `ReplacementOptionRow` (name +
priority/fatigue labels + reason) so the thin detail view never imports the engine
package. The detail view renders the rows in the engine's order
(primary → secondary → angle_variation → avoid). **The engine and all parity goldens are
unchanged — SR-4 only consumes.**

### (b)+(c) The gated write (`换动作` / `复原`)

A new typed entry `CanonicalSessionWriter.updateExerciseReplacement(sessionId:exerciseId:replacementExerciseId:validate:)`
funnels through the SAME private `performGatedMutation` as every append/edit (§8 rule 4 —
NOT a second write path; exactly one `store.save`, pinned by the existing guard). The pure
nested open-bag candidate builders live in `IronPathDomain`:

- `ExercisePrescription.withReplacedIdentity(actualExerciseId:displayExerciseId:recordExerciseId:)`
  — a copy with ONLY those three fields replaced; everything else (the prescription body,
  the engine-opened `originalExerciseId`, the `_unknown` open bag) verbatim. Mirrors
  `withUpdatedSets`.
- `AppData.withUpdatedExerciseReplacement(sessionId:exerciseId:replacementExerciseId:)`
  — locates the session (`id == sessionId`) and exercise (`id`/`exerciseId == exerciseId`),
  applies the identity change, re-emits ONLY that session, rewrites ONLY the `history`
  key. Mirrors `withUpdatedHistorySet`.

**Identity semantics (the input-not-output red line):**

| Action | `actualExerciseId` | `displayExerciseId` | `recordExerciseId` | `originalExerciseId` | body / sets |
| --- | --- | --- | --- | --- | --- |
| APPLY (换动作 → newId) | newId | newId | newId | **untouched** | **untouched** |
| RESTORE (复原, nil) | cleared | cleared | cleared | **untouched** | **untouched** |

Only the THREE user-override identity fields are ever written. `originalExerciseId` is an
engine OUTPUT (opened by the engine/plan) and is NEVER written — on a native-logged
exercise it is simply nil, and the original stays locatable by the untouched
`id`/`exerciseId` (so the lookup key is STABLE across apply AND restore). RESTORE clears
the three to nil, so the record falls back to the original (mirroring the PWA
`actualExerciseId || replacementExerciseId || originalExerciseId || plannedId` precedence
in `src/engines/currentExerciseSelector.ts`).

The app layer's injected DataHealth gate (`FocusModeMvpState.swapExercise`) re-runs the
candidate through the SAME read-only ingress and accepts ONLY when the three identity
fields landed EXACTLY (apply → all == the replacement; restore → all cleared) AND the
exercise survives the clean view — confirmed safe because `stripLegacyAdviceFromExercise`
(the only clean-view transform that rebuilds an exercise) carries all four identity fields
forward verbatim. Backup→atomic→honest-fail; a present-but-unreadable document is never
overwritten; user-explicit two-step (nothing written until 保存 / 恢复原动作 is tapped).

### (d) UI reflects the replacement

`FocusModeMvpState.canonicalExerciseReplacementDisplay(for:)` resolves, per exercise from
the clean view, whether a replacement is recorded (`actualExerciseId` set AND ≠ the
original planned id) and the actual exercise's display name (via
`ExerciseLibrary.getExerciseNameEntry`). The saved-session detail row then shows the
ACTUAL exercise name with a `已换` marker + the original, and the per-set results below
read as attributed to it. This is canonical-first (the override lives in canonical
history, never the derived LocalSnapshot copy), so it shows persistently — mirroring the
DEEP-EDIT-1-display pattern.

## Honest "respects replacement" scope (V1 — no overstatement)

What ACTUALLY honors a recorded replacement today:

- **✅ Smart-replacement recommendations** — the engine's `collectHistoryPainPatterns`
  keys pain attribution off `actualExerciseId`, so a recorded replacement is reflected the
  next time it recommends.
- **✅ The SR-4 detail UI** — shows the actual exercise name and attributes its sets.

What is **NOT** honored in V1 (deferred, stated plainly so the doc does not exaggerate):

- **❌ The native e1RM trend** (`TrainingDecisionE1RMTrend`) is a GLOBAL top-set pool, not
  per-exercise, so a replacement does **not** change the trend signal.
- **❌ The unified 记录 timeline** (`CompletedTrainingTimeline`) still renders the stored
  exercise `name`, not the override.

Per-exercise e1RM attribution and timeline-name honoring are future work, not claimed by
SR-4. The write is faithful (the identity is recorded canonically and survives re-clean);
only the breadth of downstream consumers that read it is V1-limited.

## Non-goals (hard boundaries respected)

- **No engine change.** `SmartReplacementEngine` / `ReplacementEngine` / `ExerciseLibrary`
  and ALL parity goldens are byte-unchanged; SR-4 only consumes them.
- **No second write path.** One `performGatedMutation`, one `store.save` per action.
- **No engine OUTPUT written.** `originalExerciseId`, the prescription body, the performed
  `sets`, the `mesocyclePlan` weeks blob, and any computed phase/readiness/e1RM are never
  touched (input-not-output).
- **No raw AppData to the engine** (§11): params are assembled from the clean view.
- **No schema bump; open-bag/ISO-timestamp fidelity at every nesting level.**
- **Zero `: Date`**; device-local; not a restore (§13/§14).
- **`project.pbxproj` / `Package.swift` / lockfiles untouched** — the new Domain file is
  SPM-auto-included; the app already links `IronPathTrainingDecision`; the UI is inlined
  in existing app files.

## Files

| File | Change |
| --- | --- |
| `ios/packages/IronPathDomain/Sources/IronPathDomain/ExerciseReplacementEdit.swift` | NEW — pure `ExercisePrescription.withReplacedIdentity` + `AppData.withUpdatedExerciseReplacement`. |
| `ios/packages/IronPathDomain/Tests/IronPathDomainTests/ExerciseReplacementEditTests.swift` | NEW — open-bag / identity / restore / apply→restore byte-identical / no-op / value-semantics. |
| `ios/packages/IronPathPersistence/Sources/IronPathPersistence/CanonicalSessionWriter.swift` | `updateExerciseReplacement` typed entry (funnels `performGatedMutation`) + header note. |
| `ios/packages/IronPathPersistence/Tests/IronPathPersistenceTests/CanonicalSessionWriterTests.swift` | SR-4 cases (gated write / single save / preservation / restore / honest failures / real-store). |
| `ios/IronPath/FocusModeMvpState.swift` | `replacementRecommendations` / `swapExercise` / `canonicalExerciseReplacementDisplay` + helpers + presentation types. |
| `ios/IronPath/FocusSavedSessionDetailView.swift` | actual-exercise heading + two-step swap panel (recommendations + 保存/恢复原动作). |
| `ios/IronPath/FocusSavedSessionHistoryView.swift` | wires the three SR-4 callbacks to `FocusModeMvpState`. |
| `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` | §8.3 SR-4 note, §11 SR-4 note (honest scope), §27 SR-4 row. |

## Verification

- Goldens regenerated → **zero drift, zero additions** (the engine was only consumed).
- `npx vitest run tests/ios` — all iOS guards green (single `store.save`, persistence has
  no bare `AppData(`/`buildCleanAppDataView(`, model has zero `: Date`, saved-session UI).
- `swift test --package-path ios/packages/IronPathDomain` — `ExerciseReplacementEditTests`.
- `swift test --package-path ios/packages/IronPathPersistence` — SR-4 writer cases.
- `swift test --package-path ios/packages/IronPathTrainingDecision` — engine parity intact.
- `xcodebuild … -scheme IronPath … build` — the app compiles with the SR-4 UI.
