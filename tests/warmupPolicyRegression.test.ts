import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildFocusStepQueue } from '../src/engines/focusModeStateEngine';
import { formatWarmupDecision } from '../src/i18n/formatters';
import type { TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { makeSession } from './fixtures';

describe('warmup policy regression', () => {
  it('uses Chinese labels for full warmup, feeder set, and no warmup decisions', () => {
    expect(formatWarmupDecision('full_warmup')).toBe('完整热身');
    expect(formatWarmupDecision('feeder_set')).toBe('适应组');
    expect(formatWarmupDecision('no_warmup')).toBe('无需热身');
  });

  it('shows feeder set text without exposing raw warmup decision enums', () => {
    const session = makeFocusSession([
      {
        ...makeExercise('lat-pulldown', 2, 0, 3),
        muscle: '背',
        primaryMuscles: ['背'],
        movementPattern: '垂直拉',
        kind: 'compound',
        skillDemand: 'medium',
        fatigueCost: 'medium',
      },
      {
        ...makeExercise('barbell-row', 2, 0, 3),
        muscle: '背',
        primaryMuscles: ['背'],
        movementPattern: '水平拉',
        kind: 'compound',
        skillDemand: 'high',
        fatigueCost: 'high',
      },
    ]);
    const text = buildFocusStepQueue(session).map((step) => `${step.label} ${step.warmupPolicy?.reason || ''}`).join('\n');

    expect(text).toContain('适应组');
    expect(text).not.toMatch(/\b(full_warmup|feeder_set|no_warmup|warmup|working|undefined|null)\b/);
  });

  it('keeps warmup sets out of PR, e1RM, and effective-set analytics', () => {
    const workingOnly = makeSession({
      id: 'warmup-analytics-working',
      date: '2026-04-30',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    const withWarmup: TrainingSession = {
      ...workingOnly,
      id: 'warmup-analytics-with-warmup',
      focusWarmupSetLogs: [
        {
          id: 'main:bench-press:warmup:0',
          type: 'warmup',
          weight: 120,
          actualWeightKg: 120,
          reps: 1,
          rir: '',
          rpe: '',
          done: true,
          painFlag: false,
        },
      ],
    };

    expect(buildEffectiveVolumeSummary([withWarmup])).toEqual(buildEffectiveVolumeSummary([workingOnly]));
    expect(buildE1RMProfile([withWarmup], 'bench-press').best?.e1rmKg).toBe(buildE1RMProfile([workingOnly], 'bench-press').best?.e1rmKg);
    expect(buildPrs([withWarmup]).find((item) => item.exerciseId === 'bench-press' && item.metric === 'max_weight')?.raw).toBe(80);
  });
});
