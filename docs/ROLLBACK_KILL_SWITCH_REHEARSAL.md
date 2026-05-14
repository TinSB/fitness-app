# Rollback / Kill Switch Rehearsal

This runbook rehearses the personal production candidate rollback and kill switch path without deleting local data or overwriting cloud data.

## Preconditions

- `localStorage` fallback remains available.
- Emergency local mode remains available.
- Release rollback / kill switch controls exist from Phase 13.
- Cloud pull, cloud push, Supabase adapter, and backend-primary candidate are all reversible candidates.

## Rehearsal Steps

- [ ] Disable cloud pull.
- [ ] Disable cloud push.
- [ ] Disable Supabase adapter.
- [ ] Disable backend-primary candidate.
- [ ] Return to localStorage-primary.
- [ ] Force emergency-local mode.
- [ ] Confirm local data deleted remains false.
- [ ] Confirm cloud data overwritten remains false.
- [ ] Confirm manual conflict resolution remains manual.
- [ ] Confirm the local app remains usable after cloud candidate failure.

## Expected Result

- Cloud pull disabled is true.
- Cloud push disabled is true.
- Supabase adapter disabled is true.
- Backend-primary disabled is true.
- Emergency-local mode forced is true.
- `localStorage` primary restored is true.

## Blocked

- No reset/recovery HTTP route.
- No backup/import/export HTTP route.
- No local data deletion.
- No cloud overwrite.
- No public SaaS runtime.
- No package or lockfile change.

Recommended next rehearsal: Emergency Local Restore Rehearsal.
