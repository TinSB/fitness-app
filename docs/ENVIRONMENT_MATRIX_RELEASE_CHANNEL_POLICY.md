# Environment Matrix & Release Channel Policy V1

Task 13.2 defines IronPath environment and release-channel policy. This is policy documentation only; it does not enable production runtime, cloud sync, deployment, or source-of-truth switching.

| Environment | localStorage-primary | backend-primary candidate | Supabase adapter candidate | cloud pull candidate | cloud push candidate | manual conflict resolution | monitoring candidate | production deployment candidate | real personal data | source-of-truth switch | cloud sync | background sync |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local | allowed | experiment only | fake/candidate only | candidate only | manual-confirmation only | allowed | redacted local only | blocked | blocked in tests | blocked by default | blocked | blocked |
| dev | allowed | experiment only | fake/candidate only | candidate only | manual-confirmation only | allowed | redacted local only | blocked | blocked in tests | blocked by default | blocked | blocked |
| preview | allowed | read-only/candidate checks only | candidate checks only | read-only candidate only | blocked | review only | redacted local only | blocked | blocked | blocked | blocked | blocked |
| production-candidate | allowed | explicit opt-in only | explicit opt-in only | candidate only | manual-confirmation only | allowed | redacted/internal only | candidate only, no auto-start | blocked in tests | blocked until later explicit phase | blocked | blocked |
| production | allowed | blocked until later explicit phase | blocked until later explicit phase | review-only until later explicit phase | blocked | review only | redacted/internal only | blocked until later explicit launch phase | allowed only by future accepted policy | blocked | blocked | blocked |
| emergency-local | required | disabled | disabled | disabled | disabled | local review only | redacted local only | blocked | local user-owned only | forced localStorage-primary | blocked | blocked |

## Policy

- local/dev may allow experiments, but only behind explicit candidate flags.
- preview may allow read-only/candidate checks only.
- production-candidate may allow manual-confirmation cloud candidate behavior.
- production remains blocked for source-of-truth/cloud sync until a later explicit phase.
- emergency-local must always be available.
- default cloud sync remains blocked.
- background sync remains blocked.
- cloud pull must not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.

Recommended next task: Task 13.3 Supabase Production Project Readiness Plan V1.
