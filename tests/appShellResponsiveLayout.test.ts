import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppShell responsive layout', () => {
  const appShellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
  const bottomNavSource = readFileSync('src/uiOs/BottomNav.tsx', 'utf8');
  const pageContainerSource = readFileSync('src/uiOs/PageContainer.tsx', 'utf8');

  it('provides a desktop sidebar and mobile bottom navigation', () => {
    expect(appShellSource).toContain('w-[244px]');
    expect(appShellSource).toContain('lg:flex');
    expect(appShellSource).toContain('lg:hidden');
    expect(appShellSource).toContain('<BottomNav');
    expect(bottomNavSource).toContain('lg:hidden');
  });

  it('uses a wider product content container', () => {
    expect(pageContainerSource).toContain('max-w-[1600px]');
    expect(appShellSource).toContain('<PageContainer');
  });

  it('keeps mobile safe-area handling centralized in the shell', () => {
    expect(appShellSource).toContain('AppTopBar');
    expect(appShellSource).toContain("data-shell-safe-bottom={immersive ? 'immersive' : 'bottom-nav-protected'}");
    expect(appShellSource).toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))] scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]");
    expect(appShellSource).toContain("data-shell-bottom-reserve={immersive ? 'none' : 'content-clearance'}");
    expect(appShellSource).toContain('{!immersive ? <BottomNav');
  });

  it('supports desktop auxiliary panels without replacing page content', () => {
    expect(appShellSource).toContain('auxiliary?: ReactNode');
    expect(pageContainerSource).toContain('lg:grid-cols-[minmax(0,1fr)_300px]');
    expect(pageContainerSource).toContain('<aside');
    expect(pageContainerSource).toContain('<section className="min-w-0">{children}</section>');
  });
});
