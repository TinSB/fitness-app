import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Profile layout', () => {
  const source = readFileSync('src/features/ProfileView.tsx', 'utf8');

  it('uses the responsive product page layout', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain('xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]');
  });

  it('acts as the settings center', () => {
    expect(source).toContain('个人数据状态');
    expect(source).toContain('身体 / 动作筛查');
    expect(source).toContain('单位设置');
    expect(source).toContain('HealthDataPanel');
    expect(source).toContain('备份与恢复');
    expect(source).toContain('PWA / 本地数据说明');
    expect(source).toContain('关于 IronPath');
  });

  it('separates global backup restore from training record data management', () => {
    expect(source).toContain('管理单次训练记录');
    expect(source).toContain('这是全局应用数据备份');
    expect(source).toContain('导入恢复');
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('确认恢复');
  });

  it('does not become another training or record page', () => {
    expect(source).not.toContain('今日建议');
    expect(source).not.toContain('完成一组');
    expect(source).not.toContain('训练日历');
    expect(source).not.toContain('PR 趋势');
  });
});
