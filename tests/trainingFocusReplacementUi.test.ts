import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TrainingFocusView replacement UI', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/TrainingFocusView.tsx'), 'utf8');

  it('opens a replacement picker instead of silently doing nothing', () => {
    expect(source).toContain('setShowReplacementPicker(true)');
    expect(source).toContain('<BottomSheet');
    expect(source).toContain('showReplacementPicker');
  });

  it('keeps the replacement button touch-safe and accessible', () => {
    expect(source).toContain('type="button"');
    expect(source).toContain('替代动作');
    expect(source).toContain('onClick={openReplacementPicker}');
    expect(source).toContain('onClose={() => setShowReplacementPicker(false)}');
  });

  it('shows the PR and e1RM independence note in the picker', () => {
    expect(source).toContain('PR / e1RM');
    expect(source).toContain('formatFatigueCost(option.fatigueCost)');
    expect(source).toContain('chooseReplacement');
  });
});
