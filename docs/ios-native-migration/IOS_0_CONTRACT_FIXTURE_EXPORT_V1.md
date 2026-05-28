# iOS-0 Contract Fixture Export V1

> Status: implementation. **No iOS source touched, no Xcode project, no Swift,
> no SwiftPM dependency.** This task only produces deterministic JSON
> fixtures and a Node-based generator on the TypeScript side, so the future
> native iOS port can be tested against exact source-of-truth outputs.

> Parent docs:
> - `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` (recommended strategy + stop conditions)
> - `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` (iOS-0 section)
> - `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` (11 frozen contracts)

---

## 1. Goal

Freeze the current TypeScript behaviour into versioned JSON contract
fixtures under `tests/fixtures/parity/` so the future Swift native iOS
port can be tested against exact TypeScript source-of-truth outputs.

Specifically, iOS-0 produces:

1. **Input fixtures** — deterministic, redacted, versioned JSON inputs
   that drive the parity-relevant pipelines on the TypeScript side.
2. **Golden output fixtures** — the JSON the current TypeScript code
   produces when fed each input fixture. These are the byte-for-byte
   contract that the future Swift port must match.
3. **A Node-based generator** — `scripts/generate-parity-goldens.mjs`,
   the single command that re-derives every golden from its input. It
   supports `--check` (drift detector) and `--list` (enumerate fixture
   ids).
4. **Parity + static-guard tests** — vitest tests that fail if any
   fixture goes missing, the generator drifts, the privacy guard finds
   a token, or any iOS-1 forbidden artefact (`.xcodeproj`, `.swift`,
   `Package.swift`, SwiftPM dependency, lockfile drift) sneaks in.

The fixtures cover the five contract surfaces named in the Entry Gate
doc:

- AppData snapshot hash (canonical stringification + FNV-1a)
- TrainingDecision V2 (Clean Input Contract → engine)
- Data Health repair (AutoRepairOrchestrator, residue case)
- Real redacted export reference
- Focus Mode golden path (`buildFocusStepQueue` + interaction state)

---

## 2. Non-goals

- iOS-0 does NOT create an Xcode project. That is iOS-1.
- iOS-0 does NOT write Swift. That is iOS-2 onwards.
- iOS-0 does NOT add SwiftPM dependencies (forbidden by Stop Condition #7).
- iOS-0 does NOT modify any `src/**/*.ts` runtime behaviour.
- iOS-0 does NOT change `STORAGE_VERSION` or any AppData schema field.
- iOS-0 does NOT change cloud sync behaviour or the Supabase contract.
- iOS-0 does NOT add npm dependencies; `package.json` and
  `package-lock.json` are byte-identical to the parent commit.
- iOS-0 does NOT introduce `pnpm-lock.yaml`.
- iOS-0 does NOT commit a full private raw export. The real-export
  fixture is a pointer wrapper around the already-redacted
  `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`.
- iOS-0 does NOT add UI snapshot comparisons. The fixtures only cover
  engine-level parity.
- iOS-0 does NOT depend on any network, dev server, or browser API.

---

## 3. Why fixtures come before Xcode

The Migration Program Manager Agent (Agent 8) and the QA / Parity Agent
(Agent 6) both flagged the same risk in `docs/ios-native-migration/`:

> If iOS-1 (Xcode project) lands before iOS-0 (fixtures), the Swift port
> has no source-of-truth to validate against, and every Swift engine
> ships an unauditable "matches TypeScript well enough" claim.

Stop Condition #6 in the Entry Gate explicitly forbids creating an
Xcode project before iOS-0 is green. iOS-0 is the only iOS task that
can run entirely on the TypeScript side and therefore the only one
that does not need a buildable Swift environment.

Concretely, iOS-0 lets iOS-2 / iOS-3 / iOS-4 / iOS-5 / iOS-7 / iOS-8
each open with a precise acceptance bar: "your Swift port must
reproduce the golden file under `tests/fixtures/parity/golden/...`
byte-for-byte". Without this, the Entry Gate's "no silent drift" rule
has no enforcement.

---

## 4. Canonical directory: `tests/fixtures/parity/`

Layout:

```
tests/fixtures/parity/
├── README.md                                # Phase 6 deliverable
├── inputs/
│   ├── app-data/
│   │   └── snapshot-hash-stable-v1.json
│   ├── training-decision/
│   │   └── normal-session-v1.json
│   ├── data-repair/
│   │   └── session-lifecycle-residue-v1.json
│   ├── real-export/
│   │   └── redacted-2026-05-27.json         # pointer wrapper
│   └── focus-mode/
│       └── golden-path-session-v1.json
└── golden/
    ├── app-data/
    │   └── snapshot-hash-stable-v1.json
    ├── training-decision/
    │   └── normal-session-v1.json
    ├── data-repair/
    │   └── session-lifecycle-residue-v1.json
    ├── real-export/
    │   └── redacted-2026-05-27.json
    └── focus-mode/
        └── golden-path-session-v1.json
```

The H1 revision from the Entry Gate cross-review (Cross-review §13 H1)
pinned this path as canonical against the alternate
`tests/fixtures/ios-contract/` proposed by the Migration Program
Manager Agent. `tests/fixtures/parity/` is what iOS-0 uses, what every
iOS-N task references, and what the static-guard tests assert.

---

## 5. Fixture categories

Five fixture groups (one input + one golden each):

| Category                | Input file                                                        | Engine path under test                                                  | iOS task consumer  |
|-------------------------|-------------------------------------------------------------------|-------------------------------------------------------------------------|--------------------|
| AppData snapshot hash   | `inputs/app-data/snapshot-hash-stable-v1.json`                    | `buildAppDataSnapshotHash` + `stableStringify` (FNV-1a)                 | iOS-2 + iOS-7      |
| TrainingDecision normal | `inputs/training-decision/normal-session-v1.json`                 | `buildCleanAppDataView` → `createCleanTrainingDecisionInput` → `buildTrainingDecision` | iOS-4              |
| Data Health repair      | `inputs/data-repair/session-lifecycle-residue-v1.json`            | `runAutoRepairOrchestrator` over `sessionLifecycleResidueV1`            | iOS-3              |
| Real export redacted    | `inputs/real-export/redacted-2026-05-27.json` (pointer wrapper)    | Full pipeline against the existing redacted real export                 | iOS-2 + iOS-3      |
| Focus Mode golden path  | `inputs/focus-mode/golden-path-session-v1.json`                   | `buildFocusStepQueue` + `resolveFocusModeInteractionState`              | iOS-5              |

---

## 6. Input envelope (`parityMeta`)

Every input fixture is a JSON object with a mandatory `parityMeta`
envelope at the top level:

```jsonc
{
  "parityMeta": {
    "id": "training-decision/normal-session-v1",
    "schemaVersion": 8,
    "describes": "TrainingDecision V2 normal-session parity contract",
    "privacy": "synthetic | redacted | redacted-pointer",
    "generatedFrom": "scripts/generate-parity-goldens.mjs",
    "tsCommit": "<source-commit-sha>",
    "generatedAtPolicy": "deterministic-clock",
    "deterministicClockIso": "2026-05-27T10:00:00.000Z",
    "sourceNotes": "Hand-authored minimal AppData; …"
  },
  /* … fixture-specific payload follows … */
}
```

Field rules:

- `id` — kebab-case fixture identifier matching the file's relative
  path under `inputs/`. The generator uses this as the routing key.
- `schemaVersion` — MUST equal `STORAGE_VERSION` from
  `src/data/appConfig.ts` at the time the fixture was generated.
  Currently `8`. Mismatches fail the parity tests.
- `describes` — one-line plain-English summary.
- `privacy` — one of `synthetic`, `redacted`, `redacted-pointer`.
  - `synthetic`: hand-authored AppData with no real-user provenance.
  - `redacted`: derived from a real export but every PII field
    redacted; do not commit unless it has passed the privacy guard.
  - `redacted-pointer`: not a full payload; points to an existing
    redacted file (`tests/fixtures/data-health/...`).
- `generatedFrom` — always `scripts/generate-parity-goldens.mjs`.
- `tsCommit` — the source commit SHA the golden was generated against.
  The parity test asserts the current HEAD or a documented source
  commit policy; updating the fixtures requires updating this field.
- `generatedAtPolicy` — `deterministic-clock` if any engine on the
  read path requires a `now` value; `none` if no clock is consumed.
- `deterministicClockIso` — required when `generatedAtPolicy ===
  'deterministic-clock'`. The generator injects this exact ISO string
  into every clock-bearing call (`buildCleanAppDataView`,
  `createCleanTrainingDecisionInput.metadata.nowIso`,
  `runAutoRepairOrchestrator.now`, `resolveFocusModeInteractionState`).
- `sourceNotes` — free-text provenance / authoring notes.

`parityMeta` MUST NOT contain real `userId`, `email`, `deviceLabel`,
Supabase token, auth token, cookie, API key, or any raw private
identifier. The privacy guard re-validates this on every run.

---

## 7. Golden output shape

Every golden is a JSON object with a `parityGolden` envelope at the
top level:

```jsonc
{
  "parityGolden": {
    "sourceFixtureId": "training-decision/normal-session-v1",
    "generatedFromCommit": "<source-commit-sha>",
    "generatedAtPolicy": "deterministic-clock",
    "deterministicClockIso": "2026-05-27T10:00:00.000Z",
    "generatorVersion": "v1"
  },
  /* … category-specific output follows … */
}
```

Per-category payload:

- **AppData snapshot hash**: `schemaVersion`, `snapshotHash`,
  `stableStringifyHashInputSummary` (a compact 1-line shape summary,
  not the full input).
- **TrainingDecision**: `decisionVersion` (`"v2"`),
  `userFacing.today/plan/training/focus/progress/record/explanation`,
  `hiddenDebugSignals.arbitrationTrace`.
- **Data Health repair**: `detected[]`, `dryRun`, `applied`,
  `receipt`, `ledger`, `postRepair`, `idempotencySecondRun`.
- **Real export redacted**: `fixtureLoaded`, `privacyGuardPassed`,
  `dataHealthScan` (counts of dirty classes), `cleanAppDataViewBuilt`,
  `trainingDecisionRan` (optional), `snapshotHash`.
- **Focus Mode golden path**: `focusStepQueue[]`, `primaryActions{}`,
  `stepIds[]`, `terminalState`.

Goldens MUST be deterministic — sorted keys, fixed ISO clock, no
volatile fields (`Date.now()`, `Math.random()`, process-pid, etc.).

---

## 8. Determinism rules

The generator MUST:

1. Use **only** `parityMeta.deterministicClockIso` for any engine-side
   clock injection. The generator's own `Date.now()` is forbidden
   inside the pipeline closure.
2. Use **no** `Math.random()` anywhere.
3. Use **canonical JSON output**: keys sorted lexicographically;
   2-space indentation; final newline. The generator's writer enforces
   this via `stableStringify(value, { sortKeys: true, indent: 2 })`.
4. Be **idempotent**: two consecutive `node scripts/generate-parity-goldens.mjs`
   runs MUST produce byte-identical output. Asserted by
   `tests/parity/parityFixturesGenerationConsistency.test.ts`.
5. Be **commit-stamped**: every golden includes
   `parityGolden.generatedFromCommit` so the future Swift port can
   detect "this golden was frozen at TS commit X; if your branch
   precedes X, you may diverge".

The generator MUST NOT:

- Touch `localStorage` (it isn't even a thing in Node).
- Touch the network.
- Touch `dist/` or `.ironpath/` except for its own build artefact
  under `.ironpath/parity-goldens-runner/` (gitignored).
- Add any package dependency.

---

## 9. Privacy / redaction rules

The privacy guard runs on every input and every golden. It fails the
generator (and any test) if any of the following patterns appears in
the JSON:

| Class                          | Pattern (case-insensitive substring or regex)                                       |
|-------------------------------|--------------------------------------------------------------------------------------|
| Supabase service role key     | `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_`, `service_role`                            |
| Supabase anon key heuristic   | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXV` (JWT prefix)                                     |
| API keys                      | `sk_live_`, `sk_test_`, `api_key=`, `apiKey=`                                        |
| Email                         | `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i`                                           |
| Bearer / auth token           | `bearer `, `authorization:`, `Authorization:`                                        |
| Cookies                       | `set-cookie`, `cookie:`                                                              |
| Device label                  | `deviceLabel:` followed by a non-empty quoted string that is NOT the literal `"iPhone"` or `"iPad"` placeholder |
| Raw userId                    | a `userId` field whose value is NOT the literal `synthetic-user` or `<redacted>`     |

If the privacy guard finds any of the above:

- The generator aborts with a non-zero exit code and prints the
  offending fixture id + the pattern that matched.
- The parity tests fail with the same error surfaced to vitest.

The guard does **not** scan the existing redacted real export
(`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`) for
PII — that file is already known-redacted and has its own tests. The
guard does scan the parity-side wrapper (`inputs/real-export/...`).

---

## 10. Script behaviour

`scripts/generate-parity-goldens.mjs` is the single entrypoint.

Modes:

- `node scripts/generate-parity-goldens.mjs` — write/refresh every
  golden under `tests/fixtures/parity/golden/`.
- `node scripts/generate-parity-goldens.mjs --check` — drift detector;
  re-derive each golden in memory, compare to the on-disk file, and
  fail non-zero with a unified diff if any byte differs.
- `node scripts/generate-parity-goldens.mjs --list` — enumerate the
  fixture ids the generator knows about and exit zero.

Output (compact summary):

```
generated 5 (or checked 5 / changed 0)
- app-data/snapshot-hash-stable-v1
- training-decision/normal-session-v1
- data-repair/session-lifecycle-residue-v1
- real-export/redacted-2026-05-27
- focus-mode/golden-path-session-v1
```

### How `.mjs` invokes TypeScript

The repo already has a precedent for invoking TS from a Node script
via Vite SSR build:

- `package.json:scripts.api:dev:build` does
  `vite build --ssr apps/api/src/node/devApiRunner.ts --outDir .ironpath/dev-api-runner`,
  then `node .ironpath/dev-api-runner/devApiRunner.js`.

iOS-0 follows the same pattern with **no new package script**:

1. `scripts/generate-parity-goldens.mjs` (the `.mjs` wrapper) detects
   if `.ironpath/parity-goldens-runner/parityGoldensEntry.js` is stale
   relative to `scripts/parityGoldensEntry.ts` or any imported `src/`
   file. If stale, it spawns `vite build --ssr scripts/parityGoldensEntry.ts
   --outDir .ironpath/parity-goldens-runner --emptyOutDir` via
   `node ./node_modules/vite/bin/vite.js`.
2. It then spawns
   `node .ironpath/parity-goldens-runner/parityGoldensEntry.js`,
   passing through `--check` / `--list` / no-flag.
3. The bundled entry (`parityGoldensEntry.js`) is what actually
   imports from `src/`, runs the engines, and writes the goldens.

This adds zero npm dependencies and reuses an existing, tested
toolchain. No `package.json` script change is required because the
docs-only requirement still holds: contributors invoke the script
directly as `node scripts/generate-parity-goldens.mjs`.

---

## 11. Tests

### Parity tests (Phase 7)

Test file: `tests/parityFixturesContract.test.ts` (prefix
`parityFixtures*`).

- Directory layout exists: `tests/fixtures/parity/inputs/<category>/`
  + `tests/fixtures/parity/golden/<category>/` + `README.md`.
- All 5 input fixtures exist and parse as JSON.
- All 5 golden fixtures exist and parse as JSON.
- Every input fixture has a `parityMeta` object with the required
  fields.
- `parityMeta.schemaVersion` matches `STORAGE_VERSION` from
  `src/data/appConfig.ts`.
- `parityMeta.tsCommit` is set (not the empty string) and conforms to
  the documented source commit policy (40-char hex or a known
  `pre-merge` placeholder explained in the README).
- TrainingDecision golden carries `decisionVersion === "v2"` and a
  non-empty `hiddenDebugSignals.arbitrationTrace`.
- Data Health golden carries a non-empty `receipt` and `ledger`
  summary.
- Snapshot-hash golden carries a `snapshotHash` matching the
  `phase19b-` prefix.
- Focus Mode golden carries non-empty `focusStepQueue` and
  deterministic `stepIds`.

### Generator consistency test (Phase 7)

Test file: `tests/parity/parityFixturesGenerationConsistency.test.ts`.

- Runs `node scripts/generate-parity-goldens.mjs --check` in a child
  process; expects exit code 0.
- Runs the generator twice and asserts the second run is byte-equal to
  the first (idempotency).

### Privacy guard test (Phase 7)

Test file: `tests/parityFixturesPrivacyGuard.test.ts`.

- Re-runs the privacy guard logic against every file under
  `tests/fixtures/parity/`, with the same pattern list as §9. Fails
  if any pattern matches.

### Static-guard tests (Phase 8)

Test file: `tests/iosContractFixtureStaticGuards.test.ts`.

- Asserts no `IronPath.xcodeproj`, no `.xcworkspace`, no `.pbxproj`,
  no `Package.swift`, no `*.swift` under `**/*` (excluding documented
  inert references inside `docs/` text).
- Asserts no new third-party dependency was introduced (the diff
  between `package.json` and `package-lock.json` is empty against
  `main`).
- Asserts `pnpm-lock.yaml` does not exist.

### Existing privacy tests

The existing `tests/privacyExportDeleteReadiness.test.ts` and the
broader scan in `scripts/scan-production-dist-safety.mjs` are NOT
weakened by iOS-0. The parity-side guard is additive; it shares the
core pattern list but lives in its own test file.

---

## 12. Validation

The full validation suite for the iOS-0 PR:

```
npm run api:dev:build
npm run typecheck
npm test
npm run build
node scripts/scan-production-dist-safety.mjs
node scripts/generate-parity-goldens.mjs --check
node scripts/generate-parity-goldens.mjs --list
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml
test ! -e pnpm-lock.yaml
git diff --check
```

All must succeed before opening the PR. The PR description repeats
this list and the result of each step.

---

## 13. Remaining risks

1. **TS / Swift output drift over time.** TS engines evolve (especially
   TrainingDecision). Without a periodic "Swift port refresh"
   discipline, the Swift port can drift silently. Mitigation: every
   future TS engine PR that materially changes a parity-relevant
   surface MUST re-run the generator, refresh the goldens, bump
   `parityMeta.tsCommit`, and surface this in the PR body. The
   docs-parity tests for the Entry Gate enforce that the contract
   freeze cannot be loosened.
2. **Hash canonicalisation mismatch.** Swift's default `JSONEncoder`
   does not sort keys and uses different number formatting. The
   parity test specifically pins the FNV-1a output, but the Swift
   port will need a hand-written stableStringify in iOS-2. iOS-0
   guarantees the TS reference; iOS-2 must explicitly cite this
   golden when the Swift `AppDataSnapshot.hash(_:)` is authored.
3. **Synthetic AppData missing edge cases.** The hand-authored inputs
   are minimal by design. The real-export pointer fixture is the
   only edge-case surface we exercise. iOS-3 / iOS-4 may need to add
   more parity fixtures (e.g. reentry, deload, kg/lb display). Those
   are scoped to their own iOS-N PRs and ride the same generator.
4. **Vite SSR bundling of `src/` is technically a build step in CI.**
   The generator wrapper rebuilds whenever it detects staleness, but
   if the staleness check is wrong, CI might use an old bundle. The
   safer default is to always rebuild; the wrapper does that.
5. **`.ironpath/parity-goldens-runner/` is gitignored.** This means
   regenerating goldens locally requires running the generator at
   least once after a clean clone. Documented in the README.

---

## 14. Final verdict

iOS-0 is implementable as a docs/scripts/tests-only PR with **zero**
runtime changes, **zero** new dependencies, **zero** Swift, and
**zero** Xcode artefacts. The Entry Gate's contract freeze and stop
conditions are unchanged by this PR; they are now machine-enforceable
via the parity goldens and the static-guard tests.

This doc is the implementation contract. Phases 3–10 follow it
verbatim.
