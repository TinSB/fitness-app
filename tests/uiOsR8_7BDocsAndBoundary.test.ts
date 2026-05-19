import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const docPath = resolve(root, 'docs/UI_OS_R8_7B_PRACTICAL_WARMUP_POLICY_REFINEMENT.md');

describe('UI-OS R8.7B docs and boundaries', () => {
  it('documents practical warmup policy refinement', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');
    expect(doc).toContain('UI-OS R8.7B');
    expect(doc).toContain('Practical Warmup Policy Refinement V1');
    expect(doc).toContain('Normal warmups do not include `×2` or `×1`');
    expect(doc).toContain('Machine, dumbbell, and accessory warmups are shortened');
    expect(doc).toContain('equipment-aware feasible actionable loads');
    expect(doc).toContain('UI-OS R8.7C is recommended next and is not started by R8.7B');
  });

  it('keeps runtime route cloud package and prototype boundaries unchanged', () => {
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
      'src/engines/practicalWarmupPolicy.ts',
      'src/engines/progressionRulesEngine.ts',
      'src/engines/actionableLoadContract.ts',
    ].map(read).join('\n');

    expect(runtimeSources).not.toContain('/data-health/repair/apply');
    expect(runtimeSources).not.toContain('default cloud sync');
    expect(runtimeSources).not.toContain('background sync');
    expect(runtimeSources).not.toContain('@supabase');
    expect(runtimeSources).not.toContain('src/prototype');
    expect(read('package.json')).not.toContain('cloud:sync');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });
});
