# `tests/fixtures/parity/` — iOS native migration parity contract

This directory carries the **deterministic, versioned JSON contract
fixtures** that the future Swift / native iOS port of IronPath must
reproduce byte-for-byte. It is the iOS-0 deliverable of the iOS
Native Migration program.

See also:

- `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` — strategy + stop conditions
- `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` — iOS-0..iOS-10 roadmap
- `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` — 11 frozen contracts
- `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md` — full design

## Purpose

The Swift port cannot ship until its engine outputs match the TypeScript
source-of-truth. This directory lets every iOS-N task (Swift Data
Health, Swift TrainingDecision, Swift Focus Mode, Swift cloud sync) be
landed against a precise, machine-readable acceptance bar:

> *Your Swift engine must produce the JSON under
> `golden/<category>/<fixture-id>.json` when fed the corresponding
> input under `inputs/<category>/<fixture-id>.json`. No drift.*

If a TypeScript engine evolves, the goldens are refreshed via
`scripts/generate-parity-goldens.mjs` and the resulting diff is
reviewed in the same PR that changed the engine.

## Directory layout

```
tests/fixtures/parity/
├── README.md                                # this file
├── inputs/                                  # frozen, hand-authored or pointer
│   ├── app-data/snapshot-hash-stable-v1.json
│   ├── training-decision/normal-session-v1.json
│   ├── data-repair/session-lifecycle-residue-v1.json
│   ├── real-export/redacted-2026-05-27.json
│   └── focus-mode/golden-path-session-v1.json
└── golden/                                  # generated outputs
    ├── app-data/snapshot-hash-stable-v1.json
    ├── training-decision/normal-session-v1.json
    ├── data-repair/session-lifecycle-residue-v1.json
    ├── real-export/redacted-2026-05-27.json
    └── focus-mode/golden-path-session-v1.json
```

Every input fixture carries a `parityMeta` envelope:

```jsonc
{
  "parityMeta": {
    "id": "<category>/<slug>-v1",
    "schemaVersion": 8,
    "describes": "<one-line summary>",
    "privacy": "synthetic" | "redacted" | "redacted-pointer",
    "generatedFrom": "scripts/generate-parity-goldens.mjs",
    "tsCommit": "<40-char source commit>",
    "generatedAtPolicy": "none" | "deterministic-clock",
    "deterministicClockIso": "2026-05-27T10:00:00.000Z"  // when applicable
  },
  /* …category-specific payload… */
}
```

Every golden carries a `parityGolden` envelope:

```jsonc
{
  "parityGolden": {
    "sourceFixtureId": "<matches input parityMeta.id>",
    "generatedFromCommit": "<40-char source commit>",
    "generatedAtPolicy": "none" | "deterministic-clock",
    "deterministicClockIso": "…" | null,
    "generatorVersion": "v1"
  },
  /* …engine output… */
}
```

## How to regenerate

From the repo root:

```bash
node scripts/generate-parity-goldens.mjs
```

The script:

1. Bundles `scripts/parityGoldensEntry.ts` via `vite build --ssr` into
   `.ironpath/parity-goldens-runner/` (gitignored; same precedent as
   `package.json:scripts.api:dev:build`).
2. Runs the bundled entry under Node, which imports the engines from
   `src/` and writes goldens under `tests/fixtures/parity/golden/`.
3. Prints a compact summary (one line per fixture).

No new package dependency. No `package.json` script change. No
browser / network / `localStorage` access. No `Date.now()` or
`Math.random()` inside the pipeline.

## How to check (drift detector)

```bash
node scripts/generate-parity-goldens.mjs --check
```

Exits non-zero if any golden would change. Used in CI by
`tests/parityFixturesGenerationConsistency.test.ts` to keep the
fixtures and the engines in lockstep.

## How to list fixture ids

```bash
node scripts/generate-parity-goldens.mjs --list
```

## Privacy rules

- All committed fixtures are either **synthetic** (hand-authored),
  **redacted** (PII fields scrubbed before commit), or
  **redacted-pointer** (a wrapper pointing to an already-redacted
  fixture under `tests/fixtures/data-health/`).
- The privacy guard inside the generator scans both inputs and
  goldens for the following classes and aborts on any match:
  - Supabase service-role key (`SUPABASE_SERVICE_ROLE_KEY`,
    `sb_secret_`, `service_role`)
  - JWT-prefix tokens (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXV…`)
  - Stripe / API-key prefixes (`sk_live_`, `sk_test_`,
    `api_key=`, `apiKey=`)
  - Email addresses
  - `Authorization:` / `Bearer …` headers
  - `Set-Cookie` / `Cookie:` headers
  - Raw `userId` / `deviceLabel` values not in the allowlist
    (`synthetic-…`, `<redacted>`, `iPhone`, `iPad`,
    `redacted-device`)
- **Do NOT** place raw private exports here. The real-export
  fixture is a pointer; the actual redacted file lives under
  `tests/fixtures/data-health/`.

## Source commit rule

Each input fixture's `parityMeta.tsCommit` is the **source-of-truth
commit** the golden was generated against. Refresh the goldens (and
bump `tsCommit`) whenever:

- A TypeScript engine on the parity path changes (`buildAppDataSnapshotHash`,
  `buildCleanAppDataView`, `createCleanTrainingDecisionInput`,
  `buildTrainingDecision`, `runAutoRepairOrchestrator`,
  `buildFocusStepQueue`, `resolveFocusModeInteractionState`).
- A new repair lands under `src/dataHealth/repairs/`.
- The contract freeze adds or alters a relevant clause.

The static-guard tests fail if `parityMeta.tsCommit` is missing or
empty.

## Fixture list

| Category                | Input fixture                                            | Golden                                                    | iOS task consumer | Notes                                                                 |
|-------------------------|----------------------------------------------------------|-----------------------------------------------------------|-------------------|-----------------------------------------------------------------------|
| AppData snapshot hash   | `inputs/app-data/snapshot-hash-stable-v1.json`           | `golden/app-data/snapshot-hash-stable-v1.json`            | iOS-2, iOS-7      | Locks the `phase19b-` hash + `stableStringify` against a tiny payload |
| TrainingDecision normal | `inputs/training-decision/normal-session-v1.json`        | `golden/training-decision/normal-session-v1.json`         | iOS-4             | Drives the Clean Input Contract pipeline on the redacted real export  |
| Data Health repair      | `inputs/data-repair/session-lifecycle-residue-v1.json`   | `golden/data-repair/session-lifecycle-residue-v1.json`    | iOS-3             | Triggers `sessionLifecycleResidueV1` + idempotency 2nd run            |
| Real export redacted    | `inputs/real-export/redacted-2026-05-27.json`             | `golden/real-export/redacted-2026-05-27.json`             | iOS-2, iOS-3      | Pointer wrapper; full data-health scan over the redacted real export  |
| Focus Mode golden path  | `inputs/focus-mode/golden-path-session-v1.json`          | `golden/focus-mode/golden-path-session-v1.json`           | iOS-5             | `buildFocusStepQueue` over 2 exercises (2 warmup + 6 working steps)   |

### iOS-4B0 — TrainingDecision parity fixture expansion

iOS-4B0 adds **9 synthetic TrainingDecision fixtures** (all category
`training-decision/`, all consumed by the **iOS-4B Swift TrainingDecision
port**). Each carries a compact declarative `synthetic` spec (NOT a serialised
AppData) that the generator materialises into an engine-valid AppData via
`tests/fixtures.ts` `makeAppData`/`makeSession`/`makeStatus`, then drives through
the real Clean Input Contract pipeline. They are generated by
`generateTrainingDecisionExpanded()` (a separate generator from the iOS-0
`normal-session-v1`, whose narrower golden is unchanged).

| Fixture id | Locks |
|------------|-------|
| `training-decision/severe-rest-v1`          | severe-rest intent, riskLevel=severe, AR-1 severe-override/cut, finalVolumeMultiplier≤0.3 |
| `training-decision/controlled-reload-v1`    | controlled-reload intent (e1rm trend up + low readiness), AR-5-controlled-reload, not all-1-set |
| `training-decision/deload-week-v1`          | deload-week intent (explicit deload), volumeMode=trim, distinct from reentry/restart |
| `training-decision/stale-today-status-v1`   | staleTodayStatus guard detects todayStatus.date > 3d; no false readiness signal |
| `training-decision/stale-health-data-v1`    | staleHealthData guard (> 14d) → useHealthDataForReadiness=false; raw samples preserved |
| `training-decision/restart-28d-gap-v1`      | effectivePhase=restart (gap ≥ 28d), finalVolumeMultiplier=0.5 |
| `training-decision/productive-floor-v1`     | reentry role floors keep compounds ≥ 2 sets (no all-1-set regression) |
| `training-decision/no-legacy-advice-v1`     | legacy advice stripped by the clean view; never surfaces in userFacing |
| `training-decision/clean-input-contract-v1` | dirty AppData (lifecycle residue + impossible duration) cleaned by `buildCleanAppDataView` before the decision |

**iOS-4B usage.** The Swift TrainingDecision engine must reproduce each golden's
structured fields (`sessionIntent`, `activePhase`, `volumeMode`, `riskLevel`,
`finalVolumeMultiplier`, `exerciseRoleFloors`, `perExercise` set counts,
`userFacing.{7 surfaces}`, `hiddenDebugSignals.arbitrationTrace`,
`cleanInput.diagnostics`) when fed the same synthetic AppData under the same
deterministic clock. **Deterministic clock:** all 9 use
`2026-05-27T10:00:00.000Z`; gaps and staleness windows are computed as
`clock − N days` so runs are byte-identical. **Privacy:** all 9 are
`privacy: "synthetic"` — the input file holds only the declarative spec (no
userId/email/token/device label); the `DEFAULT_*` constants `makeAppData` injects
live only in the in-memory AppData, never in a committed file. **Golden files are
generated, never hand-edited** — `node scripts/generate-parity-goldens.mjs`.

## Hard rules

- **Do not edit golden files manually.** They are regenerated
  deterministically by `scripts/generate-parity-goldens.mjs`. Manual
  edits will be undone by the next CI run.
- **Do not place raw private exports here.** Only redacted fixtures
  (or pointers to redacted fixtures) are permitted.
- **Do not introduce non-deterministic content** (`Date.now()`,
  `Math.random()`, environment-dependent strings) into inputs or
  generators. The parity contract relies on bit-identical output.
- **Do not add SwiftPM dependencies or Xcode artefacts.** iOS-0 is
  TypeScript-only; the Xcode project arrives in iOS-1.
- **Do not bypass the privacy guard.** If you genuinely need a new
  identifier or token shape, add it to the allowlist in
  `scripts/parityGoldensEntry.ts` and document it here.

## Extending

To add a new fixture in a future iOS-N PR:

1. Pick a category (`<category>/<slug>-vN`) and create the input file
   under `inputs/<category>/<slug>-vN.json` with a full `parityMeta`
   envelope.
2. Add the new id to the `FIXTURE_IDS` tuple in
   `scripts/parityGoldensEntry.ts` and register a generator function.
3. Run `node scripts/generate-parity-goldens.mjs` to produce the
   golden.
4. Update this README's fixture list table.
5. Update the parity tests to assert the new id exists.

Static guards will fail if any of those steps is skipped.
