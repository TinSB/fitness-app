import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppShell migration', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const appShellSource = readFileSync('src/ui/AppShell.tsx', 'utf8');

  it('renders product pages through the shared AppShell', () => {
    expect(appSource).toContain('<AppShell');
    expect(appSource).not.toContain('<BottomNav');
    expect(appShellSource).toContain('<BottomNav');
  });

  it('keeps only the product-level main navigation entries', () => {
    expect(appSource).toContain("label: '今日'");
    expect(appSource).toContain("label: '训练'");
    expect(appSource).toContain("label: '记录'");
    expect(appSource).toContain("label: '计划'");
    expect(appSource).toContain("label: '我的'");
    expect(appSource).not.toContain("label: '筛查'");
    expect(appSource).not.toContain("label: '进度'");
  });
});
