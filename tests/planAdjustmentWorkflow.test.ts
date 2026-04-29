import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import {
  applyAdjustmentDraft,
  createAdjustmentDraftFromRecommendations,
  rollbackAdjustment,
} from '../src/engines/programAdjustmentEngine';
import { clone } from '../src/engines/engineUtils';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, templates } from './fixtures';

const makeRecommendation = (overrides: Partial<WeeklyActionRecommendation> = {}): WeeklyActionRecommendation => ({
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
  ...overrides,
});

describe('plan adjustment workflow', () => {
  it('creates a real ready-to-apply draft with diff, risk, and explanation', () => {
    const sourceTemplate = getTemplate('pull-a');
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates,
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });

    expect(draft.status).toBe('ready_to_apply');
    expect(draft.sourceRecommendationId).toBe('coach-action-volume-preview-back-increase');
    expect(draft.sourceTemplateId).toBe('pull-a');
    expect(draft.experimentalTemplateName).toContain('实验版');
    expect(draft.riskLevel).toBe('low');
    expect(draft.explanation).toContain('背部');
    expect(draft.diffPreview?.changes.length).toBeGreaterThan(0);
  });

  it('keeps draft application explicit and rollback reversible', () => {
    const sourceTemplate = clone(getTemplate('pull-a'));
    const originalTemplate = JSON.stringify(sourceTemplate);
    const history = [{ id: 'history-session', templateId: 'pull-a' }];
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: clone(DEFAULT_PROGRAM_TEMPLATE),
      templates,
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });

    const applied = applyAdjustmentDraft(draft, sourceTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), templates);
    expect(applied.ok).toBe(true);
    expect(applied.draft.status).toBe('applied');
    expect(applied.experimentalTemplate?.id).not.toBe(sourceTemplate.id);
    expect(applied.historyItem?.status).toBe('applied');
    expect(JSON.stringify(sourceTemplate)).toBe(originalTemplate);

    const rollback = rollbackAdjustment(applied.historyItem!);
    expect(rollback.restoredTemplateId).toBe(sourceTemplate.id);
    expect(rollback.updatedHistoryItem.status).toBe('rolled_back');
    expect(rollback.updatedHistoryItem.rollbackAvailable).toBe(false);
    expect(history).toHaveLength(1);
  });
});
