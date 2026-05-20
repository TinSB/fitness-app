import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const forbiddenExactLightSurface = /\b(?:bg-white|bg-stone-50|bg-slate-50|text-black|border-slate-200|divide-slate-200)(?:\s|["'`])/;

describe('UI-OS R8.5 global dark detail surface scan', () => {
  it('rejects uncontrolled light surfaces in dark training sheet owners', () => {
    for (const file of [
      'src/ui/BottomSheet.tsx',
      'src/ui/WorkoutActionBar.tsx',
      'src/ui/ActionButton.tsx',
      'src/ui/ListItem.tsx',
      'src/ui/ConfirmDialog.tsx',
      'src/features/TrainingFocusView.tsx',
      'src/features/TrainingView.tsx',
    ]) {
      const source = read(file);
      if (forbiddenExactLightSurface.test(source)) {
        expect(source, `${file} light branches must be theme-gated`).toMatch(/useUiTheme|resolvedTheme|isDarkTheme/);
      }
    }
  });

  it('contains explicit dark remaps for legacy detail content that still lives inside RecordView', () => {
    const drawer = read('src/ui/Drawer.tsx');
    const record = read('src/features/RecordView.tsx');

    expect(drawer).toContain('data-training-detail-surface={surface.resolvedMode}');
    expect(drawer).toContain('[&_.bg-white]:bg-white/[0.06]');
    expect(drawer).toContain('[&_.border-slate-200]:border-white/10');
    expect(record).toContain("from '../ui/Drawer'");
  });

  it('keeps the theme surface model dark sheets non-white while allowing light mode branches', () => {
    const source = read('src/uiOs/theme/themeSurfaceModel.ts');
    const darkBranch = source.slice(source.indexOf('const darkSurfaceClasses'), source.indexOf('const lightSurfaceClasses'));

    expect(darkBranch).toContain("bottom_sheet: 'border border-white/10 bg-[#1c1c1e]/95");
    expect(darkBranch).toContain("modal_surface: 'border border-white/10 bg-[#1c1c1e]/95");
    expect(darkBranch).not.toMatch(/\bbg-white(?:\s|["'`])/);
  });
});
