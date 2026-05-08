import { describe, expect, it } from 'vitest';
import unitFixture from './fixtures/realDataRegression/legacy-unit-display.json';
import {
  READ_MIRROR_ROUTES,
  SESSION_MUTATION_ROUTES,
  handleReadMirrorRequest,
  handleSessionMutationRequest,
} from '../apps/api/src';
import { analyzeImportedAppData, canImportDataRepairReport, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { exportAppData, importAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';
import { buildAppDataFromFixture, type RealDataFixtureName } from './helpers/realDataFixture';
import { makeAppData } from './fixtures';

const fixtures: RealDataFixtureName[] = [
  'legacy-assisted-pullup-session',
  'incomplete-draft-sets-session',
  'ppl-cycle-boundary-history',
  'legacy-unit-display',
  'duplicate-plan-draft',
];

describe('session mutation API legacy compatibility', () => {
  it.each(fixtures)('handles sanitized real-data fixture %s without mutating the input', (fixtureName) => {
    const data = buildAppDataFromFixture(fixtureName, { activeSession: null, selectedTemplateId: 'push-a' });
    const before = JSON.stringify(data);
    const response = handleSessionMutationRequest(data, {
      method: 'POST',
      path: '/sessions/start',
      body: { templateId: 'push-a' },
      nowIso: '2026-05-08T09:00:00.000Z',
    });

    expect(JSON.stringify(data)).toBe(before);
    expect(response.result.reasonCode).toBe('session_started');
    expect(response.nextData?.activeSession?.templateId).toBe('push-a');
  });

  it('keeps read mirror and session mutation skeletons separated', () => {
    expect(READ_MIRROR_ROUTES.every((route) => route.method === 'GET')).toBe(true);
    expect(SESSION_MUTATION_ROUTES.every((route) => route.method === 'POST')).toBe(true);
    expect(READ_MIRROR_ROUTES.map((route) => route.path)).not.toEqual(
      expect.arrayContaining(SESSION_MUTATION_ROUTES.map((route) => route.path)),
    );

    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const read = handleReadMirrorRequest(data, { method: 'GET', path: '/history' });
    const writeLikeRead = handleReadMirrorRequest(data, { method: 'POST', path: '/sessions/start' });

    expect(read.status).toBe(200);
    expect(writeLikeRead.status).toBe(405);
  });

  it('does not change backup import/export unsafe, cleaned, or needs-review behavior', () => {
    const unsafe = { source: 'health-json', samples: [] };
    const unsafeImport = importAppData(JSON.stringify(unsafe));
    const cleanedData = sanitizeData(makeAppData({ selectedTemplateId: 'legs-a' }));
    const cleanedImport = importAppData(exportAppData(cleanedData));
    const rawNeedsReview = {
      ...makeAppData(),
      ...(unitFixture.data as object),
    };
    const report = analyzeImportedAppData(rawNeedsReview);
    const repaired = repairImportedAppData(rawNeedsReview, {
      repairDate: '2026-05-08',
      sourceFileName: 'anonymous-minimal.json',
    });
    const repairedImport = importAppData(exportAppData(repaired.repairedData));

    expect(unsafeImport.ok).toBe(false);
    expect(unsafeImport.data).toBeUndefined();
    expect(cleanedImport.ok).toBe(true);
    expect(cleanedImport.data?.selectedTemplateId).toBe('legs-a');
    expect(report.status).toBe('needs_review');
    expect(canImportDataRepairReport(report)).toBe(true);
    expect(repairedImport.ok).toBe(true);
  });
});

