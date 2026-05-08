import { describe, expect, it } from 'vitest';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import {
  expectNoNextData,
  makeNeedsReviewWeightData,
  makeRecordData,
  makeRepairableWeightData,
  NOW,
} from './recordDataHealthMutationFixtures';

describe('record/DataHealth mutation invalid boundaries', () => {
  it('rejects missing records, invalid edit bodies and no-op edits without nextData', () => {
    const data = makeRecordData();

    const missing = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/missing/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { reps: 9 },
      },
    });
    expect(missing.result.reasonCode).toBe('record_not_found');
    expectNoNextData(missing);

    const invalid = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { reps: Number.NaN },
      },
    });
    expect(invalid.result.reasonCode).toBe('record_edit_invalid');
    expectNoNextData(invalid);

    const noChange = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 100, reps: 8 },
      },
    });
    expect(noChange.result.reasonCode).toBe('record_no_change');
    expectNoNextData(noChange);
  });

  it('rejects invalid, missing and no-op dataFlag mutations without nextData', () => {
    const data = makeRecordData();

    const invalid = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'archived' },
    });
    expect(invalid.result.reasonCode).toBe('record_edit_invalid');
    expectNoNextData(invalid);

    const missing = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/missing/data-flag',
      body: { dataFlag: 'excluded' },
    });
    expect(missing.result.reasonCode).toBe('record_not_found');
    expectNoNextData(missing);

    const noChange = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'normal' },
    });
    expect(noChange.result.reasonCode).toBe('record_no_change');
    expectNoNextData(noChange);
  });

  it('rejects missing and repeated DataHealth dismiss actions without nextData', () => {
    const data = makeRepairableWeightData();
    const issue = buildDataHealthReport(data).issues.find((item) => item.canAutoFix);
    expect(issue).toBeDefined();

    const missing = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/data-health/issues/missing/dismiss',
      nowIso: NOW,
    });
    expect(missing.result.reasonCode).toBe('data_health_issue_not_found');
    expectNoNextData(missing);

    const dismissed = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: `/data-health/issues/${encodeURIComponent(issue!.id)}/dismiss`,
      nowIso: NOW,
    });
    expect(dismissed.nextData).toBeDefined();

    const repeated = handleRecordDataHealthMutationRequest(dismissed.nextData!, {
      method: 'POST',
      path: `/data-health/issues/${encodeURIComponent(issue!.id)}/dismiss`,
      nowIso: NOW,
    });
    expect(repeated.result.reasonCode).toBe('data_health_no_change');
    expectNoNextData(repeated);
  });

  it('guards repair confirmation, unsupported repair types, unsafe import-like payloads and review-only data', () => {
    const repairable = makeRepairableWeightData();

    const unconfirmed = handleRecordDataHealthMutationRequest(repairable, {
      method: 'POST',
      path: '/data-health/repair/apply',
      body: { repairType: 'legacy_display_weight' },
    });
    expect(unconfirmed.result).toMatchObject({
      reasonCode: 'data_health_repair_requires_confirmation',
      requiresConfirmation: true,
    });
    expectNoNextData(unconfirmed);

    const unsupported = handleRecordDataHealthMutationRequest(repairable, {
      method: 'POST',
      path: '/data-health/repair/apply',
      body: { repairType: 'guess_real_weight', confirmRepair: true },
    });
    expect(unsupported.result.reasonCode).toBe('data_health_repair_not_supported');
    expectNoNextData(unsupported);

    const unsafe = handleRecordDataHealthMutationRequest(repairable, {
      method: 'POST',
      path: '/data-health/repair/apply',
      body: {
        repairType: 'legacy_display_weight',
        confirmRepair: true,
        importData: { source: 'health-json', samples: [] },
      },
    });
    expect(unsafe.result.reasonCode).toBe('unsafe_import_rejected');
    expectNoNextData(unsafe);

    const reviewOnly = handleRecordDataHealthMutationRequest(makeNeedsReviewWeightData(), {
      method: 'POST',
      path: '/data-health/repair/apply',
      body: { repairType: 'legacy_display_weight', confirmRepair: true },
    });
    expect(reviewOnly.result.reasonCode).toBe('data_health_no_change');
    expectNoNextData(reviewOnly);
  });
});
