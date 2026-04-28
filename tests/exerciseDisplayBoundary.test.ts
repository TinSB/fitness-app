import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('exercise metadata display boundary', () => {
  it('keeps heavy metadata out of the default focus-mode surface', () => {
    const source = read('src/features/TrainingFocusView.tsx');

    expect(source).not.toContain('evidenceTags');
    expect(source).not.toContain('muscleContribution');
    expect(source).not.toContain('regressionIds');
    expect(source).not.toContain('progressionIds');
  });

  it('keeps action-facing metadata formatted in plan details', () => {
    const source = read('src/features/PlanView.tsx');

    expect(source).toContain('formatFatigueCost');
    expect(source).toContain('formatSkillDemand');
    expect(source).toContain('formatWeight');
    expect(source).toContain('技术标准');
    expect(source).not.toContain('progressionUnit}');
  });
});
