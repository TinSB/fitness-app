import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ProgressView entry points', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/ProgressView.tsx'), 'utf8');

  it('has visible Chinese section entries for calendar and history', () => {
    expect(source).toContain('训练仪表盘');
    expect(source).toContain("mobileLabel: '仪表盘'");
    expect(source).toContain('训练日历');
    expect(source).toContain("mobileLabel: '日历'");
    expect(source).toContain('历史训练');
    expect(source).toContain("mobileLabel: '历史'");
    expect(source).toContain('个人记录 / PR');
    expect(source).toContain('数据管理');
  });

  it('has an empty history state and session detail entry', () => {
    expect(source).toContain('暂无训练记录');
    expect(source).toContain('查看详情');
  });
});
