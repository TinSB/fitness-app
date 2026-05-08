import { describe, expect, it } from 'vitest';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import {
  expectNextDataRule,
  makeRecordData,
  makeRepairableWeightData,
  NOW,
} from './recordDataHealthMutationFixtures';

describe('record/DataHealth mutation no in-place mutation boundary', () => {
  it('does not mutate input AppData for changed edit, dataFlag, dismiss and repair paths', () => {
    const editData = makeRecordData();
    const editBefore = JSON.stringify(editData);
    const editResponse = handleRecordDataHealthMutationRequest(editData, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      nowIso: NOW,
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, reps: 8 },
      },
    });
    expect(editResponse.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(JSON.stringify(editData)).toBe(editBefore);
    expectNextDataRule(editResponse);

    const flagData = makeRecordData();
    const flagBefore = JSON.stringify(flagData);
    const flagResponse = handleRecordDataHealthMutationRequest(flagData, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      nowIso: NOW,
      body: { dataFlag: 'excluded' },
    });
    expect(flagResponse.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(JSON.stringify(flagData)).toBe(flagBefore);
    expectNextDataRule(flagResponse);

    const dismissData = makeRepairableWeightData();
    const issue = buildDataHealthReport(dismissData).issues.find((item) => item.canAutoFix);
    expect(issue).toBeDefined();
    const dismissBefore = JSON.stringify(dismissData);
    const dismissResponse = handleRecordDataHealthMutationRequest(dismissData, {
      method: 'POST',
      path: `/data-health/issues/${encodeURIComponent(issue!.id)}/dismiss`,
      nowIso: NOW,
    });
    expect(dismissResponse.result).toMatchObject({ ok: true, changed: true, reasonCode: 'data_health_issue_dismissed' });
    expect(JSON.stringify(dismissData)).toBe(dismissBefore);
    expectNextDataRule(dismissResponse);

    const repairData = makeRepairableWeightData();
    const repairBefore = JSON.stringify(repairData);
    const repairResponse = handleRecordDataHealthMutationRequest(repairData, {
      method: 'POST',
      path: '/data-health/repair/apply',
      nowIso: NOW,
      body: { repairType: 'legacy_display_weight', confirmRepair: true },
    });
    expect(repairResponse.result).toMatchObject({ ok: true, changed: true, reasonCode: 'data_health_repair_applied' });
    expect(JSON.stringify(repairData)).toBe(repairBefore);
    expectNextDataRule(repairResponse);
  });

  it('never returns nextData for failure, no-op, confirmation or unsupported paths', () => {
    const data = makeRecordData();
    const responses = [
      handleRecordDataHealthMutationRequest(data, { method: 'POST', path: '/history/missing/edit', body: {} }),
      handleRecordDataHealthMutationRequest(data, {
        method: 'POST',
        path: '/history/record-mutation-session/data-flag',
        body: { dataFlag: 'normal' },
      }),
      handleRecordDataHealthMutationRequest(data, { method: 'POST', path: '/data-health/issues/missing/dismiss', nowIso: NOW }),
      handleRecordDataHealthMutationRequest(makeRepairableWeightData(), {
        method: 'POST',
        path: '/data-health/repair/apply',
        body: { repairType: 'legacy_display_weight' },
      }),
      handleRecordDataHealthMutationRequest(data, { method: 'POST', path: '/missing' }),
    ];

    responses.forEach((response) => {
      expect(response.nextData).toBeUndefined();
      expect(response.result.ok === true && response.result.changed === true).toBe(false);
      expectNextDataRule(response);
    });
  });
});
