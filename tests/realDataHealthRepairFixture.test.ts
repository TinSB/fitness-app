import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/models/training-model';
import { buildCleanAppDataView, cleanAppDataViewIsDirty } from '../src/dataHealth/cleanAppDataView';
import { getAppDataRepairRegistry, V1_REPAIR_IDS } from '../src/dataHealth/appDataRepairRegistry';

const FIXTURE_PATH = resolve(__dirname, './fixtures/data-health/ironpath-2026-05-27-redacted.json');

const loadFixture = (): AppData => {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  return JSON.parse(raw) as AppData;
};

describe('realDataHealthRepairFixture', () => {
  it('realDataHealthRepairFixtureLoadsWithoutCrashing — fixture parses with schemaVersion 8', () => {
    const data = loadFixture();
    expect(data.schemaVersion).toBe(8);
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBe(10);
  });

  it('realDataHealthRepairFixtureExposesDirtyDataAcrossClasses — clean view diagnostics catch every class', () => {
    const data = loadFixture();
    const view = buildCleanAppDataView(data, { now: () => new Date('2026-05-27T00:00:00Z') });
    expect(cleanAppDataViewIsDirty(view)).toBe(true);
    expect(view.guardDiagnostics.lifecycleResidueSessionIds.length).toBeGreaterThanOrEqual(10);
    expect(view.guardDiagnostics.invalidDurationSessionIds.length).toBeGreaterThanOrEqual(1);
    expect(view.guardDiagnostics.staleTodayStatus).toBe(true);
    expect(view.guardDiagnostics.staleHealthData).toBe(true);
    expect(view.guardDiagnostics.cappedIssueScoreKeys).toEqual(
      expect.arrayContaining(['scapular_control', 'upper_crossed', 'breathing_ribcage', 'thoracic_rotation']),
    );
    expect(view.guardDiagnostics.legacyAdviceSessionIds.length).toBeGreaterThanOrEqual(10);
  });

  it('realDataHealthRepairRegistryListsAllV1Ids — registry exposes the V1 repair set', () => {
    const registry = getAppDataRepairRegistry();
    expect(registry.list().map((r) => r.repairId)).toEqual(V1_REPAIR_IDS);
    expect(V1_REPAIR_IDS).toEqual(
      expect.arrayContaining([
        'sessionLifecycleResidueV1',
        'impossibleDurationV1',
        'staleTodayStatusV1',
        'staleHealthReadinessGuardV1',
        'screeningIssueScoreRuntimeGuardV1',
        'screeningIssueScoreRepairV1',
        'legacyFinalAdviceIsolationGuardV1',
        'setIndexRenumberV1',
        'replacementEquivalenceAuditV1',
      ]),
    );
  });
});
