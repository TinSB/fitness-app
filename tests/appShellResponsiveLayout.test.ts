import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppShell responsive layout', () => {
  const appShellSource = readFileSync('src/ui/AppShell.tsx', 'utf8');
  const bottomNavSource = readFileSync('src/ui/BottomNav.tsx', 'utf8');
  const tokensSource = readFileSync('src/ui/designTokens.ts', 'utf8');
  const responsiveLayoutSource = readFileSync('src/ui/layouts/ResponsivePageLayout.tsx', 'utf8');

  it('provides a desktop sidebar and mobile bottom navigation', () => {
    expect(appShellSource).toContain('w-[244px]');
    expect(appShellSource).toContain('lg:flex');
    expect(appShellSource).toContain('lg:hidden');
    expect(appShellSource).toContain('<BottomNav');
    expect(bottomNavSource).toContain('lg:hidden');
  });

  it('uses a wider product content container', () => {
    expect(tokensSource).toContain('max-w-[1280px]');
    expect(responsiveLayoutSource).toContain('uiTokens.page.maxWidth');
    expect(responsiveLayoutSource).toContain('uiTokens.page.contentPadding');
  });

  it('keeps mobile safe-area handling centralized in the shell', () => {
    expect(appShellSource).toContain('env(safe-area-inset-top)');
    expect(appShellSource).toContain("immersive ? 'pb-0' : 'pb-24'");
    expect(appShellSource).toContain('{!immersive ? <BottomNav');
  });

  it('supports desktop auxiliary panels without replacing page content', () => {
    expect(appShellSource).toContain('auxiliary?: ReactNode');
    expect(appShellSource).toContain('lg:grid-cols-[minmax(0,1fr)_300px]');
    expect(appShellSource).toContain('<aside');
    expect(appShellSource).toContain('<section className="min-w-0">{children}</section>');
  });
});
