import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppShell migration', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const appShellSource = readFileSync('src/ui/AppShell.tsx', 'utf8');
  const navBlock = appSource.slice(appSource.indexOf('const navItems'), appSource.indexOf('] as const;', appSource.indexOf('const navItems')));

  it('renders product pages through the shared AppShell', () => {
    expect(appSource).toContain('<AppShell');
    expect(appSource).not.toContain('<BottomNav');
    expect(appShellSource).toContain('<BottomNav');
  });

  it('keeps only the five product-level main navigation entries', () => {
    for (const id of ['today', 'training', 'record', 'plan', 'profile']) {
      expect(navBlock).toContain(`id: '${id}'`);
    }
    expect(navBlock).not.toContain("id: 'assessment'");
    expect(navBlock).not.toContain("id: 'progress'");
  });
});
