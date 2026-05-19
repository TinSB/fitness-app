import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');
const doc = read('docs/UI_OS_R5_PROGRESS_DATA_HEALTH_CLARITY_REWRITE.md');

const progressDataHealthRuntimeSources = [
  'src/engines/progressClaritySummary.ts',
  'src/engines/dataHealthClaritySummary.ts',
  'src/features/RecordView.tsx',
  'src/uiOs/progress/ProgressInsightHero.tsx',
  'src/uiOs/progress/ReadinessPressureCard.tsx',
  'src/uiOs/progress/StrengthTrendCards.tsx',
  'src/uiOs/progress/EffectiveSetsVolumeCard.tsx',
  'src/uiOs/dataHealth/DataHealthClarityPanel.tsx',
  'src/uiOs/dataHealth/DataHealthIssueClarityCard.tsx',
  'src/uiOs/dataHealth/DataHealthSafetyNotice.tsx',
];

describe('UI-OS R5 boundaries stay blocked', () => {
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
    expect(doc).toContain('accepted browser mutation routes remain exactly seven');
    expect(doc).toContain('No eighth browser mutation route');
    expect(doc).toContain('`POST /data-health/repair/apply` remains blocked');
  });

  it('keeps Progress and Data Health runtime free of forbidden backend cloud route and prototype imports', () => {
    const combined = progressDataHealthRuntimeSources.map(read).join('\n');
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

  it('does not claim R5 changed algorithms source of truth routes cloud or packages', () => {
    for (const forbidden of [
      'R5 changed source-of-truth',
      'R5 changed PR/e1RM calculation',
      'R5 changed effective-set calculation',
      'R5 changed data health detection',
      'R5 changed data health repair semantics',
      'R5 added route',
      'R5 enabled cloud sync',
      'R5 started SaaS',
      'R5 added dependency',
      'R5 changed package script',
      'R5 modified lockfile',
      'UI-OS R6 has started',
      'UI-OS R6 was started',
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
