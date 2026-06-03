# AN-1b — `roundToFixed` JS-`toFixed` Fidelity + AN-1 Boundary Fixtures (V1)

**Track:** Analytics / Insights (AN-1 … AN-6). AN-1b is a correctness + coverage
follow-up to AN-1. **Status:** Landed. **Allowed-change:** §19.2 (engine-package pure
logic + parity goldens). **Amends:** §27. **Source-of-truth / data-safety impact:** none.

## Scope

Two things, both PURE / read-only, **no UI / no write path / no engine-output change**:

1. **Fix `AnalyticsSupport.roundToFixed` to faithfully reproduce JS
   `Number(value.toFixed(digits))`.** AN-1 implemented it as `(value * p).rounded() / p`
   — a multiply-then-round that DIVERGES from `toFixed` on `.XX5` ties and IEEE-754
   representation cases, because the `value * p` multiply rounds across a `.5` boundary
   the true value sits below. The three analytics engines round real data
   (`deltaKg` / `deltaPercent` = `(cur-prev)/prev*100` / `effectiveSets` / `share` =
   `eff/total*100`) that easily lands on `.XX5`; AN-1's fixtures merely avoided ties, so
   the bug was latent.
2. **Pin the audit's "green-but-empty" coverage debt** with boundary fixtures
   (additive `cases`, generated never hand-edited §22).

## The fidelity fix

`roundToFixed` now reproduces ECMAScript `Number.prototype.toFixed` (ES2023 §21.1.3.3)
with pure decimal-string semantics — **never `.rounded()`**:

1. take the magnitude's EXACT decimal expansion (a finite double is a dyadic rational
   whose decimal terminates) via `String(format: "%.340f", …)` — `340` ≫ the ≤~110
   fractional digits any analytics magnitude needs, so printf (correctly rounded)
   reproduces the exact terminating expansion + trailing zeros;
2. round that string half-away-from-zero at `digits` places (carry-propagated), matching
   the spec's "pick `n` minimising `|n/10^f − x|`, ties → larger `n`" on the magnitude;
3. parse back with `Double(_:)` (= JS `Number(string)`, both `strtod` correctly-rounded).

Result: **bit-identical to `Number(value.toFixed(digits))` for every finite double**,
including the cases the multiply path got wrong:

| value, digits | JS `toFixed` | old `(x*p).rounded()/p` |
| --- | --- | --- |
| `2.675`, 2 | `2.67` | `2.68` ✗ |
| `0.15`, 1 | `0.1` | `0.2` ✗ |
| `0.35`, 1 | `0.3` | `0.4` ✗ |
| `1.555`, 2 | `1.55` | `1.56` ✗ |
| `-2.675`, 2 | `-2.67` | `-2.68` ✗ |

**TS↔Swift cross-validation:** `AnalyticsRoundToFixedCrossValidationTests` pins
`roundToFixed` against **JS ground truth** (`Number(x.toFixed(d))` from Node) over 69
rows — `.XX5` ties, IEEE-754-representation cases, negatives, every digit width (0…3),
near-integer carries, and the realistic `deltaPercent` / `share` / `effectiveSets`
intervals these engines produce — asserting EXACT `==`. It would catch any regression
back to a multiply-then-round approximation.

## Boundary fixtures (3 NEW fixture files — additive, parity count 54 → 57)

8 NEW boundary `cases` live in **3 NEW fixture files** (`{training-streak,recent-pr-delta,
weekly-muscle-balance}/*-boundary-cases-v1`), one per metric, run through the SAME three
generators. They are SEPARATE files — NOT modifications of the AN-1 fixtures — because the
`--diff-filter=MD` parity guards (`changedFiles(['tests/fixtures/parity'])`) flag ANY
modify/delete of an existing committed golden but sanction pure ADDITIONS (§22); adding
cases INTO the existing files would have tripped them. Each case makes its audited branch
be truly executed by a golden; several carry a divergent rounding value the OLD
`roundToFixed` would have computed wrong, so they double as fidelity-fix pins:

- **training-streak** (2 boundary cases): `finished-at-precedence-sunday-week` (the
  `finishedAt ?? startedAt ?? date` precedence + full-ISO→noon `safeDate` branch, both
  untested before, with a misleading old `date` so the result DEPENDS on `finishedAt`;
  + non-Monday `weekStartDayOfWeek = 0`) · `cross-year-month-carry` (`prevMonthKey`
  year-underflow + month-carry — `2026-01` → `2025-12`, `longestMonthStreak = 3`).
- **recent-pr-delta** (3 boundary cases): `both-new-and-equal-delta-tie` (the sort's
  both-`new` NaN-tie + equal-`deltaKg` 0-tie → JS-stable insertion order) ·
  `pickbest-full-equality-tie` (equal weight AND reps → `pickBest` first-seen wins,
  pinned via `currentBestDate`) · `delta-rounding-half-tie` (`deltaKg = 5.55`, which the
  old `roundToFixed` would have rounded to `5.56`).
- **weekly-muscle-balance** (3 boundary cases): `non-focus-insertion-and-half-tie`
  (non-focus muscles 小腿/前臂 surfacing via `effectiveSets > 0` + Map insertion-order tie
  + `effectiveSets = 2.67`, old `roundToFixed` → `2.68`) · `single-focus-count-lt2`
  (`focusMuscles = ["胸"]` → `focusEntries.count < 2` gate → `balanceScore` stays 100) ·
  `threshold-12-boundary` (shares 62 / 38 → deviations EXACTLY `+12` / `-12` → the
  inclusive `>= 12` overworked + `<= -12` underworked edges both fire).

The 3 existing AN-1 goldens (+ all other 51) regenerate **byte-identically** (the fidelity
fix is Swift-only — TS native `toFixed` was already correct). The 3 Swift `*ParityTests`
gain a `…ForBoundaryCases` method that compute-asserts the boundary golden (the new tie
cases FAIL the old Swift `roundToFixed` and PASS the fixed one).

## Invariants held

- **Zero golden drift.** The fidelity fix is **Swift-only** — the goldens are generated
  from TS native `toFixed` (already correct), so NO existing golden changes. ALL 54
  pre-existing goldens regenerate **byte-identically**, and the 3 NEW boundary goldens are
  pure ADDITIONS (`generated 57 fixture(s); 3 changed`; `git diff --diff-filter=MD
  origin/main -- tests/fixtures/parity` is **empty** — the additive parity guards stay
  green). The new tie cases would FAIL the old Swift `roundToFixed` and PASS the fixed one
  — which is the point.
- **Count guards.** Parity fixture count bumped **54 → 57** in sync across every guard
  that pins it: `parityFixturesContract` + `parityFixturesGenerationConsistency` +
  `iosBootstrapParityStillGreen` + the ten `iosLocal*`/`iosNative*` `--check` guards. The
  3 boundary fixtures registered in `scripts/parityGoldensEntry.ts` (`FIXTURE_IDS` +
  `GENERATORS`, reusing the existing three generator fns).
- **SPM-auto-included**, `project.pbxproj` / `package.json` / lockfile **byte-unchanged**,
  zero `: Date`, no IO; pure engine — **no write path**, no `CanonicalSessionWriter`,
  no source-of-truth touch; existing helpers reused (no re-port).

## Validation

`node scripts/generate-parity-goldens.mjs` (zero drift, 3 additive) · `npm run typecheck`
· `npx vitest run` (full suite) · `swift test --package-path
ios/packages/IronPathTrainingDecision` (the new `AnalyticsRoundToFixedCrossValidationTests`
+ the 3 `*ParityTests` over the new tie cases + existing all green) · `xcodebuild … build`.
