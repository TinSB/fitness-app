import { describe, expect, it } from 'vitest';
import { markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const makeEditableSession = () =>
  makeSession({
    id: 'edit-history-trust',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

describe('session edit history trust', () => {
  it('records before and after summary plus affected stats when a working set is edited', () => {
    const before = makeEditableSession();
    const beforeSummary = buildSessionDetailSummary(before);
    const afterDraft = updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 100, reps: 8, rir: 1 });
    const after = markSessionEdited(afterDraft, ['sets'], '历史训练详情修正', before);
    const entry = after.editHistory?.at(-1);

    expect(entry).toMatchObject({
      editType: 'working_set',
      fields: ['sets'],
      editedFields: ['sets'],
      changedFields: ['weight', 'rir'],
      beforeSummaryText: '正式组 1：80kg × 8 / RIR 2',
      afterSummaryText: '正式组 1：100kg × 8 / RIR 1',
      affectedStats: ['volume', 'effectiveSet', 'PR', 'e1RM'],
      beforeSummary: expect.objectContaining({
        completedWorkingSets: beforeSummary.completedWorkingSets,
        workingVolume: beforeSummary.workingVolume,
      }),
      afterSummary: expect.objectContaining({
        workingVolume: buildSessionDetailSummary(afterDraft).workingVolume,
      }),
    });
    expect(entry?.id).toContain('edit-history-trust:edit');
    expect(entry?.editedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records warmup edits as not affecting PR, e1RM, or effective sets', () => {
    const before = {
      ...makeEditableSession(),
      focusWarmupSetLogs: [
        {
          id: 'main:bench-press:warmup:0',
          exerciseId: 'bench-press',
          type: 'warmup',
          weight: 20,
          actualWeightKg: 20,
          reps: 8,
          rir: '',
          done: true,
        },
      ],
    };
    const afterDraft = updateSessionSet(before, 'bench-press', 'main:bench-press:warmup:0', { weightKg: 40, reps: 6 });
    const after = markSessionEdited(afterDraft, ['warmupSets'], '历史训练热身组修正', before);
    const entry = after.editHistory?.at(-1);

    expect(entry).toMatchObject({
      editType: 'warmup_set',
      changedFields: ['weight', 'reps'],
      affectedStats: ['none'],
      beforeSummaryText: '热身组 1：20kg × 8',
      afterSummaryText: '热身组 1：40kg × 6',
    });
    expect(entry?.beforeSummary?.effectiveSets).toBe(entry?.afterSummary?.effectiveSets);
    expect(entry?.afterSummary?.warmupVolume).toBeGreaterThan(entry?.beforeSummary?.warmupVolume || 0);
  });

  it('records dataFlag changes as statistics participation changes', () => {
    const session = makeEditableSession();
    const result = markSessionDataFlag(makeAppData({ history: [session] }), session.id, 'excluded', true);
    const entry = result.session?.editHistory?.at(-1);

    expect(result.changed).toBe(true);
    expect(entry).toMatchObject({
      editType: 'data_flag',
      fields: ['dataFlag'],
      editedFields: ['dataFlag'],
      changedFields: ['dataFlag'],
      affectedStats: ['calendar', 'effectiveSet', 'PR', 'e1RM'],
      beforeSummaryText: '正常数据',
      afterSummaryText: '排除数据，不参与默认统计',
      beforeSummary: expect.objectContaining({ dataFlag: 'normal' }),
      afterSummary: expect.objectContaining({ dataFlag: 'excluded' }),
    });
  });

  it('does not write editHistory when an edit draft is discarded before save', () => {
    const session = makeEditableSession();
    const discardedDraft = updateSessionSet(session, 'bench-press', 'bench-press-1', { weightKg: 120 });

    expect(discardedDraft.editHistory).toBeUndefined();
    expect(session.editHistory).toBeUndefined();
    expect(buildSessionDetailSummary(session).workingVolume).toBe(80 * 8);
  });

  it('preserves enhanced edit history through sanitize round-trip without retaining full objects', () => {
    const before = makeEditableSession();
    const after = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 100 }),
      ['sets'],
      '历史训练详情修正',
      before,
    );
    const unsafeEntry = {
      ...(after.editHistory?.at(-1) || {}),
      session: before,
      set: before.exercises[0].sets[0],
      history: [before],
    };
    const sanitized = sanitizeData(makeAppData({ history: [{ ...after, editHistory: [unsafeEntry] }] }));
    const entry = sanitized.history[0].editHistory?.at(-1) as Record<string, unknown> | undefined;

    expect(entry?.editedFields).toEqual(['sets']);
    expect(entry?.changedFields).toEqual(['weight']);
    expect(entry?.affectedStats).toEqual(['volume', 'effectiveSet', 'PR', 'e1RM']);
    expect(entry?.beforeSummaryText).toBe('正式组 1：80kg × 8 / RIR 2');
    expect(entry?.afterSummaryText).toBe('正式组 1：100kg × 8 / RIR 2');
    expect(entry?.beforeSummary).toMatchObject({ workingVolume: 80 * 8 });
    expect(entry?.afterSummary).toMatchObject({ workingVolume: 100 * 8 });
    expect(entry?.session).toBeUndefined();
    expect(entry?.set).toBeUndefined();
    expect(entry?.history).toBeUndefined();
  });
});
