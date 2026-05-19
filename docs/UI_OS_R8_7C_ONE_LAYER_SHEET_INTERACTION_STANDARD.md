# UI-OS R8.7C One-Layer Sheet Interaction Standard

## Task Identity

- UI-OS R8.7C
- One-Layer Sheet Interaction Standard V1
- Implementation task after UI-OS R8.7B practical warmup refinement.

## Why R8.7C Exists

R8.6 fixed Focus panel dismissal and practical warmup behavior, but the training flow still needed one consistent mobile sheet rule. Training overlays should not stack into nested modal layers, should close from the blank backdrop or top handle, and should avoid visible close buttons as the default interaction.

## Interaction Standard

- Training flow uses at most one visible sheet or dialog layer at a time.
- More, switch exercise, replacement picker, recommendation basis, weight details, actual record, and end workout sheets support blank backdrop dismissal.
- Training sheets also support top-handle dismissal and Escape on desktop.
- Form interiors stay protected from accidental close; actual-record edits remain controlled draft state and dismissal does not write source-of-truth data.
- Non-form sheet blank space may close when safe.
- Visible `关闭` buttons are not the default training-sheet interaction.

## End Workout Confirmation

The end workout confirmation is one sheet with a direct title:

- `仍有未完成动作，是否结束训练？`
- `继续训练`
- `确认结束训练`

There is no nested confirm dialog and no long explanatory confirmation copy.

## Non-goals

- No source-of-truth behavior change.
- No persistence behavior change.
- No AppData schema change.
- No stored history migration or mutation.
- No route, cloud, package, script, or lockfile change.

## Boundary Confirmation

R8.7C changes only presentation and sheet dismissal behavior. Dismissing a sheet does not complete a set, save a set, mutate stored history, add routes, enable cloud sync, or change packages.

UI-OS R8.7D is recommended next and is not started by R8.7C.
