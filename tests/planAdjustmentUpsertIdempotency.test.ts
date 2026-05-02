import { describe, expect, it } from 'vitest';
import {
  buildPlanAdjustmentDraftInstanceId,
  upsertPlanAdjustmentDraftByFingerprint,
} from '../src/engines/planAdjustmentIdentityEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';

const makeDraft = (
  overrides: Partial<ProgramAdjustmentDraft> = {},
): ProgramAdjustmentDraft => ({
  id: overrides.id || 'draft-random-a',
  createdAt: overrides.createdAt || '2026-05-01T10:00:00.000Z',
  status: overrides.status || 'ready_to_apply',
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: 'coach-action-back-volume',
  sourceRecommendationId: 'recommendation-back-volume',
  sourceFingerprint: overrides.sourceFingerprint || 'coach-action|volume|back|pull-a|add-sets',
  experimentalTemplateName: '拉 A 实验模板',
  title: '拉 A 下周实验调整',
  summary: '背部增加一组。',
  selectedRecommendationIds: ['recommendation-back-volume', 'coach-action-back-volume'],
  changes: [
    {
      id: 'change-back-add-set',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      dayTemplateName: '拉 A',
      exerciseId: 'lat-pulldown',
      exerciseName: '高位下拉',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部有效组偏低。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  explanation: '背部有效组偏低，先小幅增加。',
  notes: [],
  ...overrides,
});

describe('plan adjustment upsert idempotency', () => {
  it('creates the first same-source draft with a deterministic instance id', () => {
    const sourceFingerprint = 'coach-action|volume|back|pull-a|add-sets';
    const result = upsertPlanAdjustmentDraftByFingerprint([], [], makeDraft({ id: 'random-id' }), sourceFingerprint);

    expect(result.outcome).toBe('created');
    expect(result.drafts).toHaveLength(1);
    expect(result.createdDraft).toMatchObject({
      id: buildPlanAdjustmentDraftInstanceId(sourceFingerprint, 1),
      draftRevision: 1,
      sourceFingerprint,
      status: 'ready_to_apply',
    });
  });

  it('opens the existing active draft instead of inserting a second active draft', () => {
    const sourceFingerprint = 'coach-action|volume|back|pull-a|add-sets';
    const first = upsertPlanAdjustmentDraftByFingerprint([], [], makeDraft({ id: 'candidate-a' }), sourceFingerprint);
    const second = upsertPlanAdjustmentDraftByFingerprint(
      first.drafts,
      [],
      makeDraft({ id: 'candidate-b', createdAt: '2026-05-01T10:00:01.000Z' }),
      sourceFingerprint,
    );

    expect(second.outcome).toBe('opened_existing');
    expect(second.drafts).toHaveLength(1);
    expect(second.targetDraft?.id).toBe(first.createdDraft?.id);
    expect(second.drafts.filter((draft) => draft.sourceFingerprint === sourceFingerprint && draft.status === 'ready_to_apply')).toHaveLength(1);
  });

  it('does not create a new draft when the same source has already been applied', () => {
    const sourceFingerprint = 'coach-action|volume|back|pull-a|add-sets';
    const applied = makeDraft({
      id: 'applied-draft',
      status: 'applied',
      sourceFingerprint,
      appliedAt: '2026-05-01T11:00:00.000Z',
      experimentalProgramTemplateId: 'pull-a-experiment',
    });
    const result = upsertPlanAdjustmentDraftByFingerprint([applied], [], makeDraft({ id: 'candidate-new' }), sourceFingerprint);

    expect(result.outcome).toBe('already_applied');
    expect(result.drafts).toHaveLength(1);
    expect(result.targetDraft).toMatchObject({ id: 'applied-draft', status: 'applied' });
  });

  it('prevents stale-closure writes from duplicating the same source fingerprint', () => {
    const sourceFingerprint = 'coach-action|volume|back|pull-a|add-sets';
    const staleCandidateA = makeDraft({ id: 'closure-candidate-a' });
    const staleCandidateB = makeDraft({ id: 'closure-candidate-b' });

    const first = upsertPlanAdjustmentDraftByFingerprint([], [], staleCandidateA, sourceFingerprint);
    const second = upsertPlanAdjustmentDraftByFingerprint(first.drafts, [], staleCandidateB, sourceFingerprint);

    expect(second.outcome).toBe('opened_existing');
    expect(second.drafts.map((draft) => draft.sourceFingerprint)).toEqual([sourceFingerprint]);
  });
});
