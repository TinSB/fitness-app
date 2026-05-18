# Equipment-Aware Training UI Integration V1

## Task identity

Task 17E — Equipment-Aware Training UI Integration V1.

This task integrates the existing equipment-aware display layer into live training UI surfaces as presentation-only output. It does not change training calculations, warmup policy, saved set values, session mutation payloads, or source-of-truth behavior.

## Task 17D baseline

Task 17D is complete:

- PR #266
- Merge commit `b6542bc2f51bd7ad448bff1fb3fb161234ae6256`
- npm test passed: 1088 files / 4431 tests
- dist token scan clean

Task 17D added the equipment-aware recommendation display helper and presentational `EquipmentAwareLoadDisplay` component.

## Integrated surfaces

- `TrainingView` set cards now show display-only equipment-aware feasible load copy beside each planned set.
- `TrainingFocusView` main warmup/working recommendation card now shows display-only equipment-aware feasible load copy under the existing recommendation summary.
- `EquipmentAwareRecommendationWeight` is the adapter used by both surfaces. It converts the existing planned kg value to lb for the equipment-aware display helper, because Phase 17 equipment defaults are lb-based.

## Deferred surfaces

- Today recommendation cards remain unchanged in Task 17E because they recommend sessions/templates rather than individual set loads.
- Profile persistence and custom equipment profile editing are deferred to Task 17F and later tasks.
- Historical record display is unchanged because Task 17E is about live recommendation display, not migrated history.

## Non-goals

Task 17E does not:

- change training algorithm
- change warmup algorithm directly
- change PR/e1RM/effective-set calculations
- change source-of-truth behavior
- change generated sets
- change saved set values
- change actual draft values
- change session mutation payloads
- migrate historical workout data
- add routes
- add cloud sync
- add package/dependency/script/lockfile changes

## Display examples

| Scenario | Display path |
| --- | --- |
| Bench Press warmup 17 lb | 45 lb empty Olympic bar / 空杆 45 lb |
| Bench Press 135 lb | 135 lb total + 每边 45 lb |
| Bench Press 115 lb | 115 lb total + 每边 35 lb + 每边 25 + 10 |
| Dumbbell Bench Press 42 lb | per-hand dumbbell display / 每只手 40 或 45 lb |
| Lat Pulldown | selectorized machine stack / 插片重量 |
| Plate-loaded machine with unknown base | show base/sled warning / 器械自重未计入 |
| Unknown/custom exercise | safe fallback warning / 未知器械档案，建议之后配置器械 |

## Safety boundaries

- localStorage remains default/fallback/migration/emergency.
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

## Accepted browser mutation route inventory

Exactly seven browser mutation routes remain accepted:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

No eighth browser mutation route was added. `POST /data-health/repair/apply` remains blocked. backup/import/export over HTTP remains blocked. reset/recovery over HTTP remains blocked.

## Recommended next task

Task 17F is recommended next. Task 17F — Equipment Profile Editing UX V1 is recommended next. Task 17F is not started by Task 17E.
