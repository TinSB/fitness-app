import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import {
  applyAdjustmentDraft,
  createAdjustmentDraftFromRecommendations,
  rollbackAdjustment,
} from '../src/engines/programAdjustmentEngine';
import { clone } from '../src/engines/engineUtils';
import type { AppData, WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData, templates } from './fixtures';

const recommendation: WeeklyActionRecommendation = {
  id: 'coach-action-volume-preview-back-increase',
  priority: 'medium',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: '背部',
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

const applyToData = (data: AppData) => {
  const sourceTemplate = clone(getTemplate('pull-a'));
  const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: DEFAULT_SCREENING_PROFILE,
    painPatterns: [],
  });
  const result = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
  if (!result.experimentalTemplate || !result.historyItem || !result.updatedProgramTemplate) throw new Error('apply failed');
  return {
    ...data,
    templates: [...data.templates.filter((template) => template.id !== result.experimentalTemplate!.id), result.experimentalTemplate],
    selectedTemplateId: result.experimentalTemplate.id,
    activeProgramTemplateId: result.experimentalTemplate.id,
    programTemplate: result.updatedProgramTemplate,
    programAdjustmentDrafts: [result.draft],
    programAdjustmentHistory: [result.historyItem],
  };
};

describe('experimental template apply rollback', () => {
  it('applies a draft by creating an experimental template without overwriting the source template', () => {
    const data = makeAppData({ programTemplate: clone(DEFAULT_PROGRAM_TEMPLATE), templates });
    const sourceBefore = JSON.stringify(data.templates.find((template) => template.id === 'pull-a'));
    const next = applyToData(data);

    expect(next.activeProgramTemplateId).not.toBe('pull-a');
    expect(next.activeProgramTemplateId).toContain('experiment');
    expect(next.templates.find((template) => template.id === next.activeProgramTemplateId)?.isExperimentalTemplate).toBe(true);
    expect(next.programAdjustmentDrafts[0]?.status).toBe('applied');
    expect(next.programAdjustmentHistory[0]?.status).toBe('applied');
    expect(JSON.stringify(next.templates.find((template) => template.id === 'pull-a'))).toBe(sourceBefore);
  });

  it('rolls back to the source template while preserving history and experimental records', () => {
    const data = makeAppData({ programTemplate: clone(DEFAULT_PROGRAM_TEMPLATE), templates });
    const applied = applyToData({
      ...data,
      history: [
        {
          id: 'finished-session',
          date: '2026-04-29',
          templateId: 'pull-a',
          templateName: '拉 A',
          trainingMode: 'hybrid',
          focus: '拉',
          exercises: [],
          status: data.todayStatus,
          completed: true,
        },
      ],
    });
    const rollback = rollbackAdjustment(applied.programAdjustmentHistory[0]!);

    const rolledBack = {
      ...applied,
      selectedTemplateId: rollback.restoredTemplateId,
      activeProgramTemplateId: rollback.restoredTemplateId,
      programTemplate: rollback.restoredProgramTemplate || applied.programTemplate,
      programAdjustmentHistory: [rollback.updatedHistoryItem],
      programAdjustmentDrafts: applied.programAdjustmentDrafts.map((draft) => ({ ...draft, status: 'rolled_back' as const })),
    };

    expect(rolledBack.activeProgramTemplateId).toBe('pull-a');
    expect(rolledBack.programAdjustmentHistory[0]?.status).toBe('rolled_back');
    expect(rolledBack.programAdjustmentHistory[0]?.rollbackAvailable).toBe(false);
    expect(rolledBack.templates.some((template) => template.isExperimentalTemplate)).toBe(true);
    expect(rolledBack.history).toHaveLength(1);
  });
});
