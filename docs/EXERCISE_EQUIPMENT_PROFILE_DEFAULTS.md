# Exercise Equipment Profile Defaults V1

## Task Identity

- Task 17C.
- Exercise Equipment Profile Defaults V1.
- Pure profile/default mapping.
- No UI integration.

## Baseline Evidence

- Task 17B complete.
- PR #264.
- Merge commit: `0c1e1a6a06f520089e04d7d8fc19be86b2205e12`.
- `npm test` passed: 1083 files / 4397 tests.
- dist token scan clean.
- Task 17B implemented pure equipment-aware load model and feasible load engine.

## Non-Goals

Task 17C does not:

- Modify App.tsx.
- Modify live recommendation UI.
- Modify training algorithm.
- Modify warmup algorithm directly.
- Modify PR/e1RM/effective-set calculations.
- Migrate historical workout data.
- Change source-of-truth behavior.
- Add routes.
- Add cloud sync.
- Add package/dependency/script/lockfile changes.

## What Task 17C Adds

- Default equipment profile factory.
- Exercise-to-equipment default mapping.
- Pure lookup helpers.
- Alias/name normalization.
- Safe unknown/custom fallback.
- Fresh profile copies so caller mutation does not leak into shared defaults.

## User-Specific Defaults

- Olympic barbell 45 lb.
- Smith machine 25 lb.
- Plates 2.5 / 5 / 10 / 25 / 45.
- Dumbbell increment 5 lb.
- Barbell display total + per-side plates.
- Dumbbell display per-hand.
- Selectorized machine machine-specific options.
- Plate-loaded optional base/sled weight.
- Cable stack machine-specific options.

## Exercise Coverage

### Barbell

- Bench Press.
- Flat Bench Press.
- Barbell Bench Press.
- Squat.
- Back Squat.
- Front Squat.
- Romanian Deadlift.
- RDL.
- Deadlift.
- Conventional Deadlift.
- Barbell Row.
- Bent Over Row.
- Overhead Press.
- Barbell Shoulder Press.

### Smith Machine

- Smith Machine Bench Press.
- Smith Machine Squat.
- Smith Machine Shoulder Press.
- Smith Machine Incline Press.

### Dumbbell

- Dumbbell Bench Press.
- DB Bench Press.
- Dumbbell Incline Press.
- Dumbbell Shoulder Press.
- Dumbbell Row.
- One Arm Dumbbell Row.
- Dumbbell Curl.
- Hammer Curl.
- Dumbbell Lateral Raise.
- Dumbbell Romanian Deadlift.
- Dumbbell Fly.

### Selectorized / Pin-Loaded Machine

- Lat Pulldown.
- Seated Row Machine.
- Machine Chest Press.
- Chest Press Machine.
- Shoulder Press Machine.
- Leg Extension.
- Leg Curl.
- Seated Leg Curl.
- Lying Leg Curl.
- Hip Abductor.
- Hip Adductor.
- Pec Deck.
- Rear Delt Machine.
- Biceps Curl Machine.
- Triceps Extension Machine.

### Plate-Loaded Machine

- Leg Press.
- Hack Squat.
- Plate Loaded Chest Press.
- Hammer Strength Chest Press.
- Plate Loaded Row.
- Hammer Strength Row.
- Plate Loaded Shoulder Press.
- Calf Raise Machine.
- Seated Calf Raise.
- Belt Squat.

### Cable Stack

- Cable Row.
- Cable Seated Row.
- Cable Triceps Pushdown.
- Triceps Pushdown.
- Cable Curl.
- Cable Fly.
- Cable Lateral Raise.
- Face Pull.
- Cable Crunch.
- Rope Pushdown.

### Bodyweight

- Push Up.
- Pull Up.
- Chin Up.
- Dip.
- Plank.
- Bodyweight Squat.
- Walking Lunge.
- Sit Up.
- Crunch.

### Assisted Bodyweight

- Assisted Pull Up.
- Assisted Dip.
- Assisted Chin Up.

### Unknown/Custom

- Any exercise not found maps to unknown/custom.

## Unknown/Custom Handling

- Unknown exercises are safe.
- Unknown exercise lookup does not crash.
- The returned profile is marked unknown/custom.
- Later UI should ask user to configure equipment profile.
- No source-of-truth change happens in Task 17C.

## How This Should Be Used Later

- Task 17C creates defaults only.
- Task 17D should connect defaults to recommendation display.
- Task 17E should add profile editing UX.
- Historical data must not be migrated by this task.
- Live recommendation behavior should not change until a later integration task.

## Recommended Next Tasks

- Task 17D — Equipment-Aware Training Recommendation Display V1.
- Task 17E — Equipment Profile Editing UX V1.
- Task 17F — Phase 17 Equipment-Aware Load Model Archive V1.

Task 17D is recommended next.

Task 17D is not started by Task 17C.

## Preserved Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- localStorage remains default / fallback / migration / emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- no default cloud sync.
- no background sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no normalized training tables.
- no destructive migration.
- no real personal training data in tests.
- no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.

## Accepted Browser Mutation Route Inventory

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

- No eighth browser mutation route was added.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.

## Final Statement

- Task 17C does not start Task 17D.
- Task 17C does not authorize UI integration.
- Task 17C does not change training algorithm output.
- Task 17C does not change warmup algorithm output directly.
- Task 17C does not change source-of-truth behavior.
- SaaS remains deferred.
- Personal-only direction remains active.
