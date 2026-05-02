import { describe, expect, it } from 'vitest';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations, rollbackAdjustment } from '../src/engines/programAdjustmentEngine';
import { createSession } from '../src/engines/sessionBuilder';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

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

const buildAppliedState = () => {
  const data = makeAppData({ activeProgramTemplateId: 'pull-a', selectedTemplateId: 'pull-a' });
  const sourceTemplate = getTemplate('pull-a');
  const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  const applied = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
  if (!applied.experimentalTemplate || !applied.historyItem) throw new Error('expected applied template');
  return {
    data: {
      ...data,
      templates: [applied.experimentalTemplate, ...data.templates],
      activeProgramTemplateId: applied.experimentalTemplate.id,
      programAdjustmentDrafts: [applied.draft],
      programAdjustmentHistory: [applied.historyItem],
    },
    sourceTemplate,
    experimentalTemplate: applied.experimentalTemplate,
    historyItem: applied.historyItem,
  };
};

describe('active program template startSession state', () => {
  it('starts from the active experimental template when it is current', () => {
    const { data, experimentalTemplate, sourceTemplate } = buildAppliedState();
    const activeTemplate = data.templates.find((template) => template.id === data.activeProgramTemplateId);
    if (!activeTemplate) throw new Error('missing active template');

    const session = createSession(
      activeTemplate,
      data.todayStatus,
      data.history,
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(session).toMatchObject({
      programTemplateId: experimentalTemplate.id,
      isExperimentalTemplate: true,
      sourceProgramTemplateId: sourceTemplate.id,
    });
  });

  it('starts from the source template after rollback restores activeProgramTemplateId', () => {
    const { data, sourceTemplate, historyItem } = buildAppliedState();
    const rollback = rollbackAdjustment(historyItem);
    const nextData = {
      ...data,
      activeProgramTemplateId: rollback.restoredTemplateId,
    };
    const activeTemplate = nextData.templates.find((template) => template.id === nextData.activeProgramTemplateId);
    if (!activeTemplate) throw new Error('missing restored template');
    const session = createSession(
      activeTemplate,
      nextData.todayStatus,
      nextData.history,
      nextData.trainingMode,
      null,
      null,
      nextData.screeningProfile,
      nextData.mesocyclePlan,
    );

    expect(nextData.activeProgramTemplateId).toBe(sourceTemplate.id);
    expect(session).toMatchObject({
      programTemplateId: sourceTemplate.id,
      isExperimentalTemplate: false,
    });
    expect(session.sourceProgramTemplateId).toBeUndefined();
  });
});
