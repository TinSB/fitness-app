import { describe, expect, it } from 'vitest';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import { analyzeImportedAppData, canImportDataRepairReport, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { exportAppData, importAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

describe('backup import boundary parity', () => {
  it('rejects unsafe JSON before sanitize can turn it into default AppData', () => {
    const unsafe = { source: 'health-json', samples: [] };
    const report = analyzeImportedAppData(unsafe);
    const result = importAppData(JSON.stringify(unsafe));

    expect(report.status).toBe('unsafe');
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(sanitizeData(unsafe).history).toEqual([]);
  });

  it('imports cleaned JSON exported from the same sanitize boundary', () => {
    const data = sanitizeData(makeAppData({ selectedTemplateId: 'pull-a' }));
    const exported = exportAppData(data);
    const imported = importAppData(exported);

    expect(imported.ok).toBe(true);
    expect(imported.data?.selectedTemplateId).toBe('pull-a');
  });

  it('keeps needs_review repair-confirm behavior and summary-only repair logs', () => {
    const rawNeedsReview = {
      ...makeAppData(),
      ...(unitFixture.data as object),
    };
    const report = analyzeImportedAppData(rawNeedsReview);
    const repaired = repairImportedAppData(rawNeedsReview, {
      repairDate: '2026-05-08',
      sourceFileName: 'anonymous-minimal.json',
    });
    const cleanedImport = importAppData(exportAppData(repaired.repairedData));

    expect(report.status).toBe('needs_review');
    expect(canImportDataRepairReport(report)).toBe(true);
    expect(repaired.repairLog.length).toBeGreaterThan(0);
    expect(cleanedImport.ok).toBe(true);
    expect(JSON.stringify(repaired.repairLog)).not.toContain('"history"');
    expect(JSON.stringify(repaired.repairLog)).not.toContain('"exercises"');
    expect(JSON.stringify(repaired.repairLog)).not.toContain('"sets"');
  });

  it('does not return replacement data for parse failures', () => {
    const result = importAppData('{not json');

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('JSON');
    expect(result.error).not.toMatch(/undefined|null/);
  });
});
