import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('session incomplete draft display model', () => {
  it('separates completed working sets from incomplete planned sets in history summary', () => {
    const session = finalizeTrainingSession(
      makeFocusSession([makeExercise('assisted-pull-up', 2, 2), makeExercise('face-pull', 2, 0)]),
      '2026-04-30T11:00:00-04:00',
      { endedEarly: true },
    );

    const summary = buildSessionDetailSummary(session);

    expect(summary.completedWorkingSetCount).toBe(2);
    expect(summary.incompleteSetCount).toBe(2);
    expect(summary.incompleteExerciseCount).toBe(1);
    expect(summary.workingVolumeKg).toBe(50 * 8 * 2);
    expect(summary.earlyEndSummary).toContain('部分动作未完成');
    expect(summary.earlyEndSummary).not.toMatch(/\b(undefined|null|incomplete_main_work|ended_early)\b/);
  });

  it('shows an explicit early-ended message when no main exercise was completed', () => {
    const session = finalizeTrainingSession(
      makeFocusSession([makeExercise('lat-pulldown', 2, 0), makeExercise('face-pull', 2, 0)]),
      '2026-04-30T11:00:00-04:00',
      { endedEarly: true },
    );

    const summary = buildSessionDetailSummary(session);

    expect(summary.completedWorkingSetCount).toBe(0);
    expect(summary.incompleteSetCount).toBe(4);
    expect(summary.workingVolumeKg).toBe(0);
    expect(summary.effectiveSetCount).toBe(0);
    expect(summary.earlyEndSummary).toContain('训练提前结束，主训练未完成');
  });

  it('keeps Record history copy distinct for incomplete planned sets', () => {
    const source = readFileSync('src/features/RecordView.tsx', 'utf8');

    expect(source).toContain('未完成 · 计划');
    expect(source).toContain('已完成正式组');
    expect(source).toContain('未完成组');
    expect(source).toContain('：未完成');
  });
});
