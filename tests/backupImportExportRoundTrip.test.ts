import { describe, expect, it } from 'vitest';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import {
  analyzeImportedAppData,
  canImportDataRepairReport,
  repairImportedAppData,
} from '../src/engines/dataRepairEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionVolume } from '../src/engines/engineUtils';
import { buildPendingSessionPatch, markPendingSessionPatchConsumed, type SessionPatch } from '../src/engines/sessionPatchEngine';
import type { AppData } from '../src/models/training-model';
import { exportAppData, importAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const patch: SessionPatch = {
  id: 'backup-round-trip-patch',
  type: 'reduce_intensity',
  title: '降低强度',
  description: '本次训练保守推进。',
  reason: '状态一般。',
  reversible: true,
};

const makeBackupData = () => {
  const basePending = buildPendingSessionPatch({
    patches: [patch],
    createdAt: '2026-05-04',
    sourceFingerprint: 'backup-round-trip:push-a:conservative',
    targetTemplateId: 'push-a',
  });
  const pendingSessionPatches = markPendingSessionPatchConsumed([basePending], basePending.id, '2026-05-04T08:00:00.000Z');

  return sanitizeData(
    makeAppData({
      selectedTemplateId: 'push-a',
      activeProgramTemplateId: 'push-a',
      history: [
        makeSession({
          id: 'backup-session-1',
          date: '2026-05-03',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
        }),
      ],
      pendingSessionPatches,
      dismissedCoachActions: [{ actionId: 'coach-action-1', dismissedAt: '2026-05-04T08:05:00.000Z', scope: 'today' }],
      dismissedDataHealthIssues: [{ issueId: 'data-health-1', dismissedAt: '2026-05-04T08:06:00.000Z', scope: 'today' }],
      settings: {
        pendingSessionPatches,
        dismissedCoachActions: [{ actionId: 'coach-action-1', dismissedAt: '2026-05-04T08:05:00.000Z', scope: 'today' }],
        dismissedDataHealthIssues: [{ issueId: 'data-health-1', dismissedAt: '2026-05-04T08:06:00.000Z', scope: 'today' }],
        dataRepairLogs: [
          {
            id: 'backup-repair-log-1',
            createdAt: '2026-05-04T08:07:00.000Z',
            sourceFileName: 'anonymous-cleaned.json',
            category: 'unit',
            action: '移除旧显示重量覆盖',
            affectedIds: ['backup-session-1'],
            before: { displayWeight: 0, displayUnit: 'lb' },
            after: { actualWeightKg: 80 },
          },
        ],
      },
    }),
  );
};

const importWithRepairConfirmation = (currentData: AppData, rawData: unknown, confirmed: boolean) => {
  const report = analyzeImportedAppData(rawData);
  if (report.status === 'unsafe') {
    return { ok: false as const, data: currentData, report, error: report.issues[0]?.message || '导入失败，请检查备份文件。' };
  }
  if (report.status === 'needs_review' && !confirmed) {
    return { ok: false as const, data: currentData, report, error: '导入前需要确认修复预览。' };
  }
  const repaired = repairImportedAppData(rawData, { repairDate: '2026-05-04', sourceFileName: 'anonymous-minimal.json' });
  return { ok: true as const, data: repaired.repairedData, report: repaired.report, repairLog: repaired.repairLog };
};

describe('backup import/export round-trip regression', () => {
  it('exports backup JSON and imports it without losing key AppData state', () => {
    const original = makeBackupData();
    const exported = exportAppData(original);
    const imported = importAppData(exported);

    expect(imported.ok).toBe(true);
    expect(imported.data?.history.map((session) => session.id)).toEqual(['backup-session-1']);
    expect(imported.data?.selectedTemplateId).toBe('push-a');
    expect(imported.data?.activeProgramTemplateId).toBe('push-a');
    expect(imported.data?.pendingSessionPatches?.[0]).toMatchObject({ status: 'consumed', consumedAt: '2026-05-04T08:00:00.000Z' });
    expect(imported.data?.dismissedCoachActions).toEqual(original.dismissedCoachActions);
    expect(imported.data?.dismissedDataHealthIssues).toEqual(original.dismissedDataHealthIssues);
    expect(imported.data?.settings.dataRepairLogs?.[0]).toMatchObject({ category: 'unit', affectedIds: ['backup-session-1'] });
    expect(buildEffectiveVolumeSummary(imported.data?.history || []).completedSets).toBe(
      buildEffectiveVolumeSummary(original.history).completedSets,
    );
  });

  it('keeps dataRepairLogs as audit summaries without changing training calculations', () => {
    const data = makeBackupData();
    const withoutRepairLogs = sanitizeData({ ...data, settings: { ...data.settings, dataRepairLogs: [] } });

    expect(data.settings.dataRepairLogs).toHaveLength(1);
    expect(sessionVolume(data.history[0])).toBe(sessionVolume(withoutRepairLogs.history[0]));
    expect(buildEffectiveVolumeSummary(data.history).effectiveSets).toBe(buildEffectiveVolumeSummary(withoutRepairLogs.history).effectiveSets);
  });

  it('allows a repaired cleaned JSON export to be imported again', () => {
    const current = makeBackupData();
    const rawNeedsReview = {
      ...makeAppData(),
      ...(unitFixture.data as Partial<AppData>),
    };
    const repairedImport = importWithRepairConfirmation(current, rawNeedsReview, true);
    if (!repairedImport.ok) throw new Error('expected repaired import to succeed');
    const cleanedJson = exportAppData(repairedImport.data);
    const secondImport = importAppData(cleanedJson);

    expect(repairedImport.repairLog.length).toBeGreaterThan(0);
    expect(secondImport.ok).toBe(true);
    expect(secondImport.data?.history.map((session) => session.id)).toEqual([
      'fixture-unit-actual-source',
      'fixture-unit-missing-actual',
    ]);
    expect(JSON.stringify(secondImport.data?.settings.dataRepairLogs)).not.toContain('"history"');
    expect(JSON.stringify(secondImport.data?.settings.dataRepairLogs)).not.toContain('"exercises"');
  });

  it('blocks unsafe or invalid backup input without replacing current AppData', () => {
    const current = makeBackupData();
    const unsafe = importWithRepairConfirmation(current, { source: 'health-json', samples: [] }, true);
    const unsafeDirectBackupImport = importAppData(JSON.stringify({ source: 'health-json', samples: [] }));
    const invalidJson = importAppData('{not json');

    expect(unsafe.ok).toBe(false);
    expect(unsafe.data).toBe(current);
    expect(unsafe.report.status).toBe('unsafe');
    expect(unsafeDirectBackupImport.ok).toBe(false);
    expect(unsafeDirectBackupImport.data).toBeUndefined();
    expect(invalidJson.ok).toBe(false);
    expect(invalidJson.data).toBeUndefined();
    expect(invalidJson.error).toContain('JSON');
    expect(invalidJson.error).not.toMatch(/undefined|null/);
  });

  it('requires explicit confirmation before importing needs_review repaired data', () => {
    const current = makeBackupData();
    const rawNeedsReview = {
      ...makeAppData(),
      ...(unitFixture.data as Partial<AppData>),
    };
    const report = analyzeImportedAppData(rawNeedsReview);
    const withoutConfirmation = importWithRepairConfirmation(current, rawNeedsReview, false);
    const withConfirmation = importWithRepairConfirmation(current, rawNeedsReview, true);

    expect(report.status).toBe('needs_review');
    expect(canImportDataRepairReport(report)).toBe(true);
    expect(withoutConfirmation.ok).toBe(false);
    expect(withoutConfirmation.data).toBe(current);
    expect(withConfirmation.ok).toBe(true);
    expect(withConfirmation.data.history.map((session) => session.id)).toEqual([
      'fixture-unit-actual-source',
      'fixture-unit-missing-actual',
    ]);
  });
});
