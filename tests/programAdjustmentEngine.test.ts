import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import {
  applyAdjustmentDraft,
  buildAdjustmentDiff,
  createAdjustmentDraftFromRecommendations,
  hashProgramTemplate,
  selectBestDayForNewExercise,
} from '../src/engines/programAdjustmentEngine';
import { clone } from '../src/engines/engineUtils';
import type { ProgramAdjustmentDraft, TrainingTemplate, WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, templates } from './fixtures';

const makeRecommendation = (overrides: Partial<WeeklyActionRecommendation> = {}): WeeklyActionRecommendation => ({
  id: 'rec-1',
  priority: 'high',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: 'Back',
  issue: 'Back volume is low',
  recommendation: 'Add a new back exercise',
  reason: 'Weekly back volume is below target',
  suggestedChange: {
    muscleId: 'back',
    setsDelta: 2,
    exerciseIds: ['single-arm-pulldown'],
  },
  confidence: 'high',
  ...overrides,
});

const makeDraft = (
  sourceTemplate: TrainingTemplate,
  change: ProgramAdjustmentDraft['changes'][number],
): ProgramAdjustmentDraft => ({
  id: 'draft-1',
  createdAt: '2026-04-26T00:00:00.000Z',
  status: 'previewed',
  sourceProgramTemplateId: sourceTemplate.id,
  sourceTemplateSnapshotHash: hashProgramTemplate(sourceTemplate),
  sourceTemplateUpdatedAt: sourceTemplate.updatedAt || '2026-04-26T00:00:00.000Z',
  title: 'Experiment Draft',
  summary: 'Preview',
  selectedRecommendationIds: ['rec-1'],
  changes: [change],
  confidence: 'high',
  notes: [],
});

describe('programAdjustmentEngine', () => {
  it('generates add_new_exercise when the recommendation is not already in the source template', () => {
    const sourceTemplate = getTemplate('pull-a');
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates: [sourceTemplate],
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });

    expect(draft.changes).toHaveLength(1);
    const change = draft.changes[0];
    expect(change?.type).toBe('add_new_exercise');
    expect(change?.exerciseId).toBe('single-arm-pulldown');
    expect(change?.sets).toBe(2);
    expect(change?.repMin).toBeGreaterThanOrEqual(1);
    expect(change?.repMax).toBeGreaterThanOrEqual(change?.repMin || 0);
    expect(change?.restSec).toBeGreaterThanOrEqual(30);
    expect(change?.sourceRecommendationId).toBe('rec-1');
  });

  it('selects a suitable day and inserts the new exercise near the accessory zone', () => {
    const sourceTemplate = getTemplate('pull-a');
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates: [sourceTemplate],
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });

    const change = draft.changes[0];
    expect(change?.dayTemplateId).toBe('pull-a');
    expect(change?.insertPositionLabel).toBeTruthy();

    const result = applyAdjustmentDraft(draft, sourceTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), [sourceTemplate]);
    expect(result.ok).toBe(true);
    expect(result.experimentalTemplate?.exercises.at(-1)?.id).toBe('single-arm-pulldown');
  });

  it('does not auto-insert restricted or pain-limited exercises', () => {
    const sourceTemplate = getTemplate('pull-a');
    const selection = selectBestDayForNewExercise('single-arm-pulldown', DEFAULT_PROGRAM_TEMPLATE, 'back', {
      templates: [sourceTemplate],
      screeningProfile: {
        ...DEFAULT_SCREENING_PROFILE,
        restrictedExercises: ['single-arm-pulldown'],
      },
      painPatterns: [],
      sourceTemplateId: sourceTemplate.id,
    });

    expect(selection.confidence).toBe('low');
    expect(selection.dayTemplateId).toBeUndefined();
    expect(selection.note).toBeTruthy();
  });

  it('reduce_support really modifies the program template support configuration', () => {
    const sourceTemplate = getTemplate('push-a');
    const originalProgram = clone(DEFAULT_PROGRAM_TEMPLATE);
    const beforeDay = originalProgram.dayTemplates.find((day) => day.id === 'push-a');
    const draft = makeDraft(sourceTemplate, {
      id: 'change-support-down',
      type: 'reduce_support',
      dayTemplateId: 'push-a',
      dayTemplateName: 'Push A',
      muscleId: 'chest',
      reason: 'Reduce support dose',
    });

    const result = applyAdjustmentDraft(draft, sourceTemplate, originalProgram, [sourceTemplate]);
    const afterDay = result.updatedProgramTemplate?.dayTemplates.find((day) => day.name === result.experimentalTemplate?.name);

    expect(result.ok).toBe(true);
    expect(result.updatedProgramTemplate?.correctionStrategy).toBe('light');
    expect(result.updatedProgramTemplate?.functionalStrategy).toBe('minimal');
    expect(afterDay?.correctionBlockIds.length).toBeLessThan(beforeDay?.correctionBlockIds.length || 0);
    expect(afterDay?.estimatedDurationMin).toBeLessThan(beforeDay?.estimatedDurationMin || 0);
  });

  it('increase_support really modifies the program template support configuration', () => {
    const sourceTemplate = getTemplate('quick-30');
    const draft = makeDraft(sourceTemplate, {
      id: 'change-support-up',
      type: 'increase_support',
      dayTemplateId: 'quick-30',
      dayTemplateName: 'Quick 30',
      muscleId: 'back',
      reason: 'Increase support dose',
    });

    const result = applyAdjustmentDraft(draft, sourceTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), [sourceTemplate]);
    const afterDay = result.updatedProgramTemplate?.dayTemplates.find((day) => day.name === result.experimentalTemplate?.name);

    expect(result.ok).toBe(true);
    expect(result.updatedProgramTemplate?.correctionStrategy).toBe('aggressive');
    expect(result.updatedProgramTemplate?.functionalStrategy).toBe('enhanced');
    expect(afterDay?.correctionBlockIds.length).toBeGreaterThan(0);
    expect(afterDay?.functionalBlockIds.length).toBeGreaterThan(0);
  });

  it('builds a user-friendly diff without leaking internal ids', () => {
    const sourceTemplate = getTemplate('pull-a');
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates: [sourceTemplate],
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });

    const diff = buildAdjustmentDiff(draft, sourceTemplate, DEFAULT_PROGRAM_TEMPLATE, [sourceTemplate]);
    const serialized = JSON.stringify(diff);

    expect(diff.changes[0]?.label).toBeTruthy();
    expect(serialized).not.toContain('dayTemplateId');
    expect(serialized).not.toContain('exerciseId');
    expect(serialized).not.toContain('pull-a');
    expect(serialized).not.toContain('single-arm-pulldown');
  });

  it('blocks stale drafts when the source template changed', () => {
    const sourceTemplate = getTemplate('pull-a');
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates: [sourceTemplate],
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });
    const changedTemplate = {
      ...clone(sourceTemplate),
      note: `${sourceTemplate.note} changed`,
      updatedAt: '2026-04-26T12:00:00.000Z',
    };

    const result = applyAdjustmentDraft(draft, changedTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), [changedTemplate]);
    expect(result.ok).toBe(false);
    expect(result.draft.status).toBe('stale');
    expect(result.message).toContain('重新生成');
  });

  it('applies a fresh draft without mutating the original template', () => {
    const sourceTemplate = clone(getTemplate('pull-a'));
    const original = JSON.stringify(sourceTemplate);
    const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates: [sourceTemplate],
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });

    const result = applyAdjustmentDraft(draft, sourceTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), [sourceTemplate]);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(sourceTemplate)).toBe(original);
    expect(result.experimentalTemplate?.id).not.toBe(sourceTemplate.id);
    expect(result.historyItem?.sourceProgramTemplateId).toBe(sourceTemplate.id);
  });
});
