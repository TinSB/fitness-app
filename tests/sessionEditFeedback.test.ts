import { describe, expect, it } from 'vitest';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, sessionEditFeedbackMessage, updateSessionSet } from '../src/engines/sessionEditEngine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeSession } from './fixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const makeSessionWithWarmup = (): TrainingSession => ({
  ...makeSession({
    id: 'edit-session',
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
  }),
  focusWarmupSetLogs: [
    {
      id: 'main:bench-press:warmup:0',
      type: 'warmup',
      weight: 20,
      actualWeightKg: 20,
      reps: 8,
      rir: '',
      done: true,
    },
  ],
});

describe('session edit feedback', () => {
  it('explains that warmup edits do not affect PR, e1RM, or effective sets', () => {
    expect(sessionEditFeedbackMessage(['warmupSets'])).toBe('已更新热身组，不影响 PR、e1RM 和有效组。');
  });

  it('explains that working-set edits recalculate statistics', () => {
    expect(sessionEditFeedbackMessage(['sets'])).toBe('已保存修正，相关统计会重新计算。');
  });

  it('explains data flag edits separately', () => {
    expect(sessionEditFeedbackMessage(['dataFlag'])).toBe('数据状态已更新。');
  });

  it('updates summary data after a working-set edit and writes edit history', () => {
    const session = makeSessionWithWarmup();
    const baseline = buildSessionDetailSummary(session, unitSettings);
    const edited = markSessionEdited(
      updateSessionSet(session, 'bench-press', 'bench-press-1', {
        weightKg: 100,
        reps: 8,
        rir: 1,
      }),
      ['sets'],
      '历史训练详情修正',
    );
    const next = buildSessionDetailSummary(edited, unitSettings);

    expect(next.workingVolumeKg).toBeGreaterThan(baseline.workingVolumeKg);
    expect(edited.editHistory?.at(-1)?.fields).toEqual(['sets']);
    expect(sessionEditFeedbackMessage(edited.editHistory?.at(-1)?.fields || [])).toBe('已保存修正，相关统计会重新计算。');
  });
});
