import { describe, expect, it } from 'vitest';
import { buildReadMirrorHistoryDetail, buildReadMirrorSessionsSummary } from '../apps/api/src';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src/recordDataHealthMutation';
import { filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import {
  expectNoNextData,
  expectNextDataRule,
  makeRecordData,
  NOW,
} from './recordDataHealthMutationFixtures';

describe('Dev API History data-flag server parity', () => {
  it('returns nextData only for changed dataFlag mutations and preserves readMirror parity', () => {
    const data = makeRecordData();
    const expected = markSessionDataFlag(data, 'record-mutation-session', 'excluded', true);
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      nowIso: NOW,
      body: { dataFlag: 'excluded' },
    });

    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'record_updated',
    });
    expectNextDataRule(response);
    expect(response.nextData!.history[0].dataFlag).toBe('excluded');
    expect(response.nextData!.history[0].editHistory?.at(-1)?.changedFields).toEqual(['dataFlag']);
    expect(response.nextData!.history[0].editHistory?.at(-1)?.affectedStats).toEqual(['calendar', 'effectiveSet', 'PR', 'e1RM']);
    expect(response.nextData!.history[0]).toMatchObject({
      id: expected.session!.id,
      dataFlag: expected.session!.dataFlag,
      completed: expected.session!.completed,
      exercises: expected.session!.exercises,
    });
    expect(filterAnalyticsHistory(response.nextData!.history)).toHaveLength(0);
    expect(buildReadMirrorSessionsSummary(response.nextData!).byDataFlag.excluded).toBe(1);
    expect(buildReadMirrorHistoryDetail(response.nextData!, 'record-mutation-session')?.session.dataFlag).toBe('excluded');
  });

  it('does not expose nextData for no-op, not-found, or invalid dataFlag mutations', () => {
    const data = makeRecordData();
    const noChange = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'normal' },
    });
    const notFound = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/missing/data-flag',
      body: { dataFlag: 'excluded' },
    });
    const invalid = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'archived' },
    });

    expect(noChange.result).toMatchObject({ ok: true, changed: false, reasonCode: 'record_no_change' });
    expect(notFound.result).toMatchObject({ ok: false, changed: false, reasonCode: 'record_not_found' });
    expect(invalid.result).toMatchObject({ ok: false, changed: false, reasonCode: 'record_edit_invalid' });
    expectNoNextData(noChange);
    expectNoNextData(notFound);
    expectNoNextData(invalid);
  });
});
