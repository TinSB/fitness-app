import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const docPath = resolve(root, 'docs/UI_OS_R8_7E_FOCUS_FINAL_ACCEPTANCE_REGRESSION_LOCK.md');

describe('UI-OS R8.7E docs and boundaries', () => {
  it('documents final Focus acceptance regression lock', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('UI-OS R8.7E');
    expect(doc).toContain('Focus Final Acceptance Regression Lock V1');
    expect(doc).toContain('45 lb × 10');
    expect(doc).toContain('raw theoretical');
    expect(doc).toContain('套用建议');
    expect(doc).toContain('Normal warmups');
    expect(doc).toContain('one-layer');
    expect(doc).toContain('UI-OS R9 Interaction OS Remediation Archive is recommended next and is not started by R8.7E');
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
      'src/engines/actionableLoadContract.ts',
      'src/engines/focusModeStateEngine.ts',
      'src/engines/focusModeInteractionState.ts',
      'src/engines/practicalWarmupPolicy.ts',
      'src/ui/BottomSheet.tsx',
      'src/uiOs/surfaces/BottomSheet.tsx',
      'src/uiOs/training/FocusModeSecondaryActions.tsx',
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
