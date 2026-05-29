# Test Suite Tiering + Redundancy Reduction V1

Status: implemented. Additive — no test deletion, no runtime/Swift/engine/schema
change, no dependency or lockfile change. Adds tiered `package.json` scripts, one
central architecture-boundary guard, a tier-script lock test, and this doc.

## 1. Problem statement

IronPath has ~1350 `.test.ts` files (6500+ test cases). The problem is not the
raw count — it is that **every test runs in one undifferentiated bucket**. A
developer iterating on a SwiftUI view or a Swift package has no fast feedback
loop short of the full ~50s `npm test` (plus 9 `swift test` packages and two
`xcodebuild` runs at the merge gate). There was no documented notion of "what
should I run while editing" vs "what must pass before merge".

This task introduces a **tier model** so local/Xcode-led iteration is fast while
the merge-gate stays exactly as strict as before. It also **maps** (not prunes)
the redundant static-guard assertions so a future PR can consolidate them safely.

## 2. Current test categories

An 18-agent inventory pass classified the suite along 8 analytical lenses. These
lenses **overlap** (e.g. the `iosBootstrap*` files count as both iOS static
guards and migration-planning locks) — they are not a partition, so the column
sums exceed the ~1350 distinct files. They describe *what kind of protection* a
test provides, for tiering purposes.

| Category | ~Files | Purpose (what breaks if removed) |
| --- | --- | --- |
| true-unit | ~250 | Core domain/engine/i18n/presenter logic correctness (e1RM, set counting, readiness/deload/clamp/prescription, formatters). The only Node-side guard that computed output is *correct*. |
| training-decision-parity | ~5 | The 14-fixture byte-equality contract between the TS engine and the Swift port; privacy + envelope guards on goldens. |
| ios-static-guards | ~19 | TS-side scans of `ios/**/*.swift` + `project.pbxproj`: forbidden imports, required symbols, package-graph shape, per-PR stop conditions. |
| docs-parity | ~151 | Grep-locks over `docs/*.md` load-bearing clauses; fail when a doc contract is silently weakened. |
| phase-archive-locks | ~105 | Completion-archive / route-surface-count / coverage-inventory truth locks (historical PR/SHA evidence). |
| cloud-data-health-dev-api | ~207 | Cloud-secret-leak bans, dev-API-runner browser-isolation, DataHealth dismiss/repair regressions. |
| migration-planning-locks | ~9 | iOS migration sequencing + bootstrap package-graph / target-settings locks. |
| ai-safety-grep | ~24 | Web-side production-code scans (no `eval`, no `service_role` leak, no stale copy, no PII fixture, coverage inventory). |

Full inventory JSON (per-category tier rationale + archive verdicts) is reproduced
from the orchestration run that produced this doc; the tier assignment is
summarized in §3.

## 3. Tier model

### Tier 0 — Fast local / Xcode iteration  (`node scripts/test-tiers.mjs test:fast`)
Purpose: sub-30s feedback while editing SwiftUI or Swift package code.
Contents: `test:parity` (parity `--check`) + `test:ios` (all `tests/ios*.test.ts`,
26 files — the iOS static guards + the new architecture-boundary guard + the
bootstrap/forbidden-import locks). These are millisecond-class source-string
scans plus one parity spawn. They give the highest signal-per-second during an
iOS edit.

Explicitly **not** in Tier 0: the ~250 true-unit engine tests, ~105 phase/archive
locks, ~207 cloud/data-health/dev-api tests — these are slower and almost never
tripped by an iOS-side edit.

### Tier 1 — iOS PR validation  (`node scripts/test-tiers.mjs validate:ios`)
Purpose: before creating an iOS PR.
Contents: `typecheck` + `test:parity` + `test:ios`. In the merge-gate workflow
this is paired with the 9 `swift test` packages and `xcodebuild` (generic +
iPhone 17 Pro), which live outside npm's reach. Catches iOS-specific regressions
fast without paying for the full Node suite.

### Tier 2 — Full merge-gate  (`node scripts/test-tiers.mjs validate:full` + Swift + Xcode)
Purpose: before merge. **Unchanged in strictness.**
Contents (npm side): `api:dev:build` → `typecheck` → `test:full` (the full
`vitest run`, identical to `npm test`) → `build` → `scan-production-dist-safety`.
The canonical merge-gate additionally runs (outside npm): `generate-parity-goldens
--check`/`--list`, all 9 `swift test` packages, and both `xcodebuild`
destinations. None of those gate steps were removed or weakened.

### Tier 3 — Archive / nightly / manual  (documented only)
Purpose: historical docs/archive locks and slow low-change checks.
**No tests are moved to nightly-only in this PR.** Every inventory agent returned
`archiveCandidate = false` — the phase/archive locks are fast (a few file reads)
and are the *only* guard against silent archive rewrites, so they stay in Tier 2.
Candidates are documented in §10 for a future pass; none are acted on here.

## 4. The tier runner (NOT package.json scripts)

**Critical constraint discovered during implementation:** ~48 cloud /
data-health / dev-api boundary locks (e.g. `cloudParityCheckBoundary`,
`apiBackedReadBoundary`, the `writePath*RouteBoundaryLock` family) freeze
`package.json` **byte-for-byte** — they assert a boundary PR changes no
schemas / routes / packages / lockfiles, using `git diff origin/main --
package.json … == ''`. Adding npm scripts to `package.json` would trip **every
one** of those 48 locks. Per the task's stop conditions ("do not weaken
cloud/data-health boundaries", "no massive deletion/edit PR"), this PR does
**not** touch `package.json`.

Instead the tiers are routed through a standalone runner —
**`scripts/test-tiers.mjs`** — invoked as `node scripts/test-tiers.mjs <tier>`:

| Tier | Composition | Underlying commands |
| --- | --- | --- |
| `test:parity` | parity | `node scripts/generate-parity-goldens.mjs --check` |
| `test:ios` | ios | `node ./node_modules/vitest/vitest.mjs run` over the expanded `tests/ios*.test.ts` set |
| `test:fast` | parity → ios | Tier 0 |
| `test:full` | full | `node ./node_modules/vitest/vitest.mjs run` (no filter — identical surface to `npm test`) |
| `validate:ios` | typecheck → parity → ios | Tier 1 |
| `validate:full` | api:dev:build → typecheck → full → build → dist-safety scan | Tier 2 |

The runner only *sequences* existing validation commands (reusing the unchanged
`npm run typecheck` / `api:dev:build` / `build` scripts and direct `node`
invocations for parity / vitest / scan). It runs fail-fast (any non-zero step
aborts with that exit code), adds no dependency, references no `pnpm`, and never
deploys or merges. `package.json` and `package-lock.json` are byte-unchanged.
`tests/ios/**` is not used because no `tests/ios/` subdirectory exists — the
iOS tests are flat `tests/ios*.test.ts` (26 files; 27 including the new central
guard).

> If the team later decides to relax the package.json-freeze in the 48 boundary
> locks (changing them to freeze the *dependency manifest + lockfiles* instead of
> the whole file — which preserves the no-dependency-drift property), these six
> tiers can be mirrored as real `package.json` scripts that simply delegate to
> the runner (`"test:fast": "node scripts/test-tiers.mjs test:fast"`). That is a
> deliberately separate decision; see §12.

## 5. What developers should run during Xcode-led tasks

- While editing a SwiftUI view or a Swift package: `node scripts/test-tiers.mjs test:fast`
  (parity + all iOS static guards, ~2s).
- Before opening an iOS PR: `node scripts/test-tiers.mjs validate:ios`, then the
  9 `swift test` packages + `xcodebuild` generic / iPhone 17 Pro.
- This mirrors the iOS-5/iOS-6 workflow, now with named tiers instead of
  ad-hoc command lists.

## 6. What merge-gate still requires

Everything it required before. `validate:full` keeps `api:dev:build`,
`typecheck`, the full `vitest run`, `build`, and `scan-production-dist-safety`.
The gate workflow still also runs `generate-parity-goldens --check`/`--list`, all
9 Swift packages, and both `xcodebuild` destinations. **No required check was
removed, narrowed, or made conditional.** `npm test` is byte-for-byte the same
command it was.

## 7. Redundancy findings

A 10-agent redundancy pass mapped duplicated static-guard assertions:

| Assertion pattern | Occurrences | Safe to consolidate? |
| --- | --- | --- |
| `pnpm-lock.yaml` absence | ~86 | yes (repo-global) |
| `import HealthKit` ban | ~11 | yes (central forbidden-imports already covers all `ios/`) |
| `import Supabase` ban | ~11 | yes (same central guard) |
| `import IronPathCloudSync` ban | ~6 | **no** — per-file scope (must exclude `IronPathApp.swift`, which legitimately links Cloud) |
| `import WebKit` ban | ~9 | **no** — per-package failure attribution |
| `URLSession/URLRequest/NSURLSession` ban | ~4 | **no** — the copies differ (call-form vs symbol-form); not true duplicates |
| TS/JS-runtime bridge ban (`JSContext`/`JSValue`/`WKWebView`/`node_modules`) | ~2 | yes (Focus-Mode shell surface) |
| AppData-mutation ban | ~2 | yes (Focus-Mode shell surface) |
| `generate-parity-goldens --check` spawn (14/0) | ~4 | yes (one authoritative spawn) |
| `package.json` / `package-lock.json` byte-identity | ~2 | yes (repo-global) |

## 8. What was consolidated

**Additive only.** This PR adds one always-on central guard —
`tests/iosArchitectureBoundaryStaticGuards.test.ts` — that becomes the
authoritative, *stronger* home for the repo-wide boundaries, **without deleting a
single existing guard**:

1. **Focus-Mode shell surface** (directory-scoped over `ios/IronPath/*.swift`,
   excluding `IronPathApp.swift`): bans Cloud/HealthKit/Supabase/WebKit/
   JavaScriptCore imports, `WKWebView`/`JSContext`/`JSValue`, network
   (`URLSession`/`URLRequest`/`NSURLSession`), TS/JS source paths, and AppData
   mutation. Stronger than the per-file shell guards because it catches a
   *newly added* shell file automatically.
2. **Whole-`ios/` coverage gaps** the existing `iosBootstrapForbiddenImports`
   guard does **not** check — genuinely new assertions, not duplicates:
   `@Model`, `@Observable`, `import JavaScriptCore`, `JSContext`, `JSValue`,
   and the broader `URLRequest`/`NSURLSession` network surface (the bootstrap
   guard only bans the `URLSession(` call form).
3. **Repo-global**: `pnpm-lock.yaml` + `yarn.lock` absence, and
   `package-lock.json` byte-identity to the merge base (CI-aware base-ref
   resolver, same shape as the iOS-5/iOS-6 guards).

## 9. What was NOT deleted, and why

- The ~86 `pnpm-lock.yaml` copies, the per-package WebKit/CloudSync/URLSession
  bans, the per-PR parity spawns, the per-file Focus-Mode boundary checks — all
  **kept**. Each per-area copy gives *per-file/per-package failure attribution*
  that a single central guard cannot (a central failure says "some file under
  `ios/` imports WebKit"; the per-area copy says "this package's source does").
- Deleting any of them would be a large, attribution-losing change — explicitly
  out of scope ("Do not turn this into a massive deletion PR"). The central
  guard is purely additive insurance, so removing duplicates later is safe and
  optional, never required for coverage.

## 10. Archive / nightly candidates (documented, not acted on)

- **None promoted.** Every category's archive verdict was `false`. The
  phase/archive locks (~105) and cloud/data-health (~207) are slow-ish relative
  to Tier 0 but are *not* slow in absolute terms and have no stronger upstream
  guard, so they remain Tier-2 merge-gate.
- **Future consolidation candidates** (safe per §7, deferred here): fold the ~86
  `pnpm-lock` checks and the ~2 `package.json`/`package-lock` byte-identity
  checks into the new central guard and remove the scattered copies; collapse
  the ~4 parity `--check` spawns to one authoritative spawn (keep
  `iosBootstrapParityStillGreen` for its fixture-count assertion). Each is a
  small, independently-reviewable follow-up.

## 11. Safety boundaries preserved

- No app/Swift/engine/DataHealth/Cloud runtime change. No AppData schema change.
- No parity fixture/golden change (`--check` still 14 / 0).
- **`package.json` byte-unchanged** — so all ~48 cloud/data-health/dev-api
  boundary locks stay green and un-weakened. No dependency added;
  `package-lock.json` byte-identical; no `pnpm-lock.yaml`.
- `npm test` unchanged; the `validate:full` tier retains every prior merge-gate
  step.
- The new central guard only *adds* coverage (it is strictly a superset of the
  boundary properties it touches); no existing guard was weakened or removed.

## 12. Future cleanup recommendations

1. **Decide the package.json-freeze policy.** If the team wants the tiers as
   first-class `package.json` scripts, relax the 48 boundary locks to freeze the
   *dependency manifest (`dependencies`/`devDependencies`/`overrides`) +
   lockfiles* instead of the whole `package.json` file. That preserves the real
   no-dependency-drift property (a dep change still fails via the lockfile and
   the manifest diff) while permitting `scripts` additions. Then add thin
   `package.json` scripts that delegate to the runner
   (`"test:fast": "node scripts/test-tiers.mjs test:fast"`). This is a separate,
   reviewable safety-posture change — intentionally out of scope here.
2. Execute the safe consolidations in §10 (pnpm-lock, package byte-identity,
   parity spawn) in a small dedicated PR, deleting the scattered copies only
   after confirming the central guard runs in the merge-gate.
2. Extract the repeated `collectSwift` / `stripSwiftComments` / `FORBIDDEN_IMPORTS`
   boilerplate (duplicated across the `iosTrainingDecision*StaticGuards` family)
   into a shared test helper to stop the lists drifting.
3. Consider a `vitest` project/workspace split so Tier-0/Tier-1 selection is a
   first-class config rather than a path glob, once the team validates the tier
   boundaries in practice.
4. Add a `test:fast` timing budget assertion (e.g. fail if Tier 0 exceeds ~30s)
   to keep the fast tier honest as the iOS surface grows.
