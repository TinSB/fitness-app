import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');
const doc = read('docs/UI_OS_R3_TODAY_DECISION_SURFACE_REWRITE.md');

const todayRuntimeSources = [
  'src/features/TodayView.tsx',
  'src/uiOs/today/TodayDecisionHero.tsx',
  'src/uiOs/today/TodayFocusOverridePanel.tsx',
  'src/uiOs/today/TodayReadinessSummary.tsx',
  'src/uiOs/today/TodayActiveSessionNotice.tsx',
  'src/uiOs/today/TodaySevereRiskNotice.tsx',
];

describe('UI-OS R3 boundary still blocked', () => {
  it('keeps exact accepted browser mutation routes at seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    for (const expected of [
      'accepted browser mutation routes remain exactly seven',
      'No eighth browser mutation route',
      '`POST /data-health/repair/apply` remains blocked',
      'backup/import/export over HTTP remains blocked',
      'reset/recovery over HTTP remains blocked',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps Today runtime free of cloud backend prototype and Node-only imports', () => {
    const combined = todayRuntimeSources.map(read).join('\n');
    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient',
      'node:',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      'localStorage.setItem',
      'sessionStorage.setItem',
      'IronPathOS2',
      'prototypePreview',
      'src/prototype',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
    expect(read('src/App.tsx')).not.toContain('IronPathOS2');
    expect(read('src/App.tsx')).not.toContain('prototypePreview');
    expect(read('src/main.tsx')).not.toContain('IronPathOS2');
    expect(read('src/main.tsx')).not.toContain('prototypePreview');
    expect(read('prototype.html')).toContain('/src/prototypePreview.tsx');
  });

  it('does not claim R3 changed source of truth algorithms routes cloud or package surfaces', () => {
    for (const forbidden of [
      'R3 changed source-of-truth',
      'R3 changed training algorithm',
      'R3 changed planning logic',
      'R3 added route',
      'R3 enabled cloud sync',
      'R3 started SaaS',
      'R3 added dependency',
      'R3 changed package script',
      'R3 modified lockfile',
      'UI-OS R4 has started',
      'UI-OS R4 was started',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
  });

  it('keeps package and lockfile boundaries static', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
    expect(existsSync('package-lock.json')).toBe(true);
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
