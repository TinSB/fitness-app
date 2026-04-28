import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TrainingFocusView interaction surface', () => {
  const source = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

  it('keeps the core workout remote actions visible', () => {
    expect(source).toContain('completeCurrentSet');
    expect(source).toContain('copyPrevious');
    expect(source).toContain('togglePainFlag');
    expect(source).toContain('replaceExercise');
    expect(source).toContain('onApplySuggestion');
  });

  it('separates prescription and actual record areas', () => {
    expect(source).toContain('plannedSummary');
    expect(source).toContain('actualSummary');
    expect(source).toContain('actualWeightKg');
    expect(source).toContain('actualReps');
  });

  it('does not expose long evidence panels in the default action bar', () => {
    expect(source).toContain('查看训练顺序与依据');
    expect(source).toContain('MobileActionBar');
  });
});
