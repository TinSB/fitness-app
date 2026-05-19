import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppShell migration', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const appShellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
  const navigationSource = readFileSync('src/uiOs/uiOsNavigation.ts', 'utf8');

  it('renders product pages through the UI-OS MobileAppShell', () => {
    expect(appSource).toContain('<MobileAppShell');
    expect(appSource).not.toContain("import { AppShell } from './ui/AppShell'");
    expect(appShellSource).toContain('<BottomNav');
  });

  it('keeps only the five UI-OS product-level main navigation entries', () => {
    for (const id of ['today', 'train', 'history', 'progress', 'settings']) {
      expect(navigationSource).toContain(`id: '${id}'`);
    }
    expect(navigationSource).not.toContain("id: 'assessment'");
    expect(navigationSource).not.toContain("id: 'record'");
    expect(navigationSource).not.toContain("id: 'profile'");
  });
});
