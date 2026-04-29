import { describe, expect, it } from 'vitest';
import {
  buildCoachActionAdjustmentDraftInput,
  type CoachAction,
} from '../src/engines/coachActionEngine';
import { createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { clone } from '../src/engines/engineUtils';
import { makeAppData } from './fixtures';

const now = '2026-04-29T12:00:00.000Z';

const makeCreateDraftAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'volume-preview-back-increase',
  title: overrides.title || '生成训练量调整草案',
  description: overrides.description || '背部训练量偏低，可以生成下周调整草案。',
  source: overrides.source || 'volumeAdaptation',
  actionType: 'create_plan_adjustment_preview',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: true,
  reversible: true,
  createdAt: overrides.createdAt || now,
  targetId: Object.prototype.hasOwnProperty.call(overrides, 'targetId') ? overrides.targetId : 'back',
  targetType: Object.prototype.hasOwnProperty.call(overrides, 'targetType') ? overrides.targetType : 'muscle',
  reason: overrides.reason || '背部有效组低于目标，但近期完成质量稳定。',
});

const volumeAdaptation: VolumeAdaptationReport = {
  summary: '下周训练量建议：背部可小幅增加。',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 1,
      title: '背部：增加训练量',
      reason: '背部有效组低于目标，但完成度稳定。',
      confidence: 'medium',
      suggestedActions: ['下周只增加 1 组。'],
    },
  ],
};

describe('coach action plan draft creation', () => {
  it('converts a volume CoachAction into an existing program adjustment draft', () => {
    const data = makeAppData();
    const originalProgram = JSON.stringify(data.programTemplate);
    const draftInput = buildCoachActionAdjustmentDraftInput(makeCreateDraftAction(), {
      templates: data.templates,
      volumeAdaptation,
    });

    expect(draftInput).toBeTruthy();
    expect(draftInput?.sourceTemplate.id).toBe('pull-a');
    expect(draftInput?.recommendation.suggestedChange?.muscleId).toBe('back');
    expect(draftInput?.recommendation.suggestedChange?.setsDelta).toBe(1);

    const draft = createAdjustmentDraftFromRecommendations([draftInput!.recommendation], draftInput!.sourceTemplate, {
      programTemplate: clone(data.programTemplate),
      templates: data.templates,
      screeningProfile: data.screeningProfile,
      painPatterns: [],
    });

    expect(draft.status).toBe('previewed');
    expect(draft.changes.length).toBeGreaterThan(0);
    expect(draft.selectedRecommendationIds).toContain('coach-action-volume-preview-back-increase');
    expect(JSON.stringify(data.programTemplate)).toBe(originalProgram);
  });

  it('returns no draft input when target information is missing', () => {
    const data = makeAppData();
    const draftInput = buildCoachActionAdjustmentDraftInput(makeCreateDraftAction({ targetId: undefined, targetType: undefined }), {
      templates: data.templates,
      volumeAdaptation,
    });

    expect(draftInput).toBeNull();
  });
});
