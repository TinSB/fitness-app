# Phase 18A - Engine-in-the-Loop Training Automation Entry Gate V1

## Product thesis

IronPath is not just a logging app.

IronPath should become a local deterministic training decision system. The bottom-layer training engines should participate in workout decisions before training, during Focus mode, after a completed workout, and across weekly progression, while keeping the user in control of durable changes.

Phase 18A is an entry gate. It defines the product and technical contract only. It does not implement runtime automation, redesign UI, change training algorithms, change persistence, or change AppData schema.

## Non-goals

Phase 18A explicitly forbids:

- SaaS/multi-user runtime.
- Default cloud sync.
- Background sync.
- Automatic cloud pull/apply.
- Production backend auto-start.
- Destructive migration.
- Automatic plan mutation without confirmation.
- LLM/chat-style coach as the primary decision engine.
- Package/dependency/script/lockfile drift.
- AppData schema change in this entry task.
- Accepted browser mutation route changes.
- Focus state machine redesign.
- Training algorithm behavior changes.

## Automation levels

- Level 0 - Display only: show an existing value or calculation without suggesting an action.
- Level 1 - Suggest: recommend an action but do not prefill or change a draft.
- Level 2 - Prefill: fill an editable draft for the current workout surface only.
- Level 3 - Guarded apply: apply a user-confirmed action with explicit confirmation and reversible local context.
- Level 4 - Auto queued recommendation: queue a recommendation for later review, but do not apply it by default.
- Level 5 - Fully automatic plan mutation: change the long-term plan without user confirmation.

Phase 18 initial work may target Level 1-3. Level 4 may be designed but must remain disabled by default. Level 5 is blocked.

## Training lifecycle participation model

### Before workout / Today

The engine should help answer:

- What should I train today?
- Is today normal, conservative, deload, technique, or postpone?
- Are any exercises risky today?
- Is the current plan still appropriate?

Inputs may include recent session history, e1RM trend, effective sets, readiness/fatigue signals if available, missed sessions, equipment profile, prior performance quality, and data health issues.

Outputs should be structured:

- recommendation kind
- confidence
- reason codes
- suggested actions
- risk flags
- required user confirmation level

### During workout / Focus

After each recorded set, the engine should be able to recommend:

- next set load
- next set reps
- whether to increase or decrease load
- whether to hold load
- whether to stop the exercise
- whether to skip remaining warmup
- whether to avoid PR attempt
- whether to extend rest

During Focus, user-facing next-set decisions must use actionableLoad, not rawTheoreticalLoad. Focus remains low-distraction: normal state should show one actionable recommendation and keep explanations behind details.

### After workout

After workout completion, the engine should generate:

- next-time load suggestion
- volume adjustment suggestion
- deload warning
- exercise-level performance note
- plan change candidate

Phase 18A does not automatically mutate the long-term plan. Any future durable plan candidate must stay pending until the user confirms it.

### Weekly / mesocycle

Across weekly and mesocycle review, the engine should generate:

- weekly progression summary
- exercise bottleneck list
- fatigue / undertraining signals
- suggested next-week changes

Weekly recommendations may prepare candidates for review, but they must not become automatic durable plan mutations in Phase 18.

## Decision object contract

This is a proposed TypeScript-style contract in docs only. Do not implement this type in runtime in Phase 18A.

```ts
type EngineTrainingDecisionScope = 'today' | 'exercise' | 'set' | 'session' | 'week';
type EngineTrainingDecisionLevel = 0 | 1 | 2 | 3 | 4 | 5;

interface EngineTrainingDecision {
  id: string;
  scope: EngineTrainingDecisionScope;
  level: EngineTrainingDecisionLevel;
  recommendationKind: string;
  targetExerciseId?: string;
  targetSetId?: string;
  actionableLoad?: {
    value: number;
    unit: 'kg' | 'lb';
    source: 'equipment-aware';
  };
  plannedReps?: number;
  confidence: 'low' | 'medium' | 'high';
  reasonCodes: string[];
  userMessage: string;
  riskFlags: string[];
  requiresConfirmation: boolean;
  blockedReasons: string[];
  sourceEngineIds: string[];
  createdAt: string;
}
```

Contract rules:

- `rawTheoreticalLoad` is internal/detail-only and must not be the main UI, apply, or validation baseline.
- `actionableLoad` remains main UI/apply/validation baseline.
- `recordedLoad` is compared against actionableLoad for user-facing validation.
- A Level 2 prefill can fill an active workout draft but cannot save or complete a set by itself.
- A Level 3 guarded apply requires explicit user confirmation before a durable effect.
- Level 4 queueing may be designed, but it is off by default.
- Level 5 is blocked.

## Safety rules

Phase 18 automation must preserve:

- localStorage remains default/fallback/migration/emergency source.
- accepted browser mutation routes remain exactly seven:
  - `POST /data-health/issues/:issueId/dismiss`
  - `POST /history/:id/data-flag`
  - `POST /history/:id/edit`
  - `POST /sessions/start`
  - `POST /sessions/active/patches`
  - `POST /sessions/active/complete`
  - `POST /sessions/active/discard`
- `POST /data-health/repair/apply` remains outside the accepted browser mutation route allowlist.
- no default cloud sync.
- no background sync.
- no SaaS.
- no AppData schema change.
- no package or lockfile drift.
- no package script drift.
- actionableLoad remains main UI/apply/validation baseline.
- rawTheoreticalLoad remains internal/detail-only.
- Focus remains low-distraction.
- user confirmation required before durable plan mutation.
- durable long-term plan changes must be reversible or pending before confirmation.

## First implementation candidate recommendation

First implementation candidate: Focus Next Set Recommendation Engine V1.

This is the only recommended first implementation candidate.

Reasons:

- It gives the highest training value immediately.
- It uses existing set/session data.
- It keeps automation local and reversible.
- It can begin at Level 1 suggestion or Level 2 prefill without changing long-term plan schema.
- It directly makes the bottom engine participate in real workouts.
- It can use the existing actionableLoad contract, practical warmup policy, Focus state, and set anomaly rules without changing AppData.

Do not start with weekly AI coach.
Do not start with broad plan auto-rewrite.
Do not start with cloud sync.
Do not start with visual dashboard.
Do not start with chat assistant.
Do not start with large UI redesign.

## Implementation backlog

These are future tasks from Phase 18A. Phase 18B implemented the first pure engine, Phase 18C wires that engine into Focus UI as ephemeral state only, Phase 18D adds pure post-workout next-time recommendations, and Phase 18D.1 displays those completed-session suggestions without saving or applying them.

1. 18B - Focus Next Set Recommendation Engine V1
   - Implemented as a local deterministic pure engine that recommends the next set load/reps/action after a recorded Focus set.
   - Target Level 1 first, with Level 2 prefill only when the recommendation is clear and reversible.
   - Pure-engine only: no TrainingFocusView wiring, no persistence, no AppData schema change, no routes, and no session mutation.

2. 18C - Focus Next Set UI Integration V1
   - Implemented as a compact Focus UI cue labeled `下一组建议`.
   - Keep details collapsed and preserve a single primary action.
   - Recommendation display is ephemeral React UI state only; it is not persisted, not stored in AppData, not written to localStorage, and not included in backup/import/export.
   - Safe Level 2 recommendations may prefill the active draft after the user taps `套用`, but they do not save, complete, finish, or mutate the long-term plan.
   - User-facing copy avoids technical/internal terms such as engine, algorithm, automation, model, AI coach, intelligent recommendation, decision system, 引擎, 算法, 自动化, 模型, AI 教练, 智能推荐, 系统判断, and 决策系统.

3. 18D - Post-Workout Next-Time Recommendation V1
   - Implemented as a pure deterministic engine that returns exercise-level `下次建议` after a completed workout.
   - It can return concise outcomes such as `完成稳定，下次保持`, `完成稳定，下次小幅加重`, `有不适，先复查`, and `动作质量不足，先稳住`.
   - It does not persist recommendations, does not mutate AppData, does not change TrainingSession history completion, and does not mutate the long-term plan.
   - Guarded apply / pending recommendation storage remains deferred to 18G.

4. 18D.1 - Post-Workout Recommendation Display Integration V1
   - Implemented as display-only history detail UI labeled `下次建议`.
   - Recommendation display is ephemeral React UI state only: not persisted, not stored in AppData, not written to TrainingSession, not written to localStorage, and not included in backup/import/export.
   - The display does not apply to the plan, does not create ProgramAdjustmentDraft or PendingSessionPatch records, and does not add durable action buttons.
   - User-facing examples remain concise: `完成稳定，下次保持`, `完成稳定，下次小幅加重`, `有不适，先复查`, and `动作质量不足，先稳住`.

5. 18E - Today Training Readiness Decision V1
   - Implemented as a pure decision engine only.
   - It classifies normal/conservative/deload/technique/postpone states with concise copy such as `今天按计划`, `今天保守训练`, `今天降量`, `今天先稳住动作`, and `恢复优先，今天不硬练`.
   - It does not persist decisions, does not mutate AppData or TrainingSession, and does not create session patches or plan drafts.
   - It uses the 18G guarded contract only as an in-memory safety wrapper with `只影响本次，不改变计划`.
   - 18E.1 displays this result in Today without changing the decision algorithm.

6. 18E.1 - Today Readiness Display Integration V1
   - Implemented as derived and ephemeral display integration in the existing Today hero/decision area.
   - It improves Today display clarity with concise copy such as `今天按计划`, `今天保守训练`, `今天降量`, `今天先稳住动作`, `恢复优先，今天不硬练`, and `只影响本次，不改变计划`.
   - It does not persist decisions, does not write AppData or TrainingSession, does not create session patches or plan drafts, and does not auto-apply anything.
   - It keeps existing Today primary actions, recovery override, completed-session, data-health, and source-of-truth behavior intact.
   - 18F.1 weekly progression display remains deferred.

7. 18F - Weekly Progression Recommendation V1
   - Implemented as a pure weekly recommendation engine only.
   - It aggregates existing volume, plateau, quality, confidence, pain, and feedback signals into weekly progression summaries, bottlenecks, fatigue signals, and suggested next-week changes.
   - It can produce concise copy such as `下周可小幅推进`, `下周维持当前节奏`, `本周先控制风险`, `继续记录后再判断`, and `只生成候选，不改变计划`.
   - It does not change Progress or Plan UI yet, does not change Today or History runtime UI, and does not add routes.
   - It does not persist weekly recommendations, does not write AppData or TrainingSession, and does not write localStorage.
   - It does not create ProgramAdjustmentDraft or PendingSessionPatch records and does not apply session patches or plan adjustments.
   - Its guarded contracts are in-memory only review wrappers; future plan candidates remain review-only and cannot apply durably in 18G.

8. 18F.1 - Weekly Progression Display Integration V1
   - Implemented as display-only integration on Progress metrics and Plan.
   - It shows the 18F result as `下周建议` without changing the weekly recommendation rules.
   - It can show concise states such as `下周可小幅推进`, `下周维持当前节奏`, `本周先控制风险`, `继续记录后再判断`, `查看后再决定`, and `不改变计划`.
   - It uses 18F guarded recommendations as in-memory passive previews only; guarded recommendations stay in-memory passive previews.
   - It does not persist weekly recommendations, does not write AppData or TrainingSession, and does not write localStorage.
   - It does not create ProgramAdjustmentDraft or PendingSessionPatch records.
   - It does not apply session patches, apply plan adjustments, modify templates, add routes, or change source-of-truth behavior.
   - Durable weekly apply behavior remains deferred to a later confirmed task.

9. 18G - Guarded Apply / Pending Recommendation Contract V1
   - Implemented as a contract-only, pure-engine layer that normalizes Focus, post-workout, Today, weekly, coach-action, and manual recommendations into in-memory guarded recommendation candidates.
   - 18G does not persist pending recommendations, does not apply to the plan, does not write AppData or TrainingSession, and does not create ProgramAdjustmentDraft or PendingSessionPatch records.
   - 18G keeps Level 5 blocked. Level 4 may exist only as review metadata and cannot apply durably.
   - Future tasks may use this contract to bridge Focus prefill, post-workout next-time display, Today readiness, weekly progression, existing session patches, and existing plan adjustment drafts.
   - Clean copy examples: `待确认`, `查看后再决定`, `只影响本次`, `不改变计划`, `下次建议`, and `下一组建议`.

## PRD synthesis

Problem statement: IronPath already records training and contains deterministic engines, but those engines do not yet participate enough in real training decisions. The user needs the app to become an engine-assisted training decision system while preserving personal-only, local-first, training-first boundaries.

Solution: Define a staged automation contract where engines can suggest, prefill, and guarded-apply workout decisions without changing source-of-truth, persistence, AppData, routes, cloud behavior, or package dependencies. Start with Focus Next Set Recommendation Engine V1 because it has immediate workout value and can stay local and reversible.

User stories:

1. As a lifter starting a workout, I want IronPath to tell me what to train today, so that I do not need to infer the plan from logs.
2. As a lifter in Focus mode, I want IronPath to recommend my next set, so that the engine helps during the real workout.
3. As a lifter after recording a set, I want the next recommendation to use feasible gym weight, so that I do not execute an impossible theoretical load.
4. As a lifter after a workout, I want next-time suggestions, so that progression is easier to apply later.
5. As a lifter reviewing a week, I want bottlenecks and fatigue signals, so that next-week changes are evidence-based.
6. As the app owner, I want all durable plan mutations to require confirmation, so that automation cannot silently rewrite my plan.

Testing decisions:

- Phase 18A uses static tests only.
- Later engine work should test deterministic public engine interfaces before UI integration.
- Focus integration tests should verify behavior through rendered output and state transitions, not private helpers.
- Boundary tests must continue to lock source-of-truth, accepted browser mutation routes, package drift, and actionableLoad baseline.

Out of scope:

- Runtime automation implementation.
- GitHub Issues creation.
- UI redesign.
- Cloud sync.
- Chat coach.
- AppData schema changes.
- Package/dependency/script/lockfile changes.

## Handoff notes

Phase 18B status: implemented by a pure deterministic engine.

Phase 18C status: implemented as Focus UI integration only. It does not persist recommendations, does not change AppData schema, and does not automatically complete sets.

Phase 18D status: implemented as a pure post-workout next-time recommendation engine. It does not persist recommendations, does not create pending recommendation records, and does not mutate plans.

Phase 18D.1 status: implemented as post-workout display integration only. It keeps `下次建议` ephemeral in React state, visible only for the matching completed session detail, and it does not persist, apply, or sync the suggestion.

Phase 18G status: implemented as a pure guarded recommendation contract. It is contract-only, does not persist pending recommendations, does not apply to the plan, does not create ProgramAdjustmentDraft or PendingSessionPatch records, and keeps Level 5 blocked.

Suggested next skills for the next guarded recommendation task: `/grill-with-docs`, `/zoom-out`, `/tdd`, and `/handoff`.

The next task should define guarded apply / pending recommendation behavior. It should keep plan-change candidates pending and avoid route, cloud, persistence, and AppData schema drift unless that guarded contract explicitly approves a durable path.
