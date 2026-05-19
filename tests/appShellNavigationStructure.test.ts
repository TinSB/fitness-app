import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('App shell navigation structure', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const appShellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
  const bottomNavSource = readFileSync('src/uiOs/BottomNav.tsx', 'utf8');
  const navigationSource = readFileSync('src/uiOs/uiOsNavigation.ts', 'utf8');

  it('keeps the five UI-OS product navigation entries reachable', () => {
    for (const entry of ["label: '今日'", "label: '训练'", "label: '历史'", "label: '进步'", "label: '设置'"]) {
      expect(navigationSource).toContain(entry);
    }
    expect(navigationSource).not.toContain("label: '记录'");
    expect(navigationSource).not.toContain("label: '计划'");
    expect(navigationSource).not.toContain("label: '我的'");
  });

  it('uses desktop left nav and mobile bottom nav from the UI-OS shell', () => {
    expect(appShellSource).toContain('lg:flex');
    expect(appShellSource).toContain('<BottomNav');
    expect(bottomNavSource).toContain('lg:hidden');
    expect(appSource).toContain('<MobileAppShell');
    expect(appSource).toContain('auxiliary={');
  });

  it('does not use the legacy Page shell for mobile focus training', () => {
    expect(appSource).not.toContain("import { Page } from './ui/common'");
    expect(appSource).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(appSource).toContain('<TrainingFocusView');
  });
});
