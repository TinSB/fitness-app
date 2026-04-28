import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('App shell navigation structure', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const appShellSource = readFileSync('src/ui/AppShell.tsx', 'utf8');
  const bottomNavSource = readFileSync('src/ui/BottomNav.tsx', 'utf8');
  const navBlock = appSource.slice(appSource.indexOf('const navItems'), appSource.indexOf('] as const;', appSource.indexOf('const navItems')));

  it('keeps the five product navigation entries reachable', () => {
    for (const entry of ["label: '今日'", "label: '训练'", "label: '记录'", "label: '计划'", "label: '我的'"]) {
      expect(navBlock).toContain(entry);
    }
    expect(navBlock).not.toContain("label: '进度'");
    expect(navBlock).not.toContain("label: '筛查'");
  });

  it('uses desktop left nav and mobile bottom nav from the shared shell', () => {
    expect(appShellSource).toContain('lg:flex');
    expect(appShellSource).toContain('<BottomNav');
    expect(bottomNavSource).toContain('lg:hidden');
    expect(appSource).toContain('<AppShell');
    expect(appSource).toContain('auxiliary={');
  });

  it('does not use the legacy Page shell for mobile focus training', () => {
    expect(appSource).not.toContain("import { Page } from './ui/common'");
    expect(appSource).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(appSource).toContain('<TrainingFocusView');
  });
});
