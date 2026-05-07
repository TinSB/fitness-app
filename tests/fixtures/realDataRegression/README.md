# Real Data Regression Fixtures

These fixtures are anonymized, minimized reconstructions of real user bugs.

They are not full IronPath exports. They intentionally omit personal details,
unrelated history, device metadata, and complete training logs. Each JSON file
keeps only the fields required to reproduce one regression risk.

## Fixtures

- `legacy-assisted-pullup-session.json`: Valid assisted pull-up replacement records must stay valid, while invalid or synthetic legacy replacement ids must be preserved only for review.
- `incomplete-draft-sets-session.json`: Sets with `done=false` can contain weight, reps, and RIR, but must remain incomplete drafts and stay out of statistics.
- `ppl-cycle-boundary-history.json`: An out-of-order completed PPL cycle must close before a new PPL cycle starts, so old legs work cannot fill the new cycle.
- `stale-today-soreness.json`: Old or undated soreness must not carry into today's recommendation, while sleep, energy, and time can remain.
- `duplicate-plan-draft.json`: Same-source plan adjustment drafts must dedupe by `sourceFingerprint`, not by random instance ids.
- `legacy-unit-display.json`: `actualWeightKg` is the calculation source; legacy display fields are display compatibility only and may require review.
