import { describe, expect, it } from 'vitest';
import {
  buildPlanAdjustmentFingerprintFromDraft,
  buildRegeneratedPlanAdjustmentDraft,
  findReusablePlanAdjustmentDraft,
} from '../src/engines/planAdjustmentIdentityEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';

const makeDraft = (
  overrides: Partial<ProgramAdjustmentDraft> = {},
): ProgramAdjustmentDraft => ({
  id: 'draft-applied',
  createdAt: '2026-04-30T12:10:00.000Z',
  status: 'rolled_back',
  sourceProgramTemplateId: 'pull-a',
  sourceCoachActionId: 'volume-preview-back-increase',
  title: '拉 A 下周实验调整',
  summary: '背部训练量调整草案。',
  selectedRecommendationIds: ['volume-preview-back-increase'],
  changes: [
    {
      id: 'change-back',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      muscleId: 'back',
      setsDelta: 1,
      reason: '有效组低于目标。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  appliedAt: '2026-04-30T12:30:00.000Z',
  rolledBackAt: '2026-04-30T13:00:00.000Z',
  experimentalProgramTemplateId: 'pull-a-experiment-abc123',
  notes: [],
  ...overrides,
});

describe('plan draft regeneration', () => {
  it('creates a new ready draft version from a rolled-back draft', () => {
    const rolledBack = makeDraft();
    const fingerprint = buildPlanAdjustmentFingerprintFromDraft(rolledBack);
    const result = buildRegeneratedPlanAdjustmentDraft(rolledBack, [rolledBack], {
      now: '2026-05-01T10:00:00.000Z',
      draftId: 'draft-regenerated',
    });

    expect(result.existingDraft).toBeUndefined();
    expect(result.draft?.id).toBe('draft-regenerated');
    expect(result.draft?.parentDraftId).toBe(rolledBack.id);
    expect(result.draft?.draftRevision).toBe(2);
    expect(result.draft?.status).toBe('ready_to_apply');
    expect(result.draft?.sourceFingerprint).toBe(fingerprint);
    expect(result.draft?.appliedAt).toBeUndefined();
    expect(result.draft?.rolledBackAt).toBeUndefined();
    expect(result.draft?.experimentalProgramTemplateId).toBeUndefined();
    expect(rolledBack.status).toBe('rolled_back');
  });

  it('opens an existing ready draft instead of creating a duplicate', () => {
    const rolledBack = makeDraft();
    const ready = makeDraft({
      id: 'draft-ready',
      status: 'ready_to_apply',
      appliedAt: undefined,
      rolledBackAt: undefined,
      experimentalProgramTemplateId: undefined,
      draftRevision: 2,
      parentDraftId: rolledBack.id,
      sourceFingerprint: buildPlanAdjustmentFingerprintFromDraft(rolledBack),
    });
    const result = buildRegeneratedPlanAdjustmentDraft(rolledBack, [rolledBack, ready], {
      now: '2026-05-01T10:00:00.000Z',
      draftId: 'draft-duplicate',
    });

    expect(findReusablePlanAdjustmentDraft(rolledBack, [rolledBack, ready])?.id).toBe(ready.id);
    expect(result.existingDraft?.id).toBe(ready.id);
    expect(result.draft).toBeUndefined();
  });

  it('increments revision across same-source history without deleting older drafts', () => {
    const fingerprint = 'plan-adjustment|volume|back|pull-a';
    const first = makeDraft({ id: 'draft-r1', draftRevision: 1, sourceFingerprint: fingerprint });
    const secondRolledBack = makeDraft({
      id: 'draft-r2',
      draftRevision: 2,
      sourceFingerprint: fingerprint,
      parentDraftId: first.id,
    });
    const result = buildRegeneratedPlanAdjustmentDraft(secondRolledBack, [first, secondRolledBack], {
      now: '2026-05-02T10:00:00.000Z',
      draftId: 'draft-r3',
    });

    expect(result.draft?.draftRevision).toBe(3);
    expect(result.draft?.parentDraftId).toBe(secondRolledBack.id);
    expect([first.id, secondRolledBack.id]).toEqual(['draft-r1', 'draft-r2']);
  });
});
