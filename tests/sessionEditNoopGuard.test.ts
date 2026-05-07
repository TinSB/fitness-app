import { describe, expect, it } from 'vitest';
import { markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { markSessionEdited } from '../src/engines/sessionEditEngine';
import { makeAppData, makeSession } from './fixtures';

const makeEditableSession = () =>
  makeSession({
    id: 'noop-edit-session',
    date: '2026-05-06',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

describe('session edit no-op guard', () => {
  it('does not append editHistory for a no-op working-set save', () => {
    const session = makeEditableSession();
    const draft = { ...session };
    const edited = markSessionEdited(draft, ['sets'], '历史训练详情修正', session);

    expect(edited).toBe(draft);
    expect(edited.editHistory).toBeUndefined();
  });

  it('does not append editHistory for a no-op dataFlag save', () => {
    const session = makeEditableSession();
    const edited = markSessionEdited({ ...session, dataFlag: 'normal' }, ['dataFlag'], '历史训练数据状态修正', session);

    expect(edited.editHistory).toBeUndefined();
  });

  it('does not append editHistory when dataFlag mutation is unchanged through the history engine', () => {
    const session = { ...makeEditableSession(), dataFlag: 'excluded' as const };
    const result = markSessionDataFlag(makeAppData({ history: [session] }), session.id, 'excluded', true);

    expect(result.changed).toBe(false);
    expect(result.session?.editHistory).toBeUndefined();
    expect(result.message).toBe('这次训练已经排除统计。');
  });
});
