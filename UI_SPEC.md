# IronPath UI Spec

Last updated: 2026-04-28

## Product Feel

IronPath should feel like a polished, restrained, professional mobile training app. It should not feel like an admin dashboard, a dense analytics console, or a generic landing page.

The interface should be calm, direct, and task-focused. Each page answers one primary user question and avoids repeating content owned by another page.

## Visual Style

- Background: warm neutral app background, currently `bg-stone-100` / `bg-stone-50`.
- Surfaces: white or lightly tinted panels with subtle borders.
- Accent: emerald for primary status and primary actions.
- Supporting tones: slate for neutral, amber for experimental/caution, rose for danger, sky for informational plan/status surfaces.
- Radius: prefer `rounded-md`, `rounded-lg`, or `rounded-xl` according to existing UI tokens.
- Shadow: low-shadow cards only; avoid heavy decorative panels.
- Typography: compact product UI scale. Page titles use `uiTokens.typography.pageTitle`; section titles stay smaller and scannable.
- Icons: use `lucide-react` when an icon exists.

## Layout Rules

### Global Shell

- Use `AppShell` for the application frame.
- Desktop uses a fixed left navigation and optional right auxiliary sidebar.
- Mobile uses the top safe-area header and bottom navigation.
- Focus Mode may use an immersive shell that hides unrelated navigation.
- Do not center a narrow mobile column on desktop with empty space on the right.

### Page Layout

- Use `ResponsivePageLayout` as the default page wrapper.
- Use `PageHeader` for the page title and description.
- Use `PageSection` for grouped content.
- Use repeated `Card` only for repeated items or true framed surfaces.
- Do not nest cards inside cards.
- Prefer grouped sections over stacks of many unrelated floating cards.

### Desktop

- Main content should use the available workspace up to the product container width.
- Auxiliary content should be compact and secondary.
- Desktop layout should support scanning and repeated use.

### Mobile

- Mobile is the primary design target.
- Important actions must be reachable without horizontal scrolling.
- Bottom navigation and sticky action bars must not cover primary content.
- Inputs must remain at 16px or higher on mobile to avoid Safari zoom.
- Safe-area handling belongs in shared shell/modal components, not ad hoc page padding.

## Page Rules

### 今日

Purpose: decide whether to train today, what to train, and where to start.

Allowed:
- today decision panel
- start/resume CTA
- short workout preview
- readiness summary
- plan progress
- training mode switch

Not primary:
- full historical workout details
- long-term statistics
- PR trend panels
- full exercise metadata
- backup/restore

### 训练

Purpose: record the current workout.

Allowed:
- Focus Mode
- full workout page
- set logging
- rest timer
- substitution, discomfort, technique quality, load feedback
- save/end/discard flow

Not primary:
- long-term stats
- calendar
- plan version history
- health import

### 记录

Purpose: review what was trained before.

Allowed:
- calendar default
- history list
- workout detail drawer
- PR/e1RM
- statistics
- training record data management: delete, test, excluded, restore normal

Not allowed as primary:
- global backup/restore
- health import
- unit settings
- plan adjustment entry as the default surface

### 计划

Purpose: answer how the user will train in the future.

Allowed:
- current template
- cycle timeline
- this week's training days
- training day templates
- selected template detail
- adjustment suggestions with reason and impact
- experimental templates
- version history and rollback

Not allowed as primary:
- full workout history
- calendar
- PR trend dashboard
- Focus Mode controls
- health import
- backup/restore

### 我的

Purpose: settings center.

Allowed:
- personal data status
- screening entry
- unit settings
- health data import
- global backup/restore
- PWA/local-data explanation
- about

Not allowed as primary:
- today training recommendation
- workout logging controls
- training calendar
- plan day details
- PR trend panels

## Component Usage Rules

- Primary actions: `ActionButton variant="primary"`.
- Secondary actions: `ActionButton variant="secondary"` or `ghost`.
- Destructive actions: `ActionButton variant="danger"` plus `ConfirmDialog` when state will be deleted, overwritten, or excluded.
- Segmented page sections: `SegmentedControl`.
- Status labels: `StatusBadge`; labels must be short.
- Empty states: `EmptyState` with title, short explanation, and at most one clear action.
- Modals/sheets:
  - Mobile choice flows use `BottomSheet`.
  - Detail review/edit flows use `Drawer`.
  - Confirmation uses `ConfirmDialog`.
  - Toast feedback uses `Toast`.

## Interaction Rules

- Dangerous or overwrite actions require explicit confirmation.
- Plan changes must follow preview -> confirm -> apply by copy -> rollback.
- Rollback copy must state that completed workout records/history are preserved.
- Restore/import must state that current local data will be overwritten.
- Unit changes affect display/input; historical data remains normalized internally.
- Exercise metadata should be progressive:
  - default: name, movement pattern, primary muscle group, prescription summary, set type, weight/reps/RIR, rest
  - detail-only: technique standards, substitutions, regressions/progressions, fatigue cost, evidence tags, contribution weights

## Responsive Verification

For implementation work that touches UI, verify:

- Mobile: no horizontal scroll, no covered CTA, safe-area header/footer correct.
- Desktop: left nav visible, content uses width, auxiliary panel does not replace primary content.
- Focus Mode: current action visible and unrelated navigation hidden.
- Text: labels fit their containers without overlap.

