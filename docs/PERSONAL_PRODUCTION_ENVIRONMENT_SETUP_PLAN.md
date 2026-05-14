# Personal Production Environment Setup Plan

This plan describes manual setup for the user's own personal production-candidate environment. It does not add deployment config, read real secrets, connect to Supabase, or change runtime defaults.

## Setup Checklist

- [ ] Confirm work starts from clean `main` after Phase 13 final merge `e50729ac4e6a844c6d874c936acc66b80199ee6d`.
- [ ] Create a real Supabase project manually outside the repo if the user chooses to rehearse a real candidate environment.
- [ ] Classify the Supabase project URL manually as production-candidate before use.
- [ ] Classify the Supabase anon key manually as browser-safe.
- [ ] Keep service role outside the browser and outside committed files.
- [ ] Do not commit `.env` files.
- [ ] Configure auth callback URLs manually outside the repo.
- [ ] Use a synthetic/manual test account first.
- [ ] Do not use real personal training data until acceptance passes.
- [ ] Keep emergency local mode available before any cloud rehearsal.

## Environment Roles

- Local: development and synthetic checks only.
- Preview: candidate/read-only checks only.
- Production-candidate: owner-only manual verification and rehearsals only.
- Production: not launched in Phase 14.
- Emergency-local: always available and localStorage-primary.

## Candidate Controls

- Backend/cloud candidate remains explicit opt-in.
- Cloud pull remains manual and does not auto-apply.
- Cloud push requires manual confirmation.
- Rollback / kill switch must remain available.
- No production deployment auto-start is allowed.
- No external monitoring upload is allowed.

## Repo Safety

- No package dependency changes.
- No package script changes.
- No lockfile changes.
- No generated `dist` committed.
- No route changes.
- No real secrets committed.
- No real Supabase project data in automated tests.

Recommended next pack after merge: Pack 14B — Supabase Project / Auth Callback Manual Verification.
