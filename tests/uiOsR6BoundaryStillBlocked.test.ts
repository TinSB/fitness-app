import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');
const doc = read('docs/UI_OS_R6_SETTINGS_SAFETY_THEME_EQUIPMENT_PROFILE_REWRITE.md');

const settingsRuntimeSources = [
  'src/engines/settingsSafetySummary.ts',
  'src/engines/themePreferenceModel.ts',
  'src/features/ProfileView.tsx',
  'src/uiOs/settings/SettingsControlCenter.tsx',
  'src/uiOs/settings/ThemeSettingsPanel.tsx',
  'src/uiOs/settings/BackupRecoverySettingsPanel.tsx',
  'src/uiOs/settings/EmergencyLocalSettingsPanel.tsx',
  'src/uiOs/settings/CloudCandidateSettingsPanel.tsx',
  'src/uiOs/settings/EquipmentProfileSettingsPanel.tsx',
  'src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx',
  'src/uiOs/settings/AboutDataSafetyPanel.tsx',
];

describe('UI-OS R6 boundaries stay blocked', () => {
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
    expect(doc).toContain('No eighth browser mutation route is added');
  });

  it('keeps Settings runtime free of forbidden backend cloud route and prototype imports', () => {
    const combined = settingsRuntimeSources.map(read).join('\n');
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
      'sourceOfTruthChanged: true',
      'trainingAlgorithmChanged: true',
      'routeSurfaceChanged: true',
      'cloudSyncChanged: true',
      'persistenceChanged: true',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
    expect(read('src/App.tsx')).not.toContain('IronPathOS2');
    expect(read('src/App.tsx')).not.toContain('prototypePreview');
    expect(read('src/main.tsx')).not.toContain('IronPathOS2');
    expect(read('src/main.tsx')).not.toContain('prototypePreview');
    expect(read('prototype.html')).toContain('/src/prototypePreview.tsx');
  });

  it('allows negative automatic-sync safety copy while forbidding positive claims', () => {
    const combined = settingsRuntimeSources.map(read).join('\n');

    expect(combined).toContain('云端候选需要手动确认');
    expect(combined).toContain('不会自动覆盖本地数据');
    for (const forbidden of [
      '自动同步已启用',
      '后台同步',
      '云端已成为默认数据源',
      '已自动上传成功',
      '自动修复已应用',
      '已自动修复数据',
      'SaaS 已上线',
    ]) {
      expect(combined).not.toContain(forbidden);
      expect(doc).not.toContain(forbidden);
    }
  });

  it('does not claim R6 changed source of truth schema algorithms routes cloud or packages', () => {
    for (const forbidden of [
      'R6 changed source-of-truth',
      'R6 changed AppData schema',
      'R6 changed training algorithm',
      'R6 changed Data Health repair semantics',
      'R6 added route',
      'R6 enabled cloud sync',
      'R6 started SaaS',
      'R6 added dependency',
      'R6 changed package script',
      'R6 modified lockfile',
      'UI-OS R7 has started',
      'UI-OS R7 was started',
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
