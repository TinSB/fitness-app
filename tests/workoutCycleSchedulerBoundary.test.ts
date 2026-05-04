import { describe, expect, it } from 'vitest';
import { buildWorkoutCycleState } from '../src/engines/workoutCycleScheduler';
import type { SessionDataFlag, TrainingSession } from '../src/models/training-model';

const orderedTemplateIds = ['push-a', 'pull-a', 'legs-a'];

const session = (templateId: string, date: string, dataFlag: SessionDataFlag = 'normal'): TrainingSession =>
  ({
    id: `${templateId}-${date}-${dataFlag}`,
    date,
    templateId,
    programTemplateId: templateId,
    templateName: templateId,
    completed: true,
    dataFlag,
    finishedAt: `${date}T10:00:00-04:00`,
    exercises: [],
  }) as TrainingSession;

const build = (history: TrainingSession[], currentDate = '2026-05-04') =>
  buildWorkoutCycleState({
    history,
    orderedTemplateIds,
    currentDate,
  });

describe('workout cycle scheduler boundary', () => {
  it('recommends legs after push and pull in the open PPL cycle', () => {
    const state = build([session('push-a', '2026-05-02'), session('pull-a', '2026-05-03')]);

    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a']);
    expect(state.missingInCurrentCycle).toEqual(['legs-a']);
    expect(state.nextTemplateId).toBe('legs-a');
    expect(state.reason).toBe('当前这一轮已完成推 A、拉 A，还缺腿 A，因此今天建议腿 A。');
  });

  it('starts a new cycle after a complete ordered PPL cycle', () => {
    const state = build([session('push-a', '2026-05-01'), session('pull-a', '2026-05-02'), session('legs-a', '2026-05-03')]);

    expect(state.isCycleComplete).toBe(true);
    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a', 'legs-a']);
    expect(state.missingInCurrentCycle).toEqual([]);
    expect(state.nextTemplateId).toBe('push-a');
    expect(state.reason).toContain('上一轮推、拉、腿已完成');
  });

  it('closes an out-of-order completed cycle and starts from push', () => {
    const state = build([session('push-a', '2026-04-27'), session('legs-a', '2026-04-28'), session('pull-a', '2026-04-30')]);

    expect(state.isCycleComplete).toBe(true);
    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a', 'legs-a']);
    expect(state.nextTemplateId).toBe('push-a');
  });

  it('does not carry old legs into the new cycle after a previous out-of-order cycle closes', () => {
    const state = build([
      session('push-a', '2026-04-27'),
      session('legs-a', '2026-04-28'),
      session('pull-a', '2026-04-30'),
      session('push-a', '2026-05-02'),
      session('pull-a', '2026-05-03'),
    ]);

    expect(state.isCycleComplete).toBe(false);
    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a']);
    expect(state.missingInCurrentCycle).toEqual(['legs-a']);
    expect(state.nextTemplateId).toBe('legs-a');
    expect(state.reason).toContain('当前这一轮已完成推 A、拉 A');
    expect(state.reason).toContain('还缺腿 A');
  });

  it('counts duplicate templates only once inside the open cycle', () => {
    const state = build([session('push-a', '2026-05-01'), session('push-a', '2026-05-02'), session('pull-a', '2026-05-03')]);

    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a']);
    expect(state.missingInCurrentCycle).toEqual(['legs-a']);
    expect(state.nextTemplateId).toBe('legs-a');
  });

  it('ignores optional templates without closing or resetting the PPL cycle', () => {
    const state = build([
      session('push-a', '2026-05-01'),
      session('upper-a', '2026-05-02'),
      session('quick-30', '2026-05-02'),
      session('pull-a', '2026-05-03'),
      session('crowded-gym', '2026-05-03'),
    ]);

    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a']);
    expect(state.missingInCurrentCycle).toEqual(['legs-a']);
    expect(state.nextTemplateId).toBe('legs-a');
  });

  it('starts a conservative new cycle when the latest PPL session is older than 30 days', () => {
    const state = build([session('push-a', '2026-03-20'), session('pull-a', '2026-03-22')], '2026-05-04');

    expect(state.completedInCurrentCycle).toEqual([]);
    expect(state.missingInCurrentCycle).toEqual(['push-a', 'pull-a', 'legs-a']);
    expect(state.nextTemplateId).toBe('push-a');
    expect(state.reason).toContain('距离上次主轮转较久');
  });

  it('ignores test and excluded sessions when building the current cycle', () => {
    const state = build([
      session('push-a', '2026-05-01'),
      session('pull-a', '2026-05-02', 'test'),
      session('legs-a', '2026-05-03', 'excluded'),
    ]);

    expect(state.completedInCurrentCycle).toEqual(['push-a']);
    expect(state.missingInCurrentCycle).toEqual(['pull-a', 'legs-a']);
    expect(state.nextTemplateId).toBe('pull-a');
  });

  it('keeps visible reason text localized without internal ids', () => {
    const state = build([
      session('push-a', '2026-04-27'),
      session('legs-a', '2026-04-28'),
      session('pull-a', '2026-04-30'),
      session('push-a', '2026-05-02'),
      session('pull-a', '2026-05-03'),
    ]);

    expect(state.reason).toMatch(/[一-龥]/);
    expect(state.reason).not.toMatch(/push-a|pull-a|legs-a|undefined|null/);
  });
});
