import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Plan layout', () => {
  const source = readFileSync('src/features/PlanView.tsx', 'utf8');

  it('uses the responsive product page layout', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain('xl:grid-cols-[minmax(0,1.55fr)_420px]');
  });

  it('keeps plan management content visible', () => {
    expect(source).toContain('当前模板');
    expect(source).toContain('周期时间线');
    expect(source).toContain('本周训练日');
    expect(source).toContain('训练日模板');
    expect(source).toContain('实验模板');
    expect(source).toContain('调整建议');
    expect(source).toContain('版本历史与回滚');
  });

  it('does not become a history page', () => {
    expect(source).not.toContain('训练日历');
    expect(source).not.toContain('健康数据导入');
    expect(source).not.toContain('备份恢复');
  });

  it('explains rollback and keeps experimental templates visually distinct', () => {
    expect(source).toContain('已经完成的训练记录');
    expect(source).toContain('不会被删除');
    expect(source).toContain('当前实验模板');
    expect(source).toContain('实验模板');
    expect(source).toContain('border-amber-200 bg-amber-50');
  });
});
