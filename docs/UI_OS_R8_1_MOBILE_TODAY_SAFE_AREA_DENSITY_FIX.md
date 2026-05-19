# UI-OS R8.1 Mobile Today Safe-Area & Density Acceptance Fix

## Task Identity

UI-OS R8.1 is a mobile Today acceptance fix for the R8 implementation. R9 archive work is postponed until this fix passes.

Baseline evidence:

- UI-OS R8 complete.
- UI-OS R8 PR #288.
- UI-OS R8 merge commit `790872f215d77b63206aa8081f5cb4298dec2295`.
- R8 claimed Today compression, bottom nav auto-hide, theme surface parity, and duplicate information reduction.

## Acceptance Failure

The mobile screenshot showed the Today page still failing product acceptance:

- The fixed bottom nav overlapped the Today hero and start-training area.
- The primary `开始训练` action could be partially hidden behind the bottom nav.
- Recovery / fatigue content was pushed under the nav.
- Normal local-first safety copy still appeared as a large strip in the training flow.
- The Today hero explanation was too verbose.
- The first screen still carried too much information density.
- Today density needed a direct reduction, not another card-level restyle.

## R8.1 Fixes

R8.1 fixes the actual mobile layout and density issue rather than adding only source tests.

- The normal shell no longer renders a full local-first safety strip above every page.
- The shell scroll area reserves bottom-nav space with `env(safe-area-inset-bottom)` so Today content can scroll above the fixed nav.
- Stable markers lock the shell as bottom-nav aware and bottom-nav protected.
- The Today hero uses a compact mobile decision layout and semantic `training_hero` surface.
- Normal Today copy is concise: `状态正常，按计划执行。`
- Long recommendation reasoning remains behind the collapsed `为什么这样推荐？` detail.
- Normal local-first status is not shown as a full strip on Today.
- Source-unclear or severe states can still show warning surfaces.
- Normal recovery / fatigue is a compact badge row only.
- Risk, conservative, recovery, or high-fatigue states can still render a prominent recovery warning.
- The Today training preview is concise and uses a semantic UI-OS health surface, not an uncontrolled dark-flow white card.

## Boundaries

R8.1 does not change:

- training algorithms
- planning / rotation logic
- source-of-truth behavior
- AppData schema
- persistence behavior
- routes
- cloud behavior
- package dependencies
- package scripts
- lockfiles

The accepted browser mutation routes remain exactly seven. `POST /data-health/repair/apply` remains blocked. Cloud sync, default cloud sync, and background sync remain absent. `pnpm-lock.yaml` remains absent.

## Next Task

UI-OS R9 — Interaction OS Remediation Archive V1 is recommended after R8.1 passes acceptance.

UI-OS R9 is not started by R8.1.
