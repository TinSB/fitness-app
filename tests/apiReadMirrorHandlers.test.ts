import { describe, expect, it } from 'vitest';
import {
  READ_MIRROR_ROUTES,
  buildReadMirrorAppData,
  buildReadMirrorAppDataSummary,
  buildReadMirrorDataHealthSummary,
  buildReadMirrorHealth,
  buildReadMirrorHistoryDetail,
  buildReadMirrorHistoryList,
  buildReadMirrorSessionsSummary,
  handleReadMirrorRequest,
} from '../apps/api/src';
import { APP_DATA_SCHEMA_VERSION } from '../packages/contracts/src';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

describe('API read mirror handlers', () => {
  it('declares only read-only GET routes', () => {
    expect(READ_MIRROR_ROUTES.map((route) => route.path)).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);
    expect(READ_MIRROR_ROUTES.every((route) => route.method === 'GET')).toBe(true);
  });

  it('returns health/version/schema mirror data', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const health = buildReadMirrorHealth(data);

    expect(health).toMatchObject({
      ok: true,
      service: 'ironpath-read-mirror-api',
      mode: 'read_only',
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      appDataSchemaVersion: data.schemaVersion,
    });
    expect(health.routes).toHaveLength(READ_MIRROR_ROUTES.length);
  });

  it('returns AppData and session summaries without exposing mutation handlers', () => {
    const data = buildAppDataFromFixture('duplicate-plan-draft');
    const appSummary = buildReadMirrorAppDataSummary(data);
    const sessionSummary = buildReadMirrorSessionsSummary(data);

    expect(appSummary.historyCount).toBe(data.history.length);
    expect(appSummary.templateCount).toBe(data.templates.length);
    expect(appSummary.selectedTemplateId).toBe(data.selectedTemplateId);
    expect(sessionSummary.totalHistorySessions).toBe(data.history.length);
    expect(sessionSummary.byDataFlag.normal + sessionSummary.byDataFlag.test + sessionSummary.byDataFlag.excluded).toBe(
      data.history.length,
    );
    expect(READ_MIRROR_ROUTES.every((route) => route.method === 'GET')).toBe(true);
    expect(READ_MIRROR_ROUTES.map((route) => route.path)).not.toEqual(
      expect.arrayContaining(['/sessions/start', '/history/:id/edit', '/backup/import']),
    );
  });

  it('returns history list and detail mirror data', () => {
    const data = buildAppDataFromFixture('incomplete-draft-sets-session');
    const history = buildReadMirrorHistoryList(data);
    const detail = buildReadMirrorHistoryDetail(data, data.history[0].id);

    expect(history.sessions.map((session) => session.id)).toEqual(data.history.map((session) => session.id));
    expect(detail?.session.id).toBe(data.history[0].id);
    expect(detail?.summary.incompleteSets).toBeGreaterThan(0);
    expect(buildReadMirrorHistoryDetail(data, 'missing-session')).toBeNull();
  });

  it('returns DataHealth mirror data', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');
    const dataHealth = buildReadMirrorDataHealthSummary(data);

    expect(dataHealth.issueCount).toBe(dataHealth.issues.length);
    expect(dataHealth.summary).toBeTruthy();
    expect(dataHealth.status).toMatch(/healthy|has_warnings|has_errors/);
  });

  it('handles all declared routes through the route dispatcher', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const existingId = data.history[0].id;

    const requests = [
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      `/history/${encodeURIComponent(existingId)}`,
      '/data-health/summary',
    ];

    requests.forEach((path) => {
      const response = handleReadMirrorRequest(data, { method: 'GET', path });
      expect(response.status, path).toBe(200);
      const body = response.body as { summary?: string; issues?: Array<{ title?: string; message?: string; suggestedAction?: string }> };
      const visibleText = JSON.stringify({
        summary: body.summary,
        issues: body.issues?.map((issue) => ({
          title: issue.title,
          message: issue.message,
          suggestedAction: issue.suggestedAction,
        })),
      });
      expect(visibleText, path).not.toMatch(/\bundefined\b|__auto_alt|__alt_/);
    });

    expect(handleReadMirrorRequest(data, { method: 'POST', path: '/history' }).status).toBe(405);
    expect(handleReadMirrorRequest(data, { method: 'GET', path: '/unknown' }).status).toBe(404);
    expect(handleReadMirrorRequest(data, { method: 'GET', path: '/history/missing-session' }).status).toBe(404);
  });

  it('can sanitize legacy fixture-shaped input for read mirror use', () => {
    const data = buildReadMirrorAppData({
      schemaVersion: 0,
      selectedTemplate: 'pull-a',
      history: [
        {
          id: 'legacy-read-mirror',
          date: '2026-04-20',
          template: { id: 'pull-a', name: 'Pull A' },
          exercises: [
            {
              id: 'lat-pulldown',
              name: 'Lat Pulldown',
              sets: [{ weight: 60, reps: 8, done: true }],
            },
          ],
        },
      ],
    });

    expect(data.schemaVersion).toBe(APP_DATA_SCHEMA_VERSION);
    expect(buildReadMirrorHistoryList(data).sessions[0]).toMatchObject({
      id: 'legacy-read-mirror',
      templateId: 'pull-a',
      completed: false,
    });
  });
});
