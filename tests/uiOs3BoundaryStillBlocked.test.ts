import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('UI-OS 3 boundary still blocked', () => {
  const doc = () => readSource('docs/UI_OS_3_CODEX_APP_SHELL_INTEGRATION.md');

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

  it('documents blocked route cloud source-of-truth and package boundaries', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'accepted browser mutation routes remain exactly seven.',
      'blocked repair/reset/import/export HTTP routes remain blocked.',
      'no default cloud sync.',
      'no background sync.',
      'no source-of-truth change.',
      'no training algorithm change.',
      'no persistence change.',
      'no route change.',
      'no package dependency change.',
      'no SaaS/multi-user runtime.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps package and lockfile surface unchanged', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(existsSync(resolve(repoRoot(), 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(false);
  });

  it('allows negative safety copy and rejects positive sync claims in shell and docs', () => {
    const combined = [
      doc(),
      readSource('src/uiOs/LocalFirstSafetyStrip.tsx'),
      readSource('src/uiOs/surfaces/SafetyStrip.tsx'),
      readSource('src/uiOs/MobileAppShell.tsx'),
    ].join('\n');

    expect(combined).toContain('云端候选不会自动同步');
    for (const forbidden of ['自动同步已启用', '后台同步', '云端已成为默认数据源', '已上传成功', 'SaaS 已上线']) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps prototype preview isolated from production runtime', () => {
    expect(readSource('src/App.tsx')).not.toContain('IronPathOS2');
    expect(readSource('src/App.tsx')).not.toContain('prototypePreview');
    expect(readSource('src/main.tsx')).not.toContain('IronPathOS2');
    expect(readSource('src/main.tsx')).not.toContain('prototypePreview');
    expect(readSource('prototype.html')).toContain('/src/prototypePreview.tsx');
  });
});
