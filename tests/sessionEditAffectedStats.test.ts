import { describe, expect, it } from 'vitest';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { makeAppData, makeSession } from './fixtures';

const makeEditableSession = () =>
  makeSession({
    id: 'affected-stats-session',
    date: '2026-05-05',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

const latestAffectedStats = (session: ReturnType<typeof makeEditableSession>) =>
  session.editHistory?.at(-1)?.affectedStats || [];

describe('session edit affected stats', () => {
  it('maps working set weight and reps changes to volume, effectiveSet, PR, and e1RM', () => {
    const before = makeEditableSession();
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 102.5, reps: 9 }),
      ['sets'],
      '历史训练详情修正',
      before,
    );

    expect(edited.editHistory?.at(-1)?.changedFields).toEqual(['weight', 'reps']);
    expect(latestAffectedStats(edited)).toEqual(['volume', 'effectiveSet', 'PR', 'e1RM']);
  });

  it('maps RIR-only changes to effectiveSet only', () => {
    const before = makeEditableSession();
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { rir: 1 }),
      ['sets'],
      '历史训练详情修正',
      before,
    );

    expect(edited.editHistory?.at(-1)?.changedFields).toEqual(['rir']);
    expect(latestAffectedStats(edited)).toEqual(['effectiveSet']);
  });

  it('maps technique and pain changes to effectiveSet and sessionQuality', () => {
    const before = makeEditableSession();
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { techniqueQuality: 'poor', painFlag: true }),
      ['sets'],
      '历史训练详情修正',
      before,
    );

    expect(edited.editHistory?.at(-1)?.changedFields).toEqual(['techniqueQuality', 'painFlag']);
    expect(latestAffectedStats(edited)).toEqual(['effectiveSet', 'sessionQuality']);
  });

  it('maps note-only changes to none', () => {
    const before = makeEditableSession();
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { note: '补记握距' }),
      ['sets'],
      '历史训练详情修正',
      before,
    );

    expect(edited.editHistory?.at(-1)?.editType).toBe('note');
    expect(edited.editHistory?.at(-1)?.changedFields).toEqual(['note']);
    expect(latestAffectedStats(edited)).toEqual(['none']);
  });

  it('maps dataFlag changes to calendar and default-stat participation', () => {
    const before = makeEditableSession();
    const result = markSessionDataFlag(makeAppData({ history: [before] }), before.id, 'test', true);

    expect(result.session?.editHistory?.at(-1)?.changedFields).toEqual(['dataFlag']);
    expect(result.session?.editHistory?.at(-1)?.affectedStats).toEqual(['calendar', 'effectiveSet', 'PR', 'e1RM']);
  });
});
