import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE } from '../src/data/trainingData';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import { clone } from '../src/engines/engineUtils';
import { buildPlanAdjustmentFingerprintFromDraft } from '../src/engines/planAdjustmentIdentityEngine';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData, templates } from './fixtures';

const recommendation: WeeklyActionRecommendation = {
  id: 'coach-action-volume-preview-back-increase',
  priority: 'medium',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: '背',
  issue: '背部训练量不足',
  recommendation: '下周给背部小幅增加 1 组。',
  reason: '背部近期有效组不足，且完成率良好。',
  suggestedChange: {
    muscleId: 'back',
    setsDelta: 1,
    exerciseIds: ['lat-pulldown'],
  },
  confidence: 'medium',
};

const makeDraft = () => {
  const data = makeAppData({ programTemplate: clone(DEFAULT_PROGRAM_TEMPLATE), templates });
  const sourceTemplate = clone(getTemplate('pull-a'));
  const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  return { data, sourceTemplate, draft: { ...draft, sourceCoachActionId: 'volume-preview-back-increase' } };
};

describe('experimental template apply', () => {
  it('creates an experimental template and switches the active plan id', () => {
    const { data, sourceTemplate, draft } = makeDraft();
    const result = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
    if (!result.experimentalTemplate || !result.historyItem || !result.updatedProgramTemplate) {
      throw new Error('apply failed');
    }

    const nextData = {
      ...data,
      templates: [...data.templates.filter((template) => template.id !== result.experimentalTemplate!.id), result.experimentalTemplate],
      selectedTemplateId: result.experimentalTemplate.id,
      activeProgramTemplateId: result.experimentalTemplate.id,
      programTemplate: result.updatedProgramTemplate,
      programAdjustmentDrafts: [result.draft],
      programAdjustmentHistory: [result.historyItem],
    };

    expect(result.draft.status).toBe('applied');
    expect(result.draft.appliedAt).toBeTruthy();
    expect(result.draft.experimentalProgramTemplateId).toBe(result.experimentalTemplate.id);
    expect(result.draft.sourceFingerprint).toBe(buildPlanAdjustmentFingerprintFromDraft(result.draft));
    expect(result.historyItem.status).toBe('applied');
    expect(result.historyItem.sourceFingerprint).toBe(result.draft.sourceFingerprint);
    expect(nextData.activeProgramTemplateId).toBe(result.experimentalTemplate.id);
    expect(nextData.templates.find((template) => template.id === sourceTemplate.id)?.isExperimentalTemplate).not.toBe(true);
  });
});
