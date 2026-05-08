import { describe, expect, it } from 'vitest';
import { buildReadMirrorHistoryDetail, buildReadMirrorHistoryList, handleRecordDataHealthMutationRequest } from '../apps/api/src';
import { dismissDataHealthIssueToday, buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { repairLegacyDisplayWeights } from '../src/engines/dataHealthRepairEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import type { TrainingSession } from '../src/models/training-model';
import {
  makeRecordData,
  makeRepairableWeightData,
  NOW,
} from './recordDataHealthMutationFixtures';

const normalizeAudit = (session: TrainingSession) => ({
  ...session,
  editedAt: session.editedAt ? '<editedAt>' : undefined,
  editHistory: (session.editHistory || []).map((entry) => ({
    ...entry,
    id: entry.id ? '<id>' : undefined,
    editedAt: '<editedAt>',
  })),
});

describe('record/DataHealth mutation parity', () => {
  it('matches existing record edit helpers and keeps read mirrors aligned', () => {
    const data = makeRecordData();
    const before = data.history[0];
    const helperSession = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 105, reps: 8 }),
      ['sets'],
      '历史训练详情修正',
      before,
      data.unitSettings,
    );

    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/edit',
      nowIso: NOW,
      body: {
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, reps: 8 },
      },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    const edited = response.nextData!.history[0];
    expect(normalizeAudit(edited)).toEqual(normalizeAudit(helperSession));
    expect(buildSessionDetailSummary(edited)).toMatchObject(buildSessionDetailSummary(helperSession));
    expect(buildReadMirrorHistoryDetail(response.nextData!, edited.id)?.summary).toMatchObject(buildSessionDetailSummary(edited));
    expect(buildReadMirrorHistoryList(response.nextData!).sessions[0]).toMatchObject({
      id: edited.id,
      completedWorkingSets: buildSessionDetailSummary(edited).completedWorkingSets,
      workingVolumeKg: buildSessionDetailSummary(edited).workingVolumeKg,
    });
    expect(buildTrainingCalendar(response.nextData!.history, '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-04')?.sessions[0]).toMatchObject({
      sessionId: edited.id,
      totalVolumeKg: buildSessionDetailSummary(edited).workingVolumeKg,
    });
  });

  it('matches existing dataFlag helper while preserving visibility and default-stat exclusion', () => {
    const data = makeRecordData();
    const expected = markSessionDataFlag(data, 'record-mutation-session', 'excluded', true);
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      nowIso: NOW,
      body: { dataFlag: 'excluded' },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    const session = response.nextData!.history[0];
    expect(session.dataFlag).toBe('excluded');
    expect(normalizeAudit(session)).toEqual(normalizeAudit(expected.session!));
    expect(filterAnalyticsHistory(response.nextData!.history)).toHaveLength(0);
    expect(buildEffectiveVolumeSummary(response.nextData!.history).completedSets).toBe(0);
    expect(buildSessionDetailSummary(session).excludedFromStats).toBe(true);
    expect(buildReadMirrorHistoryDetail(response.nextData!, session.id)?.session).toBeDefined();
  });

  it('matches existing DataHealth dismiss behavior', () => {
    const data = makeRepairableWeightData();
    const issue = buildDataHealthReport(data).issues.find((item) => item.canAutoFix);
    expect(issue).toBeDefined();

    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: `/data-health/issues/${encodeURIComponent(issue!.id)}/dismiss`,
      nowIso: NOW,
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'data_health_issue_dismissed' });
    expect(response.nextData!.dismissedDataHealthIssues).toEqual([dismissDataHealthIssueToday(issue!.id, NOW)]);
    expect(response.nextData!.settings.dismissedDataHealthIssues).toEqual([dismissDataHealthIssueToday(issue!.id, NOW)]);
    expect(response.nextData!.history).toEqual(data.history);
  });

  it('matches existing legacy display weight repair helper', () => {
    const data = makeRepairableWeightData();
    const expected = repairLegacyDisplayWeights(data, { repairedAt: NOW });
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/data-health/repair/apply',
      nowIso: NOW,
      body: { repairType: 'legacy_display_weight', confirmRepair: true },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'data_health_repair_applied' });
    expect(response.nextData).toEqual(expected.repairedData);
    expect(buildDataHealthReport(response.nextData!).issues.filter((issue) => issue.canAutoFix)).toHaveLength(0);
  });
});
