# PA-S0 — i18n/terms Data Port + Data Parity V1

**Baseline commit:** `84a3b4b` — *AN-9 订正 AN-8 的 Swift sort 稳定性事实错误(纯文档/注释) (#475)*
**Track:** Plan-Adaptive (PA) migration. PA-S0 is the track's first ground-leaf: `src/i18n/terms.ts` — the **one clean leaf** (zero imports, zero runtime logic, pure `as const` label data). It provides the Chinese-label base for the later S4 formatters / PA engine ports.
**Goal:** Faithfully port all **eleven** label tables + `term()` from `src/i18n/terms.ts` to Swift (`IronPathL10n`, no new package dependency), and mechanically reconcile the Swift data against a GENERATED "terms snapshot" golden so every entry is provably identical to TS — nothing dropped, no Chinese value altered.

## Scope

**In (ported):** the 11 frozen tables, each transcribed entry-by-entry (key + Chinese value verbatim, mirrored TS line cited), plus `term()`:
- `TERMS` (`terms.ts:1`, **24**), `PHASE_LABELS` (`:28`, **4**), `EFFECTIVE_PHASE_DISPLAY_LABELS` (`:38`, **6**), `INTENSITY_BIAS_LABELS` (`:47`, **3**), `TECHNIQUE_QUALITY_LABELS` (`:53`, **3**), `SUPPORT_BLOCK_LABELS` (`:59`, **2**), `SKIP_REASON_LABELS` (`:64`, **7**), `DELOAD_LEVEL_LABELS` (`:74`, **4**), `DELOAD_STRATEGY_LABELS` (`:81`, **4**), `READINESS_ADJUSTMENT_LABELS` (`:88`, **4**), `MUSCLE_LABELS` (`:95`, **5**).
- `term(key)` (`:103`) = `TERMS[key]`. TS types the parameter `keyof typeof TERMS` (unknown key = compile error, result always `string`); the faithful Swift equivalent returns `String?` — `nil` exactly for a key absent from `TERMS`.

**Out (later slices):** `src/i18n/formatters.ts` (S4), the PA engines. PURE DATA only — no logic beyond a dictionary subscript, **zero `: Date`**, no IO, no UI.

## Muscle-label de-dup (no re-port; relationship documented, not merged)

There are **two distinct** `MUSCLE_LABELS` constants in TS:
- `terms.ts:95` `MUSCLE_LABELS` — **5** entries (`chest/back/legs/shoulders/arms` → `胸/背/腿/肩/手臂`). **Ported here.**
- `formatters.ts:102` `MUSCLE_LABELS` — **18** entries (adds `lats/quads/hamstrings/glutes/delts/triceps/biceps/calves/core` + CJK self-maps). Already ported into `IronPathTrainingDecision.VolumeAdaptationEngine.muscleLabels` (its comment cites `formatters.ts:219/102`).

They share the 5 Chinese values but have **different key universes** and live in different source files — they are **NOT merged** in this slice. PA-S0 ports `terms.ts` in full, faithfully and in isolation; the S4 `i18n/formatters` port consolidates the shared muscle vocabulary. (Per the red line: same-VALUE overlap, but NOT same-source — so the terms constant is ported verbatim and the relationship is noted here, not collapsed.)

## What landed

- `ios/packages/IronPathL10n/Sources/IronPathL10n/Terms.swift` — pure `enum Terms` with 11 `[String: String]` static tables + `term(_:) -> String?`. Each entry cites its mirrored `terms.ts` line; zero `: Date`, no logic, no IO. Ordering is irrelevant (each `term()`/label is a direct key lookup — no first-match-wins semantics, unlike SR-1's ExerciseLibrary), so plain dictionaries are faithful.
- `ios/packages/IronPathL10n/Tests/IronPathL10nTests/TermsParityTests.swift` — 6 tests: golden discovery + envelope, table-universe equality, **item-by-item** table reconciliation (every key + Chinese value), per-table + total counts, `term()` probe reconciliation over the full TERMS key set, and `term()` known/unknown-key behaviour. Foundation-only (`JSONSerialization`) golden loader via a `#filePath` walk-up — **no IronPathDomain dependency**, so it fits `IronPathL10nTests` as-is.

Both files are **SPM-auto-included** — `IronPathL10n/Package.swift` (and every other `Package.swift`) untouched, `project.pbxproj` untouched, no new package dependency.

## Parity mechanism (goldens are GENERATED, never hand-edited — §22)

- `scripts/parityGoldensEntry.ts` gains `generateI18nTermsSnapshot`, registered as fixture id `i18n/terms-snapshot-v1` (input fixture carries only a `parityMeta` envelope — no params, `generatedAtPolicy: "none"`, the `exercise-library/library-snapshot-v1` precedent). It imports the REAL TS tables + `term` and dumps `tables.<NAME>` (each table verbatim) + per-table `counts` + `termProbes` (every TERMS key routed through `term()`).
- Generation command: `node scripts/generate-parity-goldens.mjs` (drift check: `--check`).
- The Swift port and the golden are **two independent transcription paths** (Swift tables transcribed from the TS source; golden dumped from the real TS import). `TermsParityTests` asserting equality entry-by-entry is a genuine cross-check and a permanent regression lock against future Chinese-label drift.

## Validation (all green, from real output)

| Gate | Command | Result |
| --- | --- | --- |
| Goldens | `node scripts/generate-parity-goldens.mjs` | `generated 75 fixture(s); 1 changed` (only the new golden); existing 74 byte-identical |
| Drift | `node scripts/generate-parity-goldens.mjs --check` | `checked 75 fixture(s); 0 changed` (exit 0) |
| TypeScript | `npm run typecheck` | exit 0 |
| Full vitest | `npx vitest run` | 1373 files / **7331** tests pass |
| Swift | `swift test --package-path ios/packages/IronPathL10n` | **7** tests pass (incl. 6 new `TermsParityTests`) |
| App build | `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` | `** BUILD SUCCEEDED **` |

`git diff --check` clean; `package.json` / `package-lock.json` / `project.pbxproj` / every `Package.swift` / `.claude/` unchanged. New parity files added under `--diff-filter=A` only (no existing golden modified — zero drift).

## Count guards bumped in sync (74 → 75)

`parityFixturesContract` (own `FIXTURE_IDS` list + inventory title), `parityFixturesGenerationConsistency` (`checked 75` + breakdown comment), `iosBootstrapParityStillGreen`, and the `--check` count assertions in the ten `iosLocal*` / `iosNative*` static-guard suites.

## Contract impact

- **§19.2** — extends an active package (`IronPathL10n`) with new pure data + parity coverage. **§27** — one milestone row added.
- **Source-of-truth (§8) impact: none** — no write path, no AppData, no engine logic.
- **Engine output (§11) impact: none** — terms is pure label data; no TrainingDecision / analytics output changes.
- **Data-safety impact: none** — pure value data + a dictionary lookup; no schema, no IO, no clock.
