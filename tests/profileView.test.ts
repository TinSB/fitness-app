import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ProfileView secondary entry points', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/ProfileView.tsx'), 'utf8');

  it('contains the screening entry moved out of primary navigation', () => {
    expect(source).toContain('身体 / 动作筛查');
    expect(source).toContain('打开筛查');
    expect(source).toContain('onOpenAssessment');
  });

  it('contains unit settings and data management', () => {
    expect(source).toContain('重量单位');
    expect(source).toContain('导出 JSON');
    expect(source).toContain('导出 CSV');
    expect(source).toContain('导入备份');
  });

  it('contains PWA and local data guidance', () => {
    expect(source).toContain('手机使用');
    expect(source).toContain('本地数据');
    expect(source).toContain('非医疗工具');
  });
});
