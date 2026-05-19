import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');
const doc = read('docs/UI_OS_R2_FOCUS_MODE_INTERACTION_STATE_MACHINE_REWRITE.md');

const focusRuntimeSources = [
  'src/engines/focusModeInteractionState.ts',
  'src/features/TrainingFocusView.tsx',
  'src/uiOs/training/FocusModeActionBar.tsx',
  'src/uiOs/training/FocusModeSecondaryActions.tsx',
  'src/uiOs/training/FocusActualSetRecordSheet.tsx',
];

describe('UI-OS R2 boundary still blocked', () => {
  it('documents preserved safety boundaries', () => {
    for (const expected of [
      'No training algorithm change',
      'No warmup algorithm change',
      'No PR/e1RM/effective-set change',
      'No equipment-aware engine logic change',
      'No source-of-truth change',
      'No persistence change',
      'No route change',
      'No browser mutation route change',
      'No cloud sync',
      'No default cloud sync',
      'No background sync',
      'No package dependency change',
      'No package script change',
      'No lockfile change',
      'localStorage remains default/fallback/migration/emergency',
      'backend/cloud candidate remains explicit opt-in and reversible',
      'cloud pull does not auto-apply',
      'cloud push requires manual confirmation',
      'accepted browser mutation routes remain exactly seven',
      'blocked repair/reset/import/export HTTP routes remain blocked',
      'no SaaS/multi-user runtime',
      'no new package/dependency/script/lockfile drift beyond Phase 12 @supabase/supabase-js',
    ]) {
      expect(doc).toContain(expected);
    }
  });

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
      '1. `POST /data-health/issues/:issueId/dismiss`',
      '2. `POST /history/:id/data-flag`',
      '3. `POST /history/:id/edit`',
      '4. `POST /sessions/start`',
      '5. `POST /sessions/active/patches`',
      '6. `POST /sessions/active/complete`',
      '7. `POST /sessions/active/discard`',
      'No eighth browser mutation route',
      '`POST /data-health/repair/apply` remains blocked',
      'backup/import/export over HTTP remains blocked',
      'reset/recovery over HTTP remains blocked',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps Focus runtime free of cloud backend prototype and Node-only imports', () => {
    const combined = focusRuntimeSources.map(read).join('\n');
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

  it('does not claim R2 changed source of truth algorithms routes cloud or package surfaces', () => {
    for (const forbidden of [
      'R2 changed source-of-truth',
      'R2 changed training algorithm',
      'R2 changed warmup algorithm',
      'R2 added route',
      'R2 enabled cloud sync',
      'R2 started SaaS',
      'R2 added dependency',
      'R2 changed package script',
      'R2 modified lockfile',
      'UI-OS R3 has started',
      'UI-OS R3 was started',
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
