import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R0 v0 extraction boundary still blocked', () => {
  const productionSources = [
    'src/uiOs/primitives/GlassCard.tsx',
    'src/uiOs/primitives/ActionButton.tsx',
    'src/uiOs/primitives/SegmentedControl.tsx',
    'src/uiOs/primitives/StatusBadge.tsx',
    'src/uiOs/surfaces/BottomSheet.tsx',
    'src/uiOs/surfaces/SafetyStrip.tsx',
    'src/uiOs/navigation/FloatingBottomNav.tsx',
    'src/uiOs/training/EquipmentAwareLoadCard.tsx',
    'src/uiOs/training/TrainingFocusHero.tsx',
    'src/uiOs/settings/SettingsGroupCard.tsx',
    'src/uiOs/MobileAppShell.tsx',
  ];

  it('keeps prototype isolated from production runtime', () => {
    expect(read('src/App.tsx')).not.toContain('IronPathOS2');
    expect(read('src/App.tsx')).not.toContain('prototypePreview');
    expect(read('src/main.tsx')).not.toContain('IronPathOS2');
    expect(read('src/main.tsx')).not.toContain('prototypePreview');
    expect(read('prototype.html')).toContain('/src/prototypePreview.tsx');
    expect(read('src/uiOs/MobileAppShell.tsx')).toContain('BottomNav');
    expect(read('src/uiOs/BottomNav.tsx')).toContain('FloatingBottomNav');
    expect(read('src/uiOs/surfaces/SafetyStrip.tsx')).toContain('SafetyStrip');
  });

  it('keeps extracted production UI components free of storage network backend and route behavior', () => {
    const combined = productionSources.map(read).join('\n');
    for (const forbidden of [
      'localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase/supabase-js',
      'createClient',
      'node:',
      'AppData',
      'setData(',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

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

  it('documents preserved boundaries and R2 pause', () => {
    const doc = read('docs/UI_OS_R0_V0_DESIGN_SYSTEM_EXTRACTION_PARITY.md');
    for (const expected of [
      'No training algorithm change',
      'No source-of-truth behavior change',
      'No persistence behavior change',
      'No routes or browser mutation routes added',
      'No cloud sync/default/background sync',
      'No package/dependency/script/lockfile change',
      'Accepted browser mutation routes remain exactly seven',
      'UI-OS R2 is paused',
      'UI-OS R2 is not started by R0',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps package and lockfile boundaries static', () => {
    const packageJson = read('package.json');
    expect(packageJson).not.toContain('cloud:sync');
    expect(packageJson).not.toContain('deploy:production');
    expect(packageJson).not.toContain('monitoring:upload');
    expect(existsSync('package-lock.json')).toBe(true);
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
