# IronPath Agent Instructions

You are working on IronPath, a mobile-first personal training PWA built with React, Vite, and TypeScript.

## Product Direction

IronPath must feel like a polished, restrained, professional mobile training app, not an admin dashboard, engineering demo, or data-heavy panel.

The app has five main navigation entries:

1. 今日
2. 训练
3. 记录
4. 计划
5. 我的

Each page has a strict responsibility:

- 今日 answers: should I train today, what should I train, where do I start?
- 训练 answers: how do I record the workout now?
- 记录 answers: what did I train before?
- 计划 answers: how will I train in the future?
- 我的 answers: where are my settings, screening, data, units, and backup?

## Design Principles

- Mobile first.
- Clean, restrained, professional.
- Do not create admin-style layouts.
- Do not create dense dashboard pages.
- Do not stack many cards.
- Do not repeat the same information across pages.
- Do not expose raw exercise metadata unless the user opens details.
- Focus Mode must hide unrelated navigation and long-term statistics.
- Desktop layouts must use the full workspace with main content and auxiliary panels.

## UI Rules

- Use consistent spacing, buttons, badges, cards, and list rows.
- Prefer grouped sections over many floating cards.
- Primary actions should be visually clear.
- Dangerous actions require confirmation.
- Status badges must be short.
- Empty states must include a title, short explanation, and one clear action.

## Exercise Data Display Rules

Default display only:
- exercise name
- movement pattern
- primary muscle group
- prescription summary
- set type
- weight / reps / RIR
- recommended rest

Collapsed or detail-only:
- technique standards
- substitutions
- regressions / progressions
- fatigue cost
- evidence tags
- muscle contribution weights

Never dump all exercise metadata into the main UI.

## Implementation Rules

- Preserve existing training logic unless explicitly asked.
- Prefer refactoring UI structure over changing business logic.
- Keep components reusable.
- Do not introduce large new dependencies without justification.
- After changes, run available typecheck, lint, and build commands if present.
- If unsure about existing code behavior, inspect the relevant files before editing.