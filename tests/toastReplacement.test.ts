import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('toast replacement for native alert flows', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('uses toast for program adjustment success and failure', () => {
    expect(source).toContain("showAppToast('已生成下周实验模板。', 'success')");
    expect(source).toContain("showAppToast('计划调整功能暂时无法加载，请稍后再试。', 'danger')");
    expect(source).toContain("showAppToast(result.message || '计划调整失败，请重新生成预览。', 'danger')");
  });

  it('uses toast for missing records and data health navigation feedback', () => {
    expect(source).toContain("showAppToast('暂时无法定位到对应记录。', 'warning')");
    expect(source).toContain("showAppToast('已定位到健康数据导入。', 'info')");
    expect(source).toContain("showAppToast('已定位到备份与恢复。', 'info')");
  });

  it('does not call native alert', () => {
    expect(source).not.toContain('window.alert');
    expect(source).not.toMatch(/(^|[^A-Za-z])alert\s*\(/);
  });
});
