# Training Intelligence V1 Plan

Last updated: 2026-04-28

This document defines Training Intelligence V1 for IronPath. It is a planning document only. V1 must stay local-first, explainable, dismissible, and non-mutating by default.

## Goals

Training Intelligence V1 answers five coaching questions:

1. How good was this workout?
2. How trustworthy is the current recommendation?
3. Is a lift or exercise likely plateauing?
4. Which muscles should increase, decrease, or maintain training volume?
5. Which findings are strong enough to enter Program Adjustment Preview?

V1 should turn existing training data into coach-style analysis without changing the underlying training system.

Non-goals:
- No diet module.
- No backend, login, cloud sync, or server-side jobs.
- No automatic plan overwrite.
- No automatic history edit or deletion.
- No medical diagnosis.
- No changes to e1RM, effectiveSet, readiness, progression, or warmupPolicy core calculation principles.

## Shared Intelligence Contract

All Training Intelligence engines should produce analysis and suggestions, not mutations.

Suggested common shape:

```ts
type TrainingIntelligenceFinding = {
  id: string;
  category:
    | 'session_quality'
    | 'recommendation_confidence'
    | 'plateau'
    | 'volume_adaptation'
    | 'program_adjustment_candidate';
  severity: 'info' | 'watch' | 'important';
  title: string;
  summary: string;
  explanation: string;
  evidence: string[];
  confidence: 'low' | 'medium' | 'high';
  displayOnly: boolean;
  canEnterProgramAdjustmentPreview: boolean;
  requiresUserConfirmation: boolean;
  relatedSessionId?: string;
  relatedExerciseId?: string;
  relatedMuscleId?: string;
};
```

Rules:
- `title`, `summary`, `explanation`, and `evidence` must be user-facing Chinese when shown in UI.
- No raw enum, internal id, `undefined`, or `null` may appear in visible text.
- Findings may link to existing Record, Plan, or Program Adjustment Preview flows.
- Findings must not directly modify `AppData`.
- All suggestions must be ignorable.

## Engines

### 1. sessionQualityEngine

Purpose:
Evaluate the quality and reliability of a completed training session.

Inputs:
- Completed `TrainingSession`
- Saved set logs grouped by exercise and set type
- Existing effective set result
- Existing PR/e1RM outputs if available
- Technique quality, RIR, painFlag, notes
- Planned prescription for the session/template
- `unitSettings`
- `dataFlag`

Outputs:
- `SessionQualityReport`
- Session quality label: high, acceptable, mixed, low, or insufficient data
- Completion quality signals:
  - planned vs completed working sets
  - effective set count using existing effectiveSet rules
  - volume completion
  - effort consistency
  - technique quality
  - pain/discomfort signal
  - data confidence
- Findings that can be shown in Record session detail and Training summary.

Boundaries:
- Does not change effectiveSet calculation.
- Does not change PR/e1RM calculation.
- Does not mark data as excluded/test.
- Does not edit any set.
- Does not diagnose pain or injury.

Display-only results:
- Session quality label.
- Short explanation in history detail.
- Data confidence warning for incomplete set logs.

Can enter Program Adjustment Preview:
- Repeated low-quality sessions for the same muscle or exercise.
- Repeated painFlag or poor technique on the same movement pattern.
- Repeated missed target volume due to fatigue or time.

Requires user confirmation:
- Editing historical sets.
- Marking a session as test/excluded.
- Applying any plan adjustment based on session quality.

### 2. recommendationConfidenceEngine

Purpose:
Explain whether a recommendation is based on strong data or should be treated as a conservative/default suggestion.

Inputs:
- `RecommendationTrace`
- `DataHealthReport`
- Recent normal training history depth
- Readiness recency and health data freshness
- Load feedback coverage
- Training level confidence
- Pain pattern and technique quality signals
- Current template/session context

Outputs:
- `RecommendationConfidenceReport`
- Confidence label: low, medium, high
- Missing-data reasons
- Data-quality warnings
- Short explanation suitable for Today, Plan, and Training preview.

Boundaries:
- Does not change the recommendation.
- Does not change readiness or training level.
- Does not hide a recommendation.
- Does not auto-correct data health issues.

Display-only results:
- "推荐可信度" badge.
- Explanation such as "近期记录较少，因此建议偏保守。"
- Warning when data health issues may reduce confidence.

Can enter Program Adjustment Preview:
- Low confidence may prevent an aggressive adjustment from being preselected.
- High confidence may allow a finding to be shown as a stronger candidate.

Requires user confirmation:
- Any action that changes data status, history, unit settings, or plan templates.

### 3. plateauDetectionEngine

Purpose:
Detect likely exercise plateaus using existing historical performance signals.

Inputs:
- Normal training history only
- Exercise-level set logs by `actualExerciseId`
- Existing e1RM trend
- Reps, load, volume, and completion trend
- Load feedback
- Technique quality
- painFlag/painPattern
- Training level
- Exercise metadata and movement pattern

Outputs:
- `PlateauDetectionReport`
- Per-exercise status:
  - no plateau
  - possible plateau
  - likely plateau
  - insufficient data
  - masked by pain/technique
- Evidence window and explanation.

Boundaries:
- Does not recalculate e1RM principles.
- Does not declare plateau from one bad session.
- Does not treat warmup sets as performance evidence.
- Does not use test/excluded sessions.
- Does not automatically deload or change exercises.

Display-only results:
- Exercise plateau status in Record/Plan.
- "数据不足，暂不判断平台期" when needed.

Can enter Program Adjustment Preview:
- Likely plateau with enough normal data.
- Plateau plus repeated too_heavy feedback.
- Plateau masked by technique/pain should enter as "review exercise choice" rather than "increase volume."

Requires user confirmation:
- Any deload-like plan change.
- Any exercise substitution.
- Any volume change.

### 4. volumeAdaptationEngine

Purpose:
Suggest muscle-level volume direction based on existing weekly volume, effective sets, session quality, recovery, and adherence.

Inputs:
- Weekly volume summary
- Muscle contribution model
- Existing effective set outputs
- Recent normal session history
- Session quality reports
- Readiness trend
- painPattern
- loadFeedback summary
- Primary goal and training mode
- Current program template

Outputs:
- `VolumeAdaptationReport`
- Per-muscle direction:
  - increase
  - maintain
  - decrease
  - review
  - insufficient data
- Reason, impact, and confidence.
- Candidate changes for Program Adjustment Preview.

Boundaries:
- Does not rewrite the plan.
- Does not change muscle contribution rules.
- Does not change effectiveSet logic.
- Does not force fat loss into low reps or hypertrophy into all-out sets.
- Does not use test/excluded sessions.

Display-only results:
- Muscle-level "增量 / 维持 / 减量 / 复查" recommendations.
- Short evidence such as "本周胸部有效组偏少，但动作质量稳定。"

Can enter Program Adjustment Preview:
- Add/remove 1-2 support sets.
- Shift accessory emphasis.
- Suggest reviewing high-pain movement patterns.
- Suggest maintaining when data is stable.

Requires user confirmation:
- Applying any volume change.
- Creating or switching to an experimental template.
- Rolling back an experimental template.

### 5. trainingIntelligenceSummaryEngine

Purpose:
Aggregate the intelligence engines into a concise, surface-aware summary.

Inputs:
- `SessionQualityReport[]`
- `RecommendationConfidenceReport`
- `PlateauDetectionReport`
- `VolumeAdaptationReport`
- `DataHealthReport`
- `RecommendationTrace`
- Current route/surface context
- Existing Program Adjustment Preview state if present

Outputs:
- `TrainingIntelligenceSummary`
- Top 1-3 findings for Today/Training/Record/Plan
- Program Adjustment Preview candidates
- Display-only analysis grouped by surface.

Boundaries:
- Aggregates only; no new training algorithm.
- Does not mutate `AppData`.
- Does not bypass Coach Automation boundaries.
- Does not directly apply program changes.
- Does not replace RecommendationTrace; it consumes trace where needed.

Display-only results:
- Today: recommendation confidence and one important training insight.
- Training: compact current-session confidence/quality hint only.
- Record: session quality and plateau evidence.
- Plan: volume adaptation candidates and program preview entry.

Can enter Program Adjustment Preview:
- Deduplicated, explainable candidates from plateau and volume adaptation.
- Session-quality findings when repeated and supported by enough data.

Requires user confirmation:
- Any transition from "candidate" to "applied program adjustment."

## Display-Only Results

These results are analysis only:
- Single-session quality label.
- Recommendation confidence badge.
- Insufficient-data messages.
- Plateau "possible" status.
- Muscle volume "review" status.
- Data confidence warnings.
- Evidence summaries.

They can open detail views, but they must not write to history, templates, settings, or analytics outputs.

## Program Adjustment Preview Candidates

Allowed to enter preview:
- Repeated low-quality sessions for a specific exercise/muscle.
- Likely plateau with enough normal history.
- Volume increase/decrease/maintain suggestions with clear evidence.
- Repeated pain/technique issues that suggest reviewing exercise selection.
- High-confidence recommendation findings tied to existing weekly program adjustment workflow.

Not allowed to enter preview directly:
- One-off bad session.
- Test/excluded session data.
- Imported external workouts as direct strength prescription changes.
- Low-confidence findings without enough evidence.
- Medical-style pain conclusions.

Program Adjustment Preview must still use the existing preview / confirm / apply-by-copy / rollback workflow.

## User Confirmation Required

The user must confirm:
- Any plan adjustment.
- Creating or switching to an experimental template.
- Rolling back to an original template.
- Editing history.
- Marking sessions or health data as test/excluded.
- Restoring data to normal.
- Replacing exercises in an active session.
- Any action that affects future prescriptions.

## Protected Core Algorithms

Training Intelligence V1 must not modify:
- `e1RM` calculation principles.
- `effectiveSet` calculation principles.
- `readiness` calculation principles.
- `progression` rules.
- `warmupPolicy`.
- `muscleContribution` rules.
- `loadFeedback` classification rules.
- Training template generation and session building rules.

Engines may consume existing outputs from these systems but must not redefine them.

## Recommended Implementation Order

P0 order:
1. `sessionQualityEngine`
2. `recommendationConfidenceEngine`
3. `trainingIntelligenceSummaryEngine` read-only aggregation
4. Minimal Record/Today/Plan surfacing of display-only findings
5. Program Adjustment Preview candidate handoff, without applying changes

P1 order:
1. `plateauDetectionEngine`
2. `volumeAdaptationEngine`
3. Richer Plan integration with existing program adjustment workflow
4. Focus Mode compact confidence/quality hints if they do not interrupt logging
5. Fixture-based two-month training history regression tests

## P0 / P1 Scope

P0:
- Session quality from saved history.
- Recommendation confidence from existing trace and data quality.
- Read-only summary aggregation.
- Clear "display only" vs "preview candidate" separation.
- Tests proving no mutation and no raw enum visible text.

P1:
- Plateau detection.
- Muscle-level volume adaptation.
- Program Adjustment Preview candidate generation.
- Broader UI surfacing after engine confidence is proven.

## Testing Strategy

Engine tests:
- Same input produces the same report.
- Inputs are not mutated.
- Test/excluded data is ignored for analytics-like findings.
- Warmup sets do not count as PR/e1RM/effectiveSet evidence.
- Findings use Chinese visible text and no raw enum/internal id.
- Insufficient data returns conservative "insufficient data" instead of overclaiming.

Fixture tests:
- Clean beginner with sparse history.
- Intermediate user with stable progress.
- User with likely plateau.
- User with pain/technique issues.
- User with test/excluded records.
- User with imported Apple Watch workouts but no strength history pollution.

Integration tests:
- Record shows session quality without editing history.
- Today shows recommendation confidence without changing recommendation.
- Plan shows preview candidates without applying them.
- Program Adjustment Preview still requires confirmation and preserves rollback.

Regression tests:
- e1RM, effectiveSet, readiness, progression, warmupPolicy, and muscle contribution outputs remain unchanged for existing fixtures.
- No Training Intelligence engine writes to `AppData`.
- No UI shows raw enum, internal id, `undefined`, or `null`.
