import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('UI-OS R8.7C one-layer sheet interaction standard', () => {
  it('makes legacy training sheets backdrop handle and Escape dismissable without a visible close button by default', () => {
    const source = read('src/ui/BottomSheet.tsx');

    expect(source).toContain('showCloseButton = false');
    expect(source).toContain('closeOnBackdrop = true');
    expect(source).toContain('closeOnHandle = true');
    expect(source).toContain('data-bottom-sheet-backdrop="dismiss"');
    expect(source).toContain('data-bottom-sheet-handle="dismiss"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('data-training-sheet-layer="one-layer"');
    expect(source).toContain('onClose={showCloseButton ? onClose : undefined}');
  });

  it('keeps UI-OS sheets on the same backdrop handle and Escape contract', () => {
    const source = read('src/uiOs/surfaces/BottomSheet.tsx');

    expect(source).toContain('closeOnBackdrop = true');
    expect(source).toContain('closeOnHandle = true');
    expect(source).toContain('data-bottom-sheet-backdrop="dismiss"');
    expect(source).toContain('data-bottom-sheet-handle="dismiss"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('data-theme-surface="bottom_sheet"');
  });

  it('keeps More as a single overlay with backdrop and handle close while protecting action taps', () => {
    const source = read('src/uiOs/training/FocusModeSecondaryActions.tsx');

    expect(source).toContain('data-focus-more-backdrop="dismiss"');
    expect(source).toContain('data-focus-more-handle="dismiss"');
    expect(source).toContain('data-focus-more-action-grid="protected"');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).not.toContain('<details');
  });

  it('uses one direct end workout confirmation sheet without nested confirmation copy', () => {
    const source = read('src/features/TrainingFocusView.tsx');
    const start = source.indexOf('const renderEndSessionSheet');
    const end = source.indexOf('const renderCompletedState');
    const endSheetSource = source.slice(start, end);

    expect(endSheetSource).toContain('title="仍有未完成动作，是否结束训练？"');
    expect(endSheetSource).toContain('继续训练');
    expect(endSheetSource).toContain('确认结束训练');
    expect(endSheetSource).not.toContain('ConfirmDialog');
    expect(endSheetSource).not.toContain('结束训练需要再次确认');
    expect(endSheetSource).not.toContain('需要手动确认');
  });

  it('keeps training sheet callers on one sheet layer for switch replacement and recommendation flows', () => {
    const source = read('src/features/TrainingFocusView.tsx');
    const sheetTitles = ['title="切换动作"', 'title="选择本次实际执行动作"', 'title="推荐依据"', 'title="仍有未完成动作，是否结束训练？"'];

    for (const title of sheetTitles) {
      expect(source).toContain(title);
    }

    const trainingSheetSource = [
      'src/ui/BottomSheet.tsx',
      'src/uiOs/surfaces/BottomSheet.tsx',
      'src/uiOs/training/FocusModeSecondaryActions.tsx',
      'src/features/TrainingFocusView.tsx',
    ].map(read).join('\n');

    expect(trainingSheetSource).not.toContain('nested confirm');
    expect(trainingSheetSource).not.toContain('third-level modal');
  });
});
