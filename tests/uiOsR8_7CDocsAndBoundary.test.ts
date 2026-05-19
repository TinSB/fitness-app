import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const docPath = resolve(root, 'docs/UI_OS_R8_7C_ONE_LAYER_SHEET_INTERACTION_STANDARD.md');

describe('UI-OS R8.7C docs and boundaries', () => {
  it('documents one-layer sheet interaction standard', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('UI-OS R8.7C');
    expect(doc).toContain('One-Layer Sheet Interaction Standard V1');
    expect(doc).toContain('blank backdrop dismissal');
    expect(doc).toContain('top-handle dismissal');
    expect(doc).toContain('仍有未完成动作，是否结束训练？');
    expect(doc).toContain('UI-OS R8.7D is recommended next and is not started by R8.7C');
  });

  it('keeps source route cloud package and prototype boundaries unchanged', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    const runtimeSources = [
      'src/features/TrainingFocusView.tsx',
      'src/ui/BottomSheet.tsx',
      'src/uiOs/surfaces/BottomSheet.tsx',
      'src/uiOs/training/FocusModeSecondaryActions.tsx',
      'src/uiOs/training/FocusActualSetRecordSheet.tsx',
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
});
