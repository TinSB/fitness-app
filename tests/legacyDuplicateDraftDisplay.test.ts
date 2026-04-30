import { describe, expect, it } from 'vitest';
import { dedupePlanAdjustmentDraftsByFingerprint } from '../src/engines/planAdjustmentIdentityEngine';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { makeAppData } from './fixtures';

const makeDraft = (id: string, status: ProgramAdjustmentDraft['status'], createdAt: string, appliedAt?: string): ProgramAdjustmentDraft => ({
  id,
  createdAt,
  status,
  sourceProgramTemplateId: 'pull-a',
  sourceFingerprint: 'legacy-volume-back-pull-a',
  title: '拉 A 下周实验调整',
  summary: '背部训练量调整草案。',
  selectedRecommendationIds: ['volume-preview-back-increase'],
  experimentalProgramTemplateId: status === 'applied' ? 'pull-a-experiment-applied' : undefined,
  appliedAt,
  changes: [
    {
      id: `${id}-change`,
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
  notes: [],
});

describe('legacy duplicate draft display', () => {
  it('keeps only one visible draft for the same legacy fingerprint and prefers applied', () => {
    const ready = makeDraft('draft-ready', 'ready_to_apply', '2026-04-30T12:00:00.000Z');
    const applied = makeDraft('draft-applied', 'applied', '2026-04-30T12:10:00.000Z', '2026-04-30T13:00:00.000Z');
    const duplicate = makeDraft('draft-duplicate', 'ready_to_apply', '2026-04-30T12:20:00.000Z');

    const deduped = dedupePlanAdjustmentDraftsByFingerprint([ready, applied, duplicate]);
    const viewModel = buildPlanViewModel(makeAppData({ programAdjustmentDrafts: [ready, applied, duplicate] }));

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('draft-applied');
    expect(viewModel.adjustmentDrafts.drafts).toHaveLength(1);
    expect(viewModel.adjustmentDrafts.drafts[0].id).toBe('draft-applied');
  });
});
