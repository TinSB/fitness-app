# SR-1 — Exercise Library Data Port + Data Parity V1

**Baseline commit:** `4e01527` — *SR-0 智能替换引擎 parity 脚手架 V1 (#450)*
**Track:** Smart Replacement engine migration (SR engine port). SR-1 ports **data + pure parse functions only**; the replacement engine itself is SR-2/SR-3.
**Goal:** Faithfully port the whole `src/data/exerciseLibrary.ts` library (display / english / equipment / alias tables) + its pure resolve/format functions to Swift (`IronPathTrainingDecision`), and mechanically reconcile the Swift data against a GENERATED "library snapshot" golden so every entry is provably identical to TS — nothing dropped, nothing altered.

## Scope

**In (ported):**
- Types: `ExerciseName` (`exerciseLibrary.ts:3`), `ExerciseEquipmentTag` (`:9`).
- Four frozen tables: `EXERCISE_DISPLAY_NAMES` (`:20`, **94**), `EXERCISE_EQUIPMENT_TAGS` (`:117`, **61**), `EXERCISE_ENGLISH_NAMES` (`:181`, **63**), `EXERCISE_ALIASES` (`:247`, **59**).
- `EXERCISE_KNOWLEDGE_OVERRIDES` **key set** (`:485`, **63** ids) — **keys ONLY**. Needed for `resolveExerciseReferenceToId`'s known-id fast path. The override VALUES (orderPriority / contraindications / alternativeIds / muscle data) are the engine knowledge base → **SR-2/SR-3, NOT ported**.
- Pure functions: `getExerciseNameEntry` (`:317`), `formatExerciseDisplayName` (`:323`, incl. the `hasChineseText` helper `:309` and the string/object input paths), `normalizeExerciseReference` (`:374`), `resolveExerciseReferenceToId` (`:381`), `mapLegacyAlternativeLabelsToIds` (`:398`). `warnMissingChineseName` (`:311`) is a DEV-only `console.warn` → a no-op in Swift.

**Out (explicitly NOT ported — SR-2/SR-3):**
- `EXERCISE_EQUIVALENCE_CHAINS` (`:420`), `EXERCISE_KNOWLEDGE_OVERRIDES` VALUES (`:485`), `makeExercise` (`:1500`), and `buildSmartReplacementRecommendations` (the engine).

## What landed

- `ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision/ExerciseLibrary.swift` — pure data + pure functions, zero `: Date`, no IO. Each table is an ordered `KeyValuePairs` (TS insertion order preserved) with a derived `[String: …]` lookup. Comments cite the mirrored TS source line on every member.
- `ios/packages/IronPathTrainingDecision/Tests/IronPathTrainingDecisionTests/ExerciseLibraryParityTests.swift` — 13 tests: golden discovery + envelope, **item-by-item** snapshot reconciliation (id universe / every field / array order), equipment-tag enum resolvability, override-id-set equality, count cross-check, and representative parse-function unit tests vs TS behaviour (hit / alias / english-value / case / parenthetical / unknown / **collision** / object-input / dedup).

Both files are **SPM-auto-included** — `project.pbxproj` untouched.

## Parity mechanism (goldens are GENERATED, never hand-edited — §22)

- `scripts/parityGoldensEntry.ts` gains `generateExerciseLibrarySnapshot`, registered as fixture id `exercise-library/library-snapshot-v1`. It imports the REAL TS tables and dumps `id→{displayName?,englishName?,equipmentTags?,aliases?}` (absent fields omitted) + a sorted `knowledgeOverrideIds` key set + `counts`.
- Generation command: `node scripts/generate-parity-goldens.mjs` (drift check: `--check`).
- The Swift port and the golden are **two independent transcription paths** (the Swift tables were transcribed from the TS source; the golden is dumped from the real TS import). `ExerciseLibraryParityTests` asserting they are equal item-by-item is therefore a genuine cross-check, and a permanent regression lock against future drift.

### Two faithfulness details

1. **Ordered iteration.** `resolveExerciseReferenceToId` returns the FIRST id whose normalized id/label/alias matches, in TS `Object.entries` (insertion) order. The data has real collisions — `face-pull` & `face_pull` both normalize to `面拉`/`facepull`; `landmine-press` & `landmine_press` both to `地雷管推举`/`landminepress`. A Swift `Dictionary` is unordered, so the ordered `KeyValuePairs` are the source of truth for resolve(); a unit test pins `resolve("面拉") == "face-pull"`.
2. **Override-id redundancy.** Every one of the 63 `EXERCISE_KNOWLEDGE_OVERRIDES` keys is also an `EXERCISE_DISPLAY_NAMES` key, so the `|| EXERCISE_KNOWLEDGE_OVERRIDES[raw]` fast-path term changes no current outcome. It is transcribed verbatim anyway to keep resolve() byte-faithful, and a test asserts the redundancy invariant so a future TS override id that is NOT a display id would fail loudly.

## Validation (all green, from real output)

| Gate | Command | Result |
| --- | --- | --- |
| Goldens | `node scripts/generate-parity-goldens.mjs` | `generated 19 fixture(s); 1 changed` (only the new golden); existing 18 byte-identical (`git diff --diff-filter=M` on goldens empty = zero drift) |
| TypeScript | `npm run typecheck` | exit 0 |
| iOS guards | `npx vitest run tests/ios` | 40 files / **980** tests pass |
| Parity guards | `npx vitest run tests/parity tests/parityFixturesContract.test.ts tests/parityFixturesPrivacyGuard.test.ts` | 3 files / **147** tests pass |
| Swift | `swift test --package-path ios/packages/IronPathTrainingDecision` | **168** tests pass (incl. 13 new) |
| App build | `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` | `** BUILD SUCCEEDED **` |

`git diff --check` clean; `package.json` / `package-lock.json` / `project.pbxproj` / `.claude/` unchanged.

## Count guards bumped in sync (18 → 19)

`parityFixturesContract` (+ inventory), `parityFixturesGenerationConsistency`, `iosBootstrapParityStillGreen`, and the `--check` count assertions in the `iosLocal*`/`iosNative*` static-guard suites (+ a stale comment in `iosTrainingDecisionTypeSkeletonStaticGuards`).

## Contract impact

- **§19.2** — extends an active package (`IronPathTrainingDecision`) with new pure logic + parity coverage. **§27** — one milestone row added.
- **Source-of-truth (§8) impact: none** — no write path, no engine logic.
- **Engine output (§11) impact: none** — SR-1 changes no `smartReplacement` / TrainingDecision output; that is SR-3.
- **Data-safety impact: none** — pure value data + pure functions; no schema, no AppData, no IO.
