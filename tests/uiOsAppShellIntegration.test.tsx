import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS 3 app shell integration', () => {
  const appSource = read('src/App.tsx');

  it('uses the production UI-OS shell instead of the prototype or legacy shell', () => {
    expect(appSource).toContain("import { MobileAppShell } from './uiOs/MobileAppShell'");
    expect(appSource).toContain('<MobileAppShell');
    expect(appSource).not.toContain("import { AppShell } from './ui/AppShell'");
    expect(appSource).not.toContain('IronPathOS2');
    expect(appSource).not.toContain('prototypePreview');
    expect(read('src/main.tsx')).not.toContain('prototypePreview');
    expect(read('src/main.tsx')).not.toContain('IronPathOS2');
  });

  it('maps production navigation to the five UI-OS tabs', () => {
    const navigationSource = read('src/uiOs/uiOsNavigation.ts');

    for (const expected of ["id: 'today'", "id: 'train'", "id: 'history'", "id: 'progress'", "id: 'settings'"]) {
      expect(navigationSource).toContain(expected);
    }
    for (const label of ["label: '今日'", "label: '训练'", "label: '历史'", "label: '进步'", "label: '设置'"]) {
      expect(navigationSource).toContain(label);
    }
    expect(navigationSource).not.toContain("label: '记录'");
    expect(navigationSource).not.toContain("label: '计划'");
    expect(navigationSource).not.toContain("label: '我的'");
  });

  it('keeps existing page content reachable through render conditions', () => {
    expect(appSource).toContain("activeTab === 'today'");
    expect(appSource).toContain('<TodayView');
    expect(appSource).toContain("activeTab === 'train'");
    expect(appSource).toContain('<TrainingFocusView');
    expect(appSource).toContain('<TrainingView');
    expect(appSource).toContain("activeTab === 'history'");
    expect(appSource).toContain('<RecordView');
    expect(appSource).toContain("activeTab === 'progress' && progressMode === 'metrics'");
    expect(appSource).toContain("activeTab === 'progress' && progressMode === 'plan'");
    expect(appSource).toContain('<PlanView');
    expect(appSource).toContain("activeTab === 'settings'");
    expect(appSource).toContain('<ProfileView');
    expect(appSource).toContain('<AssessmentView');
  });

  it('keeps shell source free of storage network Supabase backend and Node-only imports', () => {
    const shellSources = [
      'src/uiOs/MobileAppShell.tsx',
      'src/uiOs/BottomNav.tsx',
      'src/uiOs/AppTopBar.tsx',
      'src/uiOs/PageContainer.tsx',
      'src/uiOs/LocalFirstSafetyStrip.tsx',
      'src/uiOs/uiOsNavigation.ts',
    ].map(read).join('\n');

    for (const forbidden of [
      'localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase/supabase-js',
      'createClient',
      'node:',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ]) {
      expect(shellSources).not.toContain(forbidden);
    }
  });
});
