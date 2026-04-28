import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TrainingFocusView interaction surface', () => {
  const source = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

  it('keeps the core workout remote actions visible', () => {
    expect(source).toContain('completeCurrentSet');
    expect(source).toContain('copyPrevious');
    expect(source).toContain('markPain');
    expect(source).toContain('openReplacementPicker');
    expect(source).toContain('onApplySuggestion');
  });

  it('separates prescription and actual record areas', () => {
    expect(source).toContain('plannedSummary');
    expect(source).toContain('actualSummary');
    expect(source).toContain('actualWeightKg');
    expect(source).toContain('actualReps');
  });

  it('uses the product workout action bar and collapses long details', () => {
    expect(source).toContain('WorkoutActionBar');
    expect(source).toContain('BottomSheet');
    expect(source).toContain('Toast');
    expect(source).toContain('<details');
  });
});
