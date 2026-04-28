import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI navigation structure', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const bottomNavSource = readFileSync('src/ui/BottomNav.tsx', 'utf8');

  it('keeps the five product-level navigation entries', () => {
    expect(appSource).toContain("id: 'today'");
    expect(appSource).toContain("id: 'training'");
    expect(appSource).toContain("id: 'record'");
    expect(appSource).toContain("id: 'plan'");
    expect(appSource).toContain("id: 'profile'");
  });

  it('uses a shared BottomNav with safe-area handling', () => {
    expect(appSource).toContain('<BottomNav');
    expect(bottomNavSource).toContain('env(safe-area-inset-bottom)');
    expect(bottomNavSource).toContain('activeSession');
  });
});
