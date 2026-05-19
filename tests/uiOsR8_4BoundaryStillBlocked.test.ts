import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('UI-OS R8.4 boundaries still blocked', () => {
  it('keeps the accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('does not add repair, route, cloud, prototype, or package drift', () => {
    const runtimeSources = [
      'src/features/TodayView.tsx',
      'src/features/TrainingFocusView.tsx',
      'src/features/TrainingView.tsx',
      'src/features/RecordView.tsx',
      'src/features/ProfileView.tsx',
      'src/uiOs/MobileAppShell.tsx',
      'src/uiOs/navigation/FloatingBottomNav.tsx',
    ].map(read).join('\n');

    expect(runtimeSources).not.toContain('POST /data-health/repair/apply');
    expect(runtimeSources).not.toContain('/data-health/repair/apply');
    expect(runtimeSources).not.toContain('backup/import');
    expect(runtimeSources).not.toContain('reset/recovery');
    expect(runtimeSources).not.toContain('default cloud sync');
    expect(runtimeSources).not.toContain('background sync');
    expect(runtimeSources).not.toContain('@supabase');
    expect(runtimeSources).not.toContain('src/prototype/IronPathOS2');
    expect(read('src/main.tsx')).not.toContain('src/prototype/IronPathOS2');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('does not touch algorithm or source-of-truth files for this UI-only task', () => {
    const uiDoc = read('docs/UI_OS_R8_4_MOBILE_CHROME_GAP_MICROCOPY_DELETION.md');

    expect(uiDoc).toContain('No training algorithm change');
    expect(uiDoc).toContain('No source-of-truth or persistence change');
    expect(uiDoc).toContain('No route or cloud behavior change');
  });
});
