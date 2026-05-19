import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI navigation structure', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const appShellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
  const bottomNavSource = readFileSync('src/uiOs/BottomNav.tsx', 'utf8');
  const navigationSource = readFileSync('src/uiOs/uiOsNavigation.ts', 'utf8');

  it('keeps the five UI-OS product-level navigation entries', () => {
    for (const id of ['today', 'train', 'history', 'progress', 'settings']) {
      expect(navigationSource).toContain(`id: '${id}'`);
    }
  });

  it('uses a shared BottomNav with safe-area handling', () => {
    expect(appSource).toContain('<MobileAppShell');
    expect(appShellSource).toContain('<BottomNav');
    expect(bottomNavSource).toContain('env(safe-area-inset-bottom)');
    expect(bottomNavSource).toContain('activeSession');
  });
});
