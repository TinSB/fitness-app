import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TodayView state copy', () => {
  const source = readFileSync('src/features/TodayView.tsx', 'utf8');
  const presenterSource = readFileSync('src/presenters/todayPresenter.ts', 'utf8');

  it('switches completed state CTA away from start training', () => {
    expect(source).toContain("todayTrainingState.status === 'completed'");
    expect(presenterSource).toContain('今日训练已完成');
    expect(source).toContain('查看本次训练');
    expect(source).toContain('查看日历');
    expect(source).toContain('再练一场');
  });

  it('labels post-completion recommendation as next recommendation', () => {
    expect(presenterSource).toContain('下次建议');
    expect(source).toContain('下次建议');
    expect(source).toContain('不是今天必须继续训练');
    expect(source).toContain('今天已经完成训练，仍要再练一场？');
    expect(source).toContain('系统会把这次训练作为额外训练记录保存。');
  });
});
