import { describe, expect, it } from 'vitest';
import {
  buildRegeneratedPlanAdjustmentDraft,
  upsertPlanAdjustmentDraftByFingerprint,
} from '../src/engines/planAdjustmentIdentityEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';

const sourceFingerprint = 'coach-action|volume|back|pull-a|add-sets';

const makeRolledBackDraft = (overrides: Partial<ProgramAdjustmentDraft> = {}): ProgramAdjustmentDraft => ({
  id: overrides.id || 'rolled-back-draft',
  createdAt: '2026-05-01T09:00:00.000Z',
  status: 'rolled_back',
  sourceProgramTemplateId: 'pull-a',
  sourceTemplateId: 'pull-a',
  sourceCoachActionId: 'coach-action-back-volume',
  sourceRecommendationId: 'recommendation-back-volume',
  sourceFingerprint,
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
  rolledBackAt: '2026-05-01T12:00:00.000Z',
  draftRevision: 1,
  ...overrides,
});

describe('rolled-back draft regeneration idempotency', () => {
  it('creates one child draft linked to the rolled-back parent', () => {
    const parent = makeRolledBackDraft();
    const regenerated = buildRegeneratedPlanAdjustmentDraft(parent, [parent], {
      now: '2026-05-01T13:00:00.000Z',
    });

    expect(regenerated.draft).toMatchObject({
      parentDraftId: parent.id,
      sourceFingerprint,
      status: 'ready_to_apply',
      draftRevision: 2,
    });

    const upserted = upsertPlanAdjustmentDraftByFingerprint([parent], [], regenerated.draft!, sourceFingerprint);

    expect(upserted.outcome).toBe('created');
    expect(upserted.drafts).toHaveLength(2);
    expect(upserted.createdDraft).toMatchObject({ parentDraftId: parent.id, sourceFingerprint });
  });

  it('opens the existing child draft when the same rolled-back parent is regenerated twice', () => {
    const parent = makeRolledBackDraft();
    const firstRegeneration = buildRegeneratedPlanAdjustmentDraft(parent, [parent], {
      now: '2026-05-01T13:00:00.000Z',
    });
    const first = upsertPlanAdjustmentDraftByFingerprint([parent], [], firstRegeneration.draft!, sourceFingerprint);
    const secondRegeneration = buildRegeneratedPlanAdjustmentDraft(parent, first.drafts, {
      now: '2026-05-01T13:01:00.000Z',
    });
    const secondCandidate = secondRegeneration.existingDraft || secondRegeneration.draft;
    const second = secondCandidate
      ? upsertPlanAdjustmentDraftByFingerprint(first.drafts, [], secondCandidate, sourceFingerprint)
      : first;

    expect(second.outcome).toBe('opened_existing');
    expect(second.targetDraft?.parentDraftId).toBe(parent.id);
    expect(second.drafts.filter((draft) => draft.parentDraftId === parent.id && draft.status === 'ready_to_apply')).toHaveLength(1);
    expect(second.drafts.find((draft) => draft.id === parent.id)?.status).toBe('rolled_back');
  });
});
