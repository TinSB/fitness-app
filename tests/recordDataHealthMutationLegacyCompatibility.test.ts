import { describe, expect, it } from 'vitest';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src';
import { buildPrs } from '../src/engines/analytics';
import { analyzeImportedAppData, canImportDataRepairReport, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { exportAppData, importAppData } from '../src/storage/backup';
import { buildAppDataFromFixture, loadRealDataFixture } from './helpers/realDataFixture';
import {
  collectActualWeightSnapshots,
  expectNoNextData,
  NOW,
} from './recordDataHealthMutationFixtures';

describe('record/DataHealth mutation legacy compatibility', () => {
  it('keeps legacy display weight repair semantics and actualWeightKg as the calculation source', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');
    const beforeActualWeights = collectActualWeightSnapshots(data);
    const beforeStats = {
      volume: data.history.map((session) => session.exercises.flatMap((exercise) => exercise.sets || []).length),
      prs: buildPrs(data.history),
      e1rm: buildE1RMProfile(data.history, data.history[0]?.exercises?.[0]?.id || '').best?.e1rmKg,
      effectiveSets: buildEffectiveVolumeSummary(data.history).effectiveSets,
    };

    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/data-health/repair/apply',
      nowIso: NOW,
      body: { repairType: 'legacy_display_weight', confirmRepair: true },
    });

    if (response.result.changed) {
      expect(response.nextData).toBeDefined();
      expect(collectActualWeightSnapshots(response.nextData!)).toEqual(beforeActualWeights);
      expect(buildPrs(response.nextData!.history)).toEqual(beforeStats.prs);
      expect(buildE1RMProfile(response.nextData!.history, response.nextData!.history[0]?.exercises?.[0]?.id || '').best?.e1rmKg).toEqual(beforeStats.e1rm);
      expect(buildEffectiveVolumeSummary(response.nextData!.history).effectiveSets).toBe(beforeStats.effectiveSets);
      expect(JSON.stringify(response.nextData!.settings.dataRepairLogs || [])).not.toMatch(/"history"|"session"|"exercises"|"sets"/);
    } else {
      expectNoNextData(response);
    }
  });

  it('keeps identityInvalid out of PR, e1RM and effectiveSet calculations through the boundary', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const report = buildDataHealthReport(data);

    expect(report.issues.some((issue) => issue.id.includes('identity') || issue.title.includes('身份'))).toBe(true);
    expect(buildPrs(data.history).some((item) => item.exerciseId.includes('__alt_'))).toBe(false);
    expect(buildE1RMProfile(data.history, '__alt_legacy_pull').best).toBeUndefined();
    expect(buildEffectiveVolumeSummary(data.history).effectiveSets).toBeGreaterThanOrEqual(0);
  });

  it('does not change backup import/export unsafe, cleaned or needs-review semantics', () => {
    const unsafeImport = importAppData(JSON.stringify({ source: 'health-json', samples: [] }));
    expect(unsafeImport.ok).toBe(false);

    const cleanedData = buildAppDataFromFixture('legacy-unit-display');
    const cleanedImport = importAppData(exportAppData(cleanedData));
    expect(cleanedImport.ok).toBe(true);

    const rawNeedsReview = loadRealDataFixture('legacy-assisted-pullup-session').data;
    const report = analyzeImportedAppData(rawNeedsReview);
    if (report.status === 'needs_review') {
      expect(canImportDataRepairReport(report)).toBe(true);
      const repaired = repairImportedAppData(rawNeedsReview, report);
      const repairedImport = importAppData(exportAppData(repaired.repairedData));
      expect(repairedImport.ok).toBe(true);
    } else {
      expect(['safe', 'needs_review']).toContain(report.status);
    }
  });
});
