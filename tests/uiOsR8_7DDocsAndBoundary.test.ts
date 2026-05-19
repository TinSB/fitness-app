import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const docPath = resolve(root, 'docs/UI_OS_R8_7D_FOCUS_MORE_MENU_MICROCOPY_FINAL_PURGE.md');

describe('UI-OS R8.7D docs and boundaries', () => {
  it('documents Focus More menu and microcopy purge', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('UI-OS R8.7D');
    expect(doc).toContain('Focus More Menu & Microcopy Final Purge V1');
    expect(doc).toContain('current exercise');
    expect(doc).toContain('替代动作');
    expect(doc).toContain('标记不适');
    expect(doc).toContain('动作顺序');
    expect(doc).toContain('theoretical load');
    expect(doc).toContain('UI-OS R8.7E is recommended next and is not started by R8.7D');
  });

  it('keeps route cloud package and prototype boundaries unchanged', () => {
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
      'src/engines/focusModeInteractionState.ts',
      'src/ui/EquipmentAwareLoadDisplay.tsx',
      'src/uiOs/training/FocusModeActionBar.tsx',
    ].map(read).join('\n');

    expect(runtimeSources).not.toContain('/data-health/repair/apply');
    expect(runtimeSources).not.toContain('POST /data-health/repair/apply');
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
