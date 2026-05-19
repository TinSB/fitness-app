import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');
const doc = read('docs/UI_OS_R4_HISTORY_CALENDAR_PR_E1RM_REWRITE.md');

const historyRuntimeSources = [
  'src/engines/historyCalendarSummary.ts',
  'src/features/RecordView.tsx',
  'src/uiOs/history/HistoryFrequencySummary.tsx',
  'src/uiOs/history/TrainingFrequencyCalendar.tsx',
  'src/uiOs/history/HistoryDaySummaryCard.tsx',
  'src/uiOs/history/PrErmQuickAccessCards.tsx',
  'src/uiOs/history/RecentTrainingTimeline.tsx',
];

describe('UI-OS R4 boundary still blocked', () => {
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

  it('keeps History runtime free of cloud backend prototype and Node-only imports', () => {
    const combined = historyRuntimeSources.map(read).join('\n');
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

  it('does not claim R4 changed algorithms source of truth routes cloud or package surfaces', () => {
    for (const forbidden of [
      'R4 changed source-of-truth',
      'R4 changed PR/e1RM calculation',
      'R4 changed effective-set calculation',
      'R4 changed history data model',
      'R4 added route',
      'R4 enabled cloud sync',
      'R4 started SaaS',
      'R4 added dependency',
      'R4 changed package script',
      'R4 modified lockfile',
      'UI-OS R5 has started',
      'UI-OS R5 was started',
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
