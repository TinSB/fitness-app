import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI-OS R8.6 end workout confirmation copy', () => {
  it('removes long confirmation microcopy while keeping explicit actions', () => {
    const source = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

    expect(source).toContain('title="仍有未完成动作，是否结束训练？"');
    expect(source).toContain('继续训练');
    expect(source).toContain('确认结束训练');
    expect(source).not.toContain('结束训练需要再次确认');
    expect(source).not.toContain('未完成的动作不会被自动补完，当前本地训练记录仍会保留');
  });

  it('keeps generic confirm copy available but not forced into the end-workout sheet', () => {
    const sheetSource = readFileSync('src/uiOs/surfaces/BottomSheet.tsx', 'utf8');
    const focusSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');
    const endSheetSource = focusSource.slice(focusSource.indexOf('const renderEndSessionSheet'), focusSource.indexOf('const renderCompletedState'));

    expect(sheetSource).toContain('showConfirmCopy');
    expect(sheetSource).toContain('需要手动确认');
    expect(endSheetSource).not.toContain('confirmRequired');
    expect(endSheetSource).not.toContain('需要手动确认');
    expect(endSheetSource).not.toContain('ConfirmDialog');
  });
});
