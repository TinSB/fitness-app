import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('UI-OS R8.5 boundaries still blocked', () => {
  it('keeps accepted browser mutation routes exactly seven', () => {
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

  it('does not add repair routes cloud sync prototype imports or package drift', () => {
    const runtimeSources = [
      'src/features/TrainingFocusView.tsx',
      'src/features/TrainingView.tsx',
      'src/features/RecordView.tsx',
      'src/ui/BottomSheet.tsx',
      'src/ui/Drawer.tsx',
      'src/ui/WorkoutActionBar.tsx',
      'src/uiOs/surfaces/BottomSheet.tsx',
    ].map(read).join('\n');

    expect(runtimeSources).not.toContain('/data-health/repair/apply');
    expect(runtimeSources).not.toContain('POST /data-health/repair/apply');
    expect(runtimeSources).not.toContain('/backup/import');
    expect(runtimeSources).not.toContain('/backup/export');
    expect(runtimeSources).not.toContain('/reset/');
    expect(runtimeSources).not.toContain('/recovery/');
    expect(runtimeSources).not.toContain('default cloud sync');
    expect(runtimeSources).not.toContain('background sync');
    expect(runtimeSources).not.toContain('@supabase');
    expect(runtimeSources).not.toContain('src/prototype');
    expect(runtimeSources).not.toContain('IronPathOS2');
    expect(read('package.json')).not.toContain('cloud:sync');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('documents this as UI-only with no algorithm or source-of-truth change', () => {
    const doc = read('docs/UI_OS_R8_5_FOCUS_TRAINING_DETAIL_DARK_SURFACE_FIX.md');

    expect(doc).toContain('No training algorithm change');
    expect(doc).toContain('No equipment-aware calculation logic change');
    expect(doc).toContain('No source-of-truth change');
    expect(doc).toContain('No route, cloud, package, script, or lockfile change');
  });
});
