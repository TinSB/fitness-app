import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FocusActualSetRecordSheet } from '../src/uiOs/training/FocusActualSetRecordSheet';

describe('FocusActualSetRecordSheet', () => {
  it('renders the R0 bottom-sheet actual input flow', () => {
    const html = renderToStaticMarkup(
      React.createElement(FocusActualSetRecordSheet, {
        isOpen: true,
        onClose: () => undefined,
        weightUnit: 'lb',
        weightValue: 45,
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

    expect(html).toContain('role="dialog"');
    expect(html).toContain('记录本组');
    expect(html).toContain('重量（lb）');
    expect(html).toContain('次数');
    expect(html).toContain('RIR');
    expect(html).toContain('备注');
    expect(html).toContain('data-focus-actual-set-record-sheet="bottom-sheet"');
  });
});
