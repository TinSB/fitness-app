# Matt Pocock Skills Installation

## Summary

Installed repo-local `mattpocock/skills` support for the IronPath workflow without changing production runtime code, training algorithms, persistence, AppData schema, routes, cloud behavior, package scripts, package dependencies, or lockfiles.

The upstream installer was run with:

```bash
npx skills@latest add mattpocock/skills
```

The installer detected Codex and installed the upstream bundle non-interactively. The repo-local installation was then trimmed to the IronPath-approved skills only.

## Installed Skills

- `/setup-matt-pocock-skills` - repo-level issue tracker, triage, and domain docs setup.
- `/grill-with-docs` - structured questioning before product or architecture changes.
- `/to-prd` - converts accepted product direction into a PRD.
- `/to-issues` - breaks a PRD or plan into small GitHub-ready issues.
- `/tdd` - supports IronPath's test-first and regression-lock workflow.
- `/diagnose` - supports focused bug/debug loops before patching.
- `/improve-codebase-architecture` - supports architecture governance and refactor planning.
- `/zoom-out` - explains local changes in broader system context.
- `/handoff` - preserves context when a long implementation conversation needs a handoff.

## Skipped Skills

The installer initially fetched the full upstream bundle, then the following skills were removed because they were not requested for IronPath and would broaden the workflow surface:

- `/prototype`
- `/caveman`
- `/grill-me`
- `/triage`
- `/write-a-skill`

The request also explicitly excluded unrelated install targets such as `/setup-pre-commit`, `/git-guardrails-claude-code`, `/migrate-to-shoehorn`, and `/scaffold-exercises`; those were not installed.

## Setup Choices

- Issue tracker: GitHub Issues for `TinSB/fitness-app`.
- Triage labels: use existing labels where available. `question` maps to `needs-info`, `wontfix` maps to `wontfix`, and missing workflow labels are documented as suggestions only.
- Docs location: `docs/`.
- ADR location: `docs/adr/` when an ADR is needed.
- Existing docs were not moved or overwritten.
- `/setup-matt-pocock-skills` is prompt-driven rather than a deterministic script. Its setup instructions were applied using the choices above.

## Files Added Or Changed

- `.agents/skills/` - repo-local approved skill copies.
- `skills-lock.json` - lock metadata for the approved installed skills.
- `AGENTS.md` - added the `Agent skills` block.
- `docs/agents/issue-tracker.md` - GitHub issue tracker conventions.
- `docs/agents/triage-labels.md` - IronPath label mapping and suggested missing labels.
- `docs/agents/domain.md` - single-context domain docs layout and consumer rules.
- `docs/MATTPOCOCK_SKILLS_INSTALLATION.md` - this installation record.
- `tests/mattpocockSkillsInstallation.test.ts` - static regression checks for the install boundary.

## How To Use In IronPath

- Use `/grill-with-docs` before ambiguous product changes that need user decisions.
- Use `/to-prd` after product direction is clear and needs a durable written spec.
- Use `/to-issues` to split a PRD into small implementation tasks.
- Use `/tdd` when a task needs regression-first implementation.
- Use `/diagnose` before patching unclear bugs or failures.
- Use `/improve-codebase-architecture` for architecture reviews and boundary decisions.
- Use `/zoom-out` when explaining how a local patch fits the larger system.
- Use `/handoff` when the implementation context is too long and needs a concise transfer.

## Boundaries

This installation is tooling and documentation only. It does not change app runtime behavior, training logic, warmup logic, source-of-truth behavior, persistence behavior, AppData schema, routes, cloud behavior, package dependencies, package scripts, or lockfiles.

UI-OS 10A - Real Gym Use Acceptance & Bug Intake V1 remains the recommended next product task and was not started by this installation.
