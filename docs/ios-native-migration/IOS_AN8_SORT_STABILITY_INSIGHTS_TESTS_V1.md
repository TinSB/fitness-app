# iOS AN-8 — sort-stability fix + insights read-path tests (V1)

Status: landed. Track: analytics/insights debt cleanup (post-AN-1…7). Kind: PURE faithfulness fix + test backfill — NO new engine, NO engine-output semantics change, NO write path. Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§11 clean inputs, §19.2 additive presentation/tests, §22 static-guard / generated-golden standard, §27 milestone registry — AN-8 row).

AN-8 closes two medium debts the analytics-track audit flagged in already-merged code. It changes no engine output, adds no capability, and touches no write path.

## Debt 1 — AN-3 sort stability (a provable-faithfulness gap)

### The gap
`AnalyticsDashboardEngine` mirrors `src/engines/analytics.ts`, whose sorts rely on JS `Array.prototype.sort` being **STABLE** (ES2019): equal-key elements keep insertion order. The Swift port used bare `Array.sort(by:)` in four places. Swift's `sort(by:)` is **NOT contractually stable** — the API explicitly does not promise it. One comment even asserted `stable (Swift ≥5)`, which is **factually wrong** (the language guarantees no such thing). So the port was passing by relying on an unspecified implementation detail — green, but not *provably* faithful.

### Honest scope note (verified, not assumed)
On the current toolchain (Apple Swift 6.3.2) `Array.sort` is **empirically stable** (a timsort-family implementation) — a 64-element all-equal-key probe keeps insertion order. Two consequences, both load-bearing for how this slice is framed:
1. Converting the four sorts to `stableSorted` is a **zero-behavioral-change** edit → **every existing golden regenerates byte-identically** (zero drift). This is *consistent with* the "existing goldens zero drift" red line and *confirms* no existing golden was passing by introsort coincidence.
2. A fixture in which a **bare** `.sort` visibly reorders ties **cannot be constructed** on this toolchain (the stdlib sort does not reorder ties). The gap closed here is therefore **CONTRACTUAL** (the unspecified stability), not an observed divergence. The new tie golden is **not** claimed to demonstrate reordering; it pins the JS insertion order so any future stdlib-stability change is caught, and the focused unit test proves the tie-break *rule* (not stdlib luck) determines the order.

This matches the existing repo precedent: `SmartReplacementEngine` / `PainPatternEngine` / `RecentPRDeltaEngine` already route their JS-stable sorts through a `stableSorted` (original-index tie-break) for exactly this reason.

### Changed (`AnalyticsDashboardEngine.swift`)
- Added an `internal static stableSorted<T>(_:_:)` — a stable sort driven by a JS-style three-way comparator (negative = left first) that breaks comparator ties on the **original index**, same shape as the SmartReplacement / PainPattern precedents. `internal` (not `private`) so the load-bearing test can assert the tie-break directly (the file's other helpers are already internal-testable).
- Routed **all four** dashboard sorts through it (the audit named three — `buildPrs:423`, `buildAdherenceReport:672`/`:685`; the fourth, `buildMuscleVolumeDashboard:264`, is the one that carried the false `stable (Swift ≥5)` comment, and the identical JS-stable-sort reasoning applies, so it was converted too — leaving it bare while "fixing" its comment would have documented an unfixed gap):
  - `buildMuscleVolumeDashboard` — `order[status] asc || remainingSets desc`.
  - `buildPrs` — `b.date.localeCompare(a.date)` descending date (equal-date PRs keep maxWeight → fixedReps → sessionTotals → estimatedMaxes insertion order).
  - `buildAdherenceReport` — `skippedExercises` and `skippedSupportExercises` count-desc.
- Corrected the false `stable (Swift ≥5)` comment and the other sort comments to state the contractual-stability reasoning accurately.

The comparators are reproduced verbatim (only the *stability guarantee* is added) — engine output is unchanged.

### Load-bearing tie golden
`analytics/adherence-report-tie-cases-v1` — **a NEW additive fixture** (per §22 / the repo's parity-guard convention: additive coverage is a new fixture file, never a modification of an existing golden, which the `--diff-filter=MD` guard would flag). Its single case has six exercises in one session, each with a single incomplete set (planned 1 > actual 0) → each skipped exactly once → a **pure count tie** (every count == 1). The reverse-alphabetical insertion order makes the pinned `skippedExercises` order `[skip-zulu, skip-yankee, skip-xray, skip-whiskey, skip-victor]` (the `skip-uniform` 6th member dropped by `slice(0,5)`) visibly **insertion-ordered, not id-sorted**. Generated from the REAL TS engine via `scripts/generate-parity-goldens.mjs` (`generateAdherenceReport`), never hand-edited. `74 fixtures generated; 1 changed` (the new golden) — every existing golden byte-identical.

Asserted by: `AnalyticsDashboardEngineParityTests.testBuildAdherenceReportTieCaseParity` (engine == golden + the explicit insertion-order property) and the focused `AnalyticsDashboardSortStabilityTests` (the `stableSorted` tie-break rule is load-bearing: the same comparator-equal block resolves differently under a reversed-index tie-break, and equal-skip-count rows keep insertion order through the slice cut).

## Debt 2 — AN-7 insights read path had zero tests

`TrainingInsightsReadPath.swift` (AN-7) shipped with no tests, although its helpers are marked `internal so tests can assert` and its precedent (`resolveTodayReadinessState` / `TodayRealReadinessTests`) is fully branch-tested.

### Added — `TrainingInsightsReadPathTests` (pure test backfill, no engine change)
- **Resolver branches** (mirroring `TodayRealReadinessTests`): `.missing → .empty`, `.unreadable → .unavailable`, `.loaded(empty history) → .empty`, `.loaded(non-empty) → .ready(summary)`, plus determinism.
- **History order bridge (`:150`)** — a load-bearing test: an OLDEST-FIRST bench-press history with a rising top weight yields trend `推进中` in the summary (engines read it newest-first after the reverse); the SAME data read oldest-first (no reverse) would be mis-read as `回落`. Proves the `reversed()` is load-bearing, not a no-op.
- **Formatting helpers** — `num` (integer drops `.0` / fraction keeps one C-locale decimal), `prValue` (new / up±delta / down-with-own-minus-sign / flat + unknown→default), `isImportantPlateau` (filters `none` / `insufficientData`), `plateauStatusLabel` (every case).

No engine output semantics changed (pure test backfill; no bug surfaced).

## Boundaries held
- **Source-of-truth impact: none.** No `CanonicalSessionWriter` / write-path touch, no AppData mutation; only a sort-stability guarantee added (engine output unchanged) + tests + one additive golden.
- **Data-safety impact: none.**
- **Zero `: Date`.**
- Existing goldens **zero drift** (the four conversions are byte-neutral on this toolchain; the only golden delta is the new additive tie fixture).
- Parity fixture-count guards bumped **73 → 74** in sync (`parityFixturesContract` own list + `parityFixturesGenerationConsistency` + `iosBootstrapParityStillGreen` + the ten `iosLocal*` / `iosNative*` `--check` guards).
- **`project.pbxproj` / `Package.swift` / `package.json` / lockfile / `.claude` byte-unchanged**; SPM-auto-included.

## Verification
- `node scripts/generate-parity-goldens.mjs` — `74 fixture(s); 1 changed` (only the new additive tie golden; existing goldens byte-identical).
- `npm run typecheck` — clean.
- `npx vitest run` — full suite green (incl. the parity count + golden-drift guards).
- `swift test --package-path ios/packages/IronPathTrainingDecision` — all green, incl. the new `AnalyticsDashboardSortStabilityTests`, `TrainingInsightsReadPathTests`, and `testBuildAdherenceReportTieCaseParity`.
- `xcodebuild … -scheme IronPath … build` — **BUILD SUCCEEDED**.
