# Auth Callback Manual Verification

This runbook defines manual auth callback verification for the personal production-candidate path. It does not add auth routes, provider callbacks, SDK code, or real secrets.

## Callback Checklist

- [ ] Verify local callback behavior with synthetic/manual test account only.
- [ ] Verify preview callback behavior as candidate/read-only only.
- [ ] Verify production-candidate callback behavior before any cloud rehearsal.
- [ ] Verify emergency local behavior does not require auth callback success.
- [ ] Confirm callback URL is HTTPS for production-candidate.
- [ ] Confirm localhost is not treated as production.
- [ ] Confirm preview URL is not treated as production.
- [ ] Confirm callback failure does not block local app usage.
- [ ] Confirm logout does not delete emergency backup.
- [ ] Confirm login does not upload local training data automatically.

## Callback Safety

- Auth callback verification is manual.
- Supabase Auth remains a candidate boundary.
- Auth success does not change source of truth.
- Auth failure keeps localStorage fallback available.
- No cloud pull applies automatically after login.
- No cloud push starts automatically after login.

## Blocked In This Pack

- No real OAuth route is added.
- No provider SDK dependency is added.
- No auth secret is committed.
- No real callback secret is read in tests.
- No production deployment is started.
- No cloud sync is enabled.

Recommended next pack after merge: Pack 14C — Personal Cloud Pull / Push + Rollback Rehearsal.
