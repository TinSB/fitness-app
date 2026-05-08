import { describe, expect, it } from 'vitest';
import { buildReadMirrorAppData, handleReadMirrorRequest } from '../apps/api/src';
import { exportAppData, importAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { makeAppData } from './fixtures';

describe('API read mirror boundaries', () => {
  it('has no write route behavior and leaves AppData unchanged after failed write-like requests', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const before = JSON.stringify(data);

    const post = handleReadMirrorRequest(data, { method: 'POST', path: '/sessions/start' });
    const patch = handleReadMirrorRequest(data, { method: 'PATCH', path: `/history/${data.history[0].id}` });
    const del = handleReadMirrorRequest(data, { method: 'DELETE', path: `/history/${data.history[0].id}` });

    expect(post.status).toBe(405);
    expect(patch.status).toBe(405);
    expect(del.status).toBe(405);
    expect(JSON.stringify(data)).toBe(before);
    expect(JSON.stringify({ post, patch, del })).not.toMatch(/已保存|已删除|已完成|已修复/);
  });

  it('does not change backup import/export safety semantics', () => {
    const unsafe = { source: 'health-json', samples: [] };
    const unsafeImport = importAppData(JSON.stringify(unsafe));
    const data = sanitizeData(makeAppData({ selectedTemplateId: 'legs-a' }));
    const cleanedImport = importAppData(exportAppData(data));

    expect(unsafeImport.ok).toBe(false);
    expect(unsafeImport.data).toBeUndefined();
    expect(cleanedImport.ok).toBe(true);
    expect(cleanedImport.data?.selectedTemplateId).toBe('legs-a');
  });

  it('can read repaired or legacy-shaped data without changing persistence behavior', () => {
    const raw = {
      ...makeAppData(),
      ...(buildAppDataFromFixture('legacy-unit-display') as object),
    };
    const mirrorData = buildReadMirrorAppData(raw);
    const response = handleReadMirrorRequest(mirrorData, { method: 'GET', path: '/data-health/summary' });

    expect(response.status).toBe(200);
    expect(mirrorData.history.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toMatch(/\bundefined\b|__auto_alt|__alt_/);
  });
});
