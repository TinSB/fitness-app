import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Profile layout', () => {
  const source = readFileSync('src/features/ProfileView.tsx', 'utf8');

  it('uses the responsive product page layout', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain('xl:grid-cols-[0.82fr_1.18fr]');
  });

  it('acts as the settings center', () => {
    expect(source).toContain('身体 / 动作筛查');
    expect(source).toContain('重量单位');
    expect(source).toContain('HealthDataPanel');
    expect(source).toContain('数据管理');
    expect(source).toContain('手机使用');
  });
});
