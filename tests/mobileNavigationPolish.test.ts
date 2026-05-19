import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile navigation polish', () => {
  const navigationSource = readFileSync(resolve(process.cwd(), 'src/uiOs/uiOsNavigation.ts'), 'utf8');
  const bottomNavSource = readFileSync(resolve(process.cwd(), 'src/uiOs/BottomNav.tsx'), 'utf8');

  it('keeps the primary mobile navigation labels visible', () => {
    for (const label of ['今日', '训练', '历史', '进步', '设置']) {
      expect(navigationSource).toContain(`label: '${label}'`);
    }
  });

  it('uses safe-area padding and a lightweight active state for bottom navigation', () => {
    expect(bottomNavSource).toContain('env(safe-area-inset-bottom)');
    expect(bottomNavSource).toContain('bg-white text-black');
    expect(bottomNavSource).toContain('text-[11px] font-medium');
  });
});
