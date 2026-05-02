import { describe, expect, it } from 'vitest';
import { applyAdjustmentDraft, createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
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

const buildAppliedTemplate = () => {
  const data = makeAppData();
  const sourceTemplate = getTemplate('pull-a');
  const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
    programTemplate: data.programTemplate,
    templates: data.templates,
    screeningProfile: data.screeningProfile,
    painPatterns: [],
  });
  const applied = applyAdjustmentDraft(draft, sourceTemplate, data.programTemplate, data.templates);
  if (!applied.experimentalTemplate) throw new Error('apply failed');
  return { data, sourceTemplate, experimentalTemplate: applied.experimentalTemplate };
};

describe('active program template sessions', () => {
  it('creates sessions from the active experimental template with source metadata', () => {
    const { data, sourceTemplate, experimentalTemplate } = buildAppliedTemplate();
    const session = createSession(
      experimentalTemplate,
      data.todayStatus,
      data.history,
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );
    const finished = finalizeTrainingSession(session, '2026-04-30T13:00:00.000Z');

    expect(session.programTemplateId).toBe(experimentalTemplate.id);
    expect(session.isExperimentalTemplate).toBe(true);
    expect(session.sourceProgramTemplateId).toBe(sourceTemplate.id);
    expect(finished.sourceProgramTemplateId).toBe(sourceTemplate.id);
  });

  it('creates new sessions from the source template after rollback switches activeProgramTemplateId back', () => {
    const { data, sourceTemplate } = buildAppliedTemplate();
    const session = createSession(
      sourceTemplate,
      data.todayStatus,
      data.history,
      data.trainingMode,
      null,
      null,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(session.programTemplateId).toBe(sourceTemplate.id);
    expect(session.isExperimentalTemplate).toBe(false);
    expect(session.sourceProgramTemplateId).toBeUndefined();
  });

  it('does not let explicit startSession template selection overwrite activeProgramTemplateId', () => {
    const { data, experimentalTemplate } = buildAppliedTemplate();
    const explicitSelectedTemplateId = 'legs-a';
    const currentActiveTemplateId = experimentalTemplate.id;
    const nextData = {
      ...data,
      selectedTemplateId: explicitSelectedTemplateId,
      activeProgramTemplateId: data.activeProgramTemplateId || currentActiveTemplateId || explicitSelectedTemplateId,
    };

    expect(nextData.selectedTemplateId).toBe(explicitSelectedTemplateId);
    expect(nextData.activeProgramTemplateId).toBe(experimentalTemplate.id);
  });
});
