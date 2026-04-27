import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile navigation polish', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('keeps the primary mobile navigation labels visible', () => {
    for (const label of ['今日', '训练', '记录', '计划', '我的']) {
      expect(source).toContain(`label: '${label}'`);
    }
  });

  it('uses safe-area padding and a lightweight active state for bottom navigation', () => {
    expect(source).toContain('env(safe-area-inset-bottom)');
    expect(source).toContain('bg-emerald-50 text-emerald-700');
    expect(source).toContain('text-[11px] font-medium');
  });
});
