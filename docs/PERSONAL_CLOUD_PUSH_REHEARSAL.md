# Personal Cloud Push Rehearsal

This runbook rehearses a personal production candidate cloud push with dry-run, owner, backup, schema, and manual confirmation gates.

## Preconditions

- Cloud push candidate remains disabled unless explicitly enabled for this manual rehearsal.
- `localStorage` remains the default runtime source and emergency backup source.
- The synthetic/manual test account has passed Supabase project and RLS manual verification.
- Rollback / kill switch is available before push rehearsal begins.

## Rehearsal Steps

- [ ] Run the local-to-cloud dry run first.
- [ ] Confirm owner check required and owner scope matches the cloud account candidate.
- [ ] Confirm backup check required and backup availability is recorded.
- [ ] Confirm schema validation required before preparing any write candidate.
- [ ] Confirm manual confirmation required before write candidate execution.
- [ ] Confirm no fake success is reported when write is disabled or rejected.
- [ ] Confirm rollback available before any manually confirmed write candidate.
- [ ] Confirm local data changed remains false.
- [ ] Confirm source-of-truth unchanged unless a later explicit phase authorizes otherwise.
- [ ] Abort if owner mismatch, missing backup, schema invalid, or cloud conflict is detected.

## Expected Result

- Push remains candidate-only.
- Manual confirmation is required.
- Rollback remains available.
- Local data is not deleted or rewritten by the rehearsal.
- Source-of-truth remains unchanged in Phase 14.

## Blocked

- No unconfirmed cloud push.
- No automatic upload of real training data.
- No default cloud sync.
- No background sync.
- No new route.
- No package or lockfile change.

Recommended next rehearsal: Rollback / Kill Switch Rehearsal.
