import { describe, expect, it } from 'vitest';
import {
  applyAdjustmentDraft,
  buildAdjustmentDiff,
  createAdjustmentDraftFromRecommendations,
  rollbackAdjustment,
} from '../src/engines/programAdjustmentEngine';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate } from './fixtures';

const recommendation = (overrides: Partial<WeeklyActionRecommendation> = {}): WeeklyActionRecommendation => ({
  id: 'rec-back-volume',
  priority: 'high',
  category: 'volume',
  targetType: 'muscle',
  targetId: '胸',
  targetLabel: '胸',
  issue: '胸部加权有效组不足。',
  recommendation: '下周为卧推增加 2 组。',
  reason: '本周距离目标仍有缺口。',
  suggestedChange: {
    muscleId: '胸',
    exerciseIds: ['bench-press'],
    setsDelta: 2,
  },
  confidence: 'high',
  ...overrides,
});

describe('programAdjustmentEngine', () => {
  it('creates a draft from selected recommendations', () => {
    const template = getTemplate('push-a');
    const draft = createAdjustmentDraftFromRecommendations([recommendation()], template);

    expect(draft.status).toBe('draft');
    expect(draft.sourceProgramTemplateId).toBe(template.id);
    expect(draft.selectedRecommendationIds).toEqual(['rec-back-volume']);
    expect(draft.changes[0]?.type).toBe('add_sets');
  });

  it('only includes recommendations passed into draft creation', () => {
    const template = getTemplate('push-a');
    const draft = createAdjustmentDraftFromRecommendations([recommendation({ id: 'selected' })], template);

    expect(draft.selectedRecommendationIds).toEqual(['selected']);
    expect(draft.changes.every((change) => change.sourceRecommendationId === 'selected')).toBe(true);
  });

  it('builds before and after diff without mutating the template', () => {
    const template = getTemplate('push-a');
    const before = JSON.stringify(template);
    const draft = createAdjustmentDraftFromRecommendations([recommendation()], template);
    const diff = buildAdjustmentDiff(draft, template);

    expect(diff.changes[0]?.before).toMatch(/3/);
    expect(diff.changes[0]?.after).toMatch(/5/);
    expect(diff.changes[0]?.riskLevel).toBe('low');
    expect(JSON.stringify(template)).toBe(before);
  });

  it('applies a draft by copying the source template instead of overwriting it', () => {
    const template = getTemplate('push-a');
    const before = JSON.stringify(template);
    const draft = createAdjustmentDraftFromRecommendations([recommendation()], template);
    const { experimentalTemplate, historyItem } = applyAdjustmentDraft(draft, template);

    expect(experimentalTemplate.id).not.toBe(template.id);
    expect(experimentalTemplate.name).toContain('实验版');
    expect(experimentalTemplate.exercises.find((item) => item.id === 'bench-press')?.sets).toBe(5);
    expect(historyItem.sourceProgramTemplateId).toBe(template.id);
    expect(historyItem.experimentalProgramTemplateId).toBe(experimentalTemplate.id);
    expect(JSON.stringify(template)).toBe(before);
  });

  it('skips unsafe swap changes without deleting the original template', () => {
    const template = getTemplate('push-a');
    const draft = createAdjustmentDraftFromRecommendations(
      [
        recommendation({
          id: 'pain-swap',
          category: 'pain',
          suggestedChange: { removeExerciseIds: ['bench-press'] },
        }),
      ],
      template,
    );
    const { experimentalTemplate, historyItem } = applyAdjustmentDraft(draft, template);

    expect(historyItem.changes).toHaveLength(0);
    expect(experimentalTemplate.exercises.some((item) => item.id === 'bench-press')).toBe(true);
    expect(experimentalTemplate.note).toContain('未能安全应用');
  });

  it('marks rollback history without deleting the experimental template id', () => {
    const template = getTemplate('push-a');
    const draft = createAdjustmentDraftFromRecommendations([recommendation()], template);
    const { historyItem } = applyAdjustmentDraft(draft, template);
    const result = rollbackAdjustment(historyItem);

    expect(result.restoredTemplateId).toBe(template.id);
    expect(result.updatedHistoryItem.rollbackAvailable).toBe(false);
    expect(result.updatedHistoryItem.rolledBackAt).toBeTruthy();
  });
});
