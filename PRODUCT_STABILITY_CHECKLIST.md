# IronPath Product Stability Checklist

This checklist freezes the existing product surface for the current stabilization pass. It is not a feature plan and does not authorize new modules, new engines, backend work, or training algorithm changes.

## Training Flow

- [ ] Start training from Today / Training entry points.
- [ ] Continue an active training session.
- [ ] Complete one set in Focus Mode.
- [ ] Adjust weight, reps, and RIR before saving a set.
- [ ] Apply the suggested prescription to the current set draft.
- [ ] Copy the previous set.
- [ ] Mark and unmark pain or discomfort.
- [ ] Open replacement actions and select a replacement exercise.
- [ ] Keep replacement exercise identity stable through session completion.
- [ ] Record warmup sets.
- [ ] Record working sets.
- [ ] Record support work, correction blocks, and functional support blocks.
- [ ] Use rest timer without blocking the current set controls.
- [ ] Complete training and save it into history.

## Record And History

- [ ] Open history detail from Record.
- [ ] See warmup sets and working sets in separate sections.
- [ ] Edit a historical training record.
- [ ] Save historical corrections with confirmation.
- [ ] Keep edited history visible with a lightweight edited marker.
- [ ] View training calendar.
- [ ] Keep PR and e1RM analytics available.
- [ ] Keep effective set analytics available.

## Plan And Program

- [ ] View plan templates and training days.
- [ ] Use experimental templates as distinct copies.
- [ ] Roll back from an experimental template to the original plan.
- [ ] Keep plan adjustments behind preview and confirmation.

## Data And Settings

- [ ] Import health data through CSV, JSON, and Apple Health XML.
- [ ] Review Data Health issues without automatic mutation.
- [ ] Use recommendation explanations from Today / Training / Plan.
- [ ] Change unit settings.
- [ ] Export backup data.
- [ ] Import or restore backup data with confirmation.
- [ ] Open screening from My.

## Stability Rules For This Pass

- [ ] Do not add diet, backend, cloud sync, new pages, or new engines.
- [ ] Do not change e1RM, effectiveSet, readiness, progression, or warmupPolicy core algorithms.
- [ ] Do not change the core training plan logic.
- [ ] Do not delete or hide existing features listed above.
- [ ] Do not show raw enum values, internal ids, `undefined`, or `null` in user-visible UI.
- [ ] Use ConfirmDialog for confirmation, Toast or inline notice for feedback, and avoid browser-native dialogs.
- [ ] Keep Today concise: train or recover, what to do, and where to start.
- [ ] Keep Plan future-facing and My as the settings/data center.
