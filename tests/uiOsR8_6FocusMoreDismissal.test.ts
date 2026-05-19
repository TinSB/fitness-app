import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R8.6 Focus panel dismissal', () => {
  it('uses a controlled More overlay that closes from the backdrop and Escape', () => {
    const source = read('src/uiOs/training/FocusModeSecondaryActions.tsx');

    expect(source).toContain('isOpen');
    expect(source).toContain('onOpenChange(false)');
    expect(source).toContain('data-focus-more-backdrop="dismiss"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('event.stopPropagation()');
    expect(source).not.toContain('<details');
  });

  it('keeps switch, recommendation, actual-record, and weight details sheets backdrop-dismissable', () => {
    expect(read('src/ui/BottomSheet.tsx')).toContain('data-bottom-sheet-backdrop="dismiss"');
    expect(read('src/uiOs/surfaces/BottomSheet.tsx')).toContain('data-bottom-sheet-backdrop="dismiss"');
    expect(read('src/ui/EquipmentAwareLoadDisplay.tsx')).toContain('title="重量详情"');
    expect(read('src/features/TrainingFocusView.tsx')).toContain('title="推荐依据"');
    expect(read('src/features/TrainingFocusView.tsx')).toContain('FocusActualSetRecordSheet');
  });
});
