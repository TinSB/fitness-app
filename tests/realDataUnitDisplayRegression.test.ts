import { describe, expect, it } from 'vitest';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import { analyzeImportedAppData, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { sessionVolume } from '../src/engines/engineUtils';
import { formatWeight } from '../src/engines/unitConversionEngine';
import type { AppData } from '../src/models/training-model';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const rawData = () => ({
  ...makeAppData(),
  ...(unitFixture.data as Partial<AppData>),
});

const fixtureData = () => sanitizeData(rawData());

describe('real data legacy unit display regression', () => {
  it('uses actualWeightKg as the calculation source and ignores stale display fields for volume', () => {
    const data = fixtureData();
    const session = data.history.find((item) => item.id === 'fixture-unit-actual-source');
    const set = session?.exercises[0]?.sets?.[0];

    expect(set).toMatchObject({
      actualWeightKg: 52.6,
      displayWeight: 0,
      displayUnit: 'lb',
      reps: 10,
    });
    expect(sessionVolume(session)).toBe(526);
    expect(formatWeight(set?.actualWeightKg, data.unitSettings)).toBe('116lb');
  });

  it('repairs inconsistent display fields without losing actualWeightKg', () => {
    const result = repairImportedAppData(rawData(), { repairDate: '2026-05-04' });
    const repairedSession = result.repairedData.history.find((item) => item.id === 'fixture-unit-actual-source');
    const repairedSet = repairedSession?.exercises[0]?.sets?.[0];

    expect(repairedSet?.actualWeightKg).toBe(52.6);
    expect(repairedSet?.displayWeight).toBeUndefined();
    expect(repairedSet?.displayUnit).toBeUndefined();
    expect(result.repairLog.some((entry) => entry.category === 'unit')).toBe(true);
    expect(JSON.stringify(result.repairLog)).not.toContain('"exercises"');
    expect(JSON.stringify(result.repairLog)).not.toContain('"history"');
  });

  it('keeps legacy display fields and requests review when actualWeightKg is missing', () => {
    const report = analyzeImportedAppData(rawData());
    const result = repairImportedAppData(rawData(), { repairDate: '2026-05-04' });
    const missingSession = result.repairedData.history.find((item) => item.id === 'fixture-unit-missing-actual');
    const missingSet = missingSession?.exercises[0]?.sets?.[0];

    expect(report.status).toBe('needs_review');
    expect(missingSet?.actualWeightKg).toBeUndefined();
    expect(missingSet?.displayWeight).toBe(120);
    expect(missingSet?.displayUnit).toBe('lb');
  });
});
