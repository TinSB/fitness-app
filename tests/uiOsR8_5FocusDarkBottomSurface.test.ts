import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('UI-OS R8.5 Focus dark bottom surface', () => {
  it('keeps the Focus bottom action area dark and safe-area aware', () => {
    const source = read('src/ui/WorkoutActionBar.tsx');

    expect(source).toContain('data-theme-surface="bottom_sheet"');
    expect(source).toContain('data-theme-mode="dark"');
    expect(source).toContain('env(safe-area-inset-bottom)');
    expect(source).toContain('bg-[#0a0a0b]/96');
    expect(source).not.toMatch(/\bbg-white(?:\s|["'`])/);
    expect(source).not.toContain('border-slate-200');
  });

  it('keeps Focus replacement controls on dark compact surfaces', () => {
    const source = read('src/features/TrainingFocusView.tsx');

    expect(source).toContain('data-focus-recommendation-density="compact-single"');
    expect(source).not.toContain("selected ? 'bg-emerald-50");
    expect(source).not.toContain("'bg-stone-50'");
    expect(source).not.toContain('实际记录通过底部动作栏填写');
  });
});
