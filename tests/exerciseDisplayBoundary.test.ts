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

  it('keeps plan schedule details focused on user-facing prescription fields', () => {
    const source = read('src/features/PlanView.tsx');

    expect(source).toContain('title="训练日详情"');
    expect(source).toContain('组数');
    expect(source).toContain('次数下限');
    expect(source).toContain('休息秒数');
    expect(source).not.toContain('formatFatigueCost');
    expect(source).not.toContain('formatSkillDemand');
    expect(source).not.toContain('技术标准');
    expect(source).not.toContain('progressionUnit}');
  });
});
