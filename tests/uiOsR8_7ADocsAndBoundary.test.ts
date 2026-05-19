import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const docPath = resolve(root, 'docs/UI_OS_R8_7A_ACTIONABLE_LOAD_CONTRACT_VALIDATION_ALIGNMENT.md');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('UI-OS R8.7A docs and boundaries', () => {
  it('documents the actionable load contract and validation alignment', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');
    expect(doc).toContain('UI-OS R8.7A');
    expect(doc).toContain('Actionable Load Contract & Validation Alignment V1');
    expect(doc).toContain('b4c2e738665c55815ff3f25442e1c5273b133e0b');
    expect(doc).toContain('Raw theoretical load');
    expect(doc).toContain('Actionable equipment-aware load');
    expect(doc).toContain('Validation baseline');
    expect(doc).toContain('UI-OS R8.7B is recommended next and is not started by R8.7A');
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
      'src/engines/actionableLoadContract.ts',
      'src/engines/setAnomalyEngine.ts',
      'src/engines/focusModeStateEngine.ts',
      'src/features/TrainingFocusView.tsx',
    ].map(read).join('\n');

    expect(runtimeSources).not.toContain('/data-health/repair/apply');
    expect(runtimeSources).not.toContain('/backup/import');
    expect(runtimeSources).not.toContain('/backup/export');
    expect(runtimeSources).not.toContain('default cloud sync');
    expect(runtimeSources).not.toContain('background sync');
    expect(runtimeSources).not.toContain('@supabase');
    expect(runtimeSources).not.toContain('src/prototype');
    expect(runtimeSources).not.toContain('IronPathOS2');
    expect(read('package.json')).not.toContain('cloud:sync');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });
});
