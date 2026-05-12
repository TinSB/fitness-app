import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { createSession } from '../src/engines/sessionBuilder';
import {
  buildTodayFocusOverrideSessionMetadata,
  buildTodayTrainingFocusSelection,
  TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS,
} from '../src/engines/todayTrainingFocusOverrideEngine';
import { completeTrainingSessionIntoHistory } from '../src/engines/trainingCompletionEngine';
import type { ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession, makeStatus, templates } from './fixtures';

const lowReadiness: ReadinessResult = {
  score: 42,
  level: 'low',
  trainingAdjustment: 'recovery',
  reasons: ['睡眠不足'],
};

describe('today training focus override', () => {
  it('uses the system recommendation by default', () => {
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'system',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });

    expect(selection.overrideActive).toBe(false);
    expect(selection.selectedTemplateId).toBe('legs-a');
    expect(selection.systemTemplateName).toBe('腿 A');
    expect(selection.warnings).toEqual([]);
  });

  it('overrides a legs recommendation to a chest-focused session', () => {
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });

    expect(selection.overrideActive).toBe(true);
    expect(selection.selectedFocusLabel).toBe('胸');
    expect(selection.selectedTemplateId).toBe('push-a');
    expect(selection.systemTemplateId).toBe('legs-a');
    expect(selection.systemTemplateName).toBe('腿 A');
  });

  it('shows recovery warnings when the selected focus conflicts with soreness or readiness', () => {
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: makeStatus({ soreness: ['胸'], date: '2026-05-12' }),
      readinessResult: lowReadiness,
    });

    expect(selection.warnings.map((warning) => warning.id)).toContain('recovery-conflict');
    expect(selection.warnings.map((warning) => warning.id)).toContain('readiness');
    expect(selection.warnings.map((warning) => warning.message).join('\n')).toContain('仍可开始');
  });

  it('can return to the system recommendation by clearing the override', () => {
    const manual = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });
    const cleared = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'system',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });

    expect(manual.selectedTemplateId).toBe('push-a');
    expect(cleared.overrideActive).toBe(false);
    expect(cleared.selectedTemplateId).toBe('legs-a');
  });

  it('records optional user-selected focus metadata when the session is completed', () => {
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });
    const metadata = buildTodayFocusOverrideSessionMetadata(selection, '2026-05-12T14:00:00.000Z');
    const session = createSession(
      selection.selectedTemplate,
      makeStatus({ date: '2026-05-12' }),
      [],
      'hybrid',
      null,
      null,
      DEFAULT_SCREENING_PROFILE,
    );
    const data = makeAppData({ activeSession: { ...session, todayFocusOverride: metadata } });

    const completed = completeTrainingSessionIntoHistory(data, '2026-05-12T15:00:00.000Z');

    expect(completed.session?.todayFocusOverride).toEqual(metadata);
    expect(completed.session?.todayFocusOverride?.selectedFocusLabel).toBe('胸');
    expect(completed.session?.todayFocusOverride?.systemTemplateName).toBe('腿 A');
  });

  it('warns when the selected focus overlaps recent load', () => {
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: makeStatus({ date: '2026-05-12' }),
      today: '2026-05-12',
      history: [
        makeSession({
          id: 'recent-chest',
          date: '2026-05-11',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 60, reps: 8 }],
        }),
      ],
    });

    expect(selection.warnings.map((warning) => warning.id)).toContain('recent-load');
  });

  it('exposes every required override option', () => {
    expect(TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS).toEqual([
      'system',
      'chest',
      'back',
      'legs',
      'shoulders',
      'arms',
      'core',
      'full_body',
      'recovery_mobility',
    ]);
  });
});
