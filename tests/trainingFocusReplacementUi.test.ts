import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TrainingFocusView replacement UI', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/TrainingFocusView.tsx'), 'utf8');

  it('opens a replacement picker instead of silently doing nothing', () => {
    expect(source).toContain('setShowReplacementPicker(true)');
    expect(source).toContain('选择本次实际执行动作');
    expect(source).toContain('当前动作暂无可替代动作');
  });

  it('keeps the replacement button touch-safe and accessible', () => {
    expect(source).toContain('type="button" aria-label="替代动作"');
    expect(source).toContain('onClick={replaceExercise}');
    expect(source).toContain('取消');
  });

  it('shows the PR and e1RM independence note in the picker', () => {
    expect(source).toContain('PR / e1RM 独立统计');
  });
});
