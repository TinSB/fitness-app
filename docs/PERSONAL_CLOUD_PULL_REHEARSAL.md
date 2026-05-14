# Personal Cloud Pull Rehearsal

This runbook rehearses a personal production candidate cloud pull without applying cloud data to local state.

## Preconditions

- Phase 14 personal production candidate scope is accepted.
- Supabase project manual verification has passed with a synthetic/manual test account first.
- RLS / ownership manual review has passed for the owner user id and account id.
- `localStorage` remains the default runtime source, fallback, migration source, and emergency backup.
- Emergency backup is available before any rehearsal step.

## Rehearsal Steps

- [ ] Start with local app available in `localStorage` primary mode.
- [ ] Run the local-to-cloud dry run first.
- [ ] Confirm owner check required and owner scope matches the signed-in account.
- [ ] Confirm schema validation required before treating cloud data as a pull candidate.
- [ ] Confirm cloud pull does not auto-apply.
- [ ] Confirm manual confirmation required before any future apply.
- [ ] Confirm `localStorage` unchanged after the pull candidate read.
- [ ] Confirm source-of-truth unchanged after the pull candidate read.
- [ ] Confirm emergency backup available after the pull candidate read.
- [ ] Abort if owner mismatch, schema mismatch, missing backup, or conflict is detected.

## Expected Result

- Pull candidate may be inspected.
- Applied status remains false.
- `localStorage` unchanged is true.
- Source-of-truth changed is false.
- Manual confirmation remains required before any later apply behavior.

## Blocked

- No automatic cloud apply.
- No silent overwrite of local data.
- No real cloud write from automated tests.
- No default cloud sync.
- No background sync.
- No new route.
- No package or lockfile change.

Recommended next rehearsal: Personal Cloud Push Rehearsal.
