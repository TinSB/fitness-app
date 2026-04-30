import { describe, expect, it } from 'vitest';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations, rollbackAdjustment } from '../src/engines/programAdjustmentEngine';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

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

describe('experimental template rollback', () => {
  it('restores the source template id and preserves history and experimental template records', () => {
    const data = makeAppData({
      history: [
        makeSession({
          id: 'finished-before-rollback',
          date: '2026-04-29',
          templateId: 'pull-a',
          exerciseId: 'lat-pulldown',
          setSpecs: [{ weight: 60, reps: 10 }],
        }),
      ],
    });
    const sourceTemplate = getTemplate('pull-a');
    const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
      programTemplate: data.programTemplate,
      templates: data.templates,
      screeningProfile: data.screeningProfile,
      painPatterns: [],
    });
    const applied = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
    if (!applied.experimentalTemplate || !applied.historyItem) throw new Error('apply failed');

    const rollback = rollbackAdjustment(applied.historyItem);
    const nextData = {
      ...data,
      templates: [...data.templates, applied.experimentalTemplate],
      selectedTemplateId: rollback.restoredTemplateId,
      activeProgramTemplateId: rollback.restoredTemplateId,
      programAdjustmentHistory: [rollback.updatedHistoryItem],
      programAdjustmentDrafts: [{ ...applied.draft, status: 'rolled_back' as const, rolledBackAt: rollback.updatedHistoryItem.rolledBackAt }],
    };

    expect(nextData.activeProgramTemplateId).toBe(sourceTemplate.id);
    expect(nextData.programAdjustmentHistory[0].status).toBe('rolled_back');
    expect(nextData.programAdjustmentHistory[0].rolledBackAt).toBeTruthy();
    expect(nextData.programAdjustmentDrafts[0].rolledBackAt).toBe(nextData.programAdjustmentHistory[0].rolledBackAt);
    expect(nextData.templates.some((template) => template.id === applied.experimentalTemplate?.id)).toBe(true);
    expect(nextData.history).toHaveLength(1);
  });
});
