import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FocusActualSetRecordSheet } from '../src/uiOs/training/FocusActualSetRecordSheet';
import { FocusModeSecondaryActions } from '../src/uiOs/training/FocusModeSecondaryActions';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R8 Focus compression', () => {
  it('keeps full actual input out of the main Focus screen and available through bottom sheet', () => {
    const source = read('src/features/TrainingFocusView.tsx');
    const sheet = renderToStaticMarkup(
      React.createElement(FocusActualSetRecordSheet, {
        isOpen: true,
        onClose: () => undefined,
        weightUnit: 'lb',
        weightValue: undefined,
        repsValue: undefined,
        rirValue: undefined,
        noteValue: '',
        missingInput: true,
        onWeightChange: () => undefined,
        onRepsChange: () => undefined,
        onRirChange: () => undefined,
        onNoteChange: () => undefined,
        onComplete: () => undefined,
      }),
    );

    expect(source).toContain('data-focus-actual-form-visible="false"');
    expect(source).not.toContain('ActualSetInputCard');
    expect(source).toContain('FocusActualSetRecordSheet');
    expect(sheet).toContain('data-focus-actual-set-record-sheet="bottom-sheet"');
    expect(sheet).toContain('role="dialog"');
  });

  it('keeps equipment details collapsed and secondary actions behind 更多', () => {
    const source = read('src/features/TrainingFocusView.tsx');
    const secondary = renderToStaticMarkup(
      React.createElement(FocusModeSecondaryActions, {
        actions: [
          { id: 'copy', label: '复制上组', onClick: () => undefined },
          { id: 'skip', label: '跳过', onClick: () => undefined },
        ],
        isOpen: false,
        onOpenChange: () => undefined,
      }),
    );
    const openSecondary = renderToStaticMarkup(
      React.createElement(FocusModeSecondaryActions, {
        actions: [
          { id: 'copy', label: '复制上组', onClick: () => undefined },
          { id: 'skip', label: '跳过', onClick: () => undefined },
        ],
        isOpen: true,
        onOpenChange: () => undefined,
      }),
    );

    expect(source).toContain('data-focus-actual-form-visible="false"');
    expect(secondary).toContain('data-focus-secondary-mode="more-closed"');
    expect(secondary).toContain('更多');
    expect(openSecondary).toContain('复制上组');
    expect(openSecondary).toContain('跳过');
  });

  it('keeps Focus immersive no-nav and one-primary-action locks', () => {
    const appSource = read('src/App.tsx');
    const actionBarSource = read('src/uiOs/training/FocusModeActionBar.tsx');
    const focusSource = read('src/features/TrainingFocusView.tsx');

    expect(appSource).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(actionBarSource).toContain('data-focus-mode-action-bar="one-dominant-primary"');
    expect(focusSource).not.toMatch(/primaryLabel=\{[^}]*\}[\s\S]*primaryLabel=\{/);
    expect((focusSource.match(/完成一组/g) || []).length).toBeLessThanOrEqual(1);
  });
});
