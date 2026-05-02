import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Record operation feedback UI contract', () => {
  const recordSource = readFileSync(resolve(process.cwd(), 'src/features/RecordView.tsx'), 'utf8');
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('uses explicit confirmation copy for deletion and canceling dirty edits', () => {
    expect(recordSource).toContain('删除这次训练？');
    expect(recordSource).toContain('删除后该训练不会参与日历、PR、e1RM、有效组和统计。建议先导出备份。');
    expect(recordSource).toContain('放弃修正？');
    expect(recordSource).toContain('当前修改不会保存。');
    expect(recordSource).toContain('放弃修改');
    expect(recordSource).toContain('继续编辑');
  });

  it('routes local validation failures through user-visible feedback', () => {
    expect(recordSource).toContain('保存失败，请检查输入后重试。');
    expect(recordSource).toContain('没有需要保存的修改。');
    expect(recordSource).toContain('onOperationFeedback');
  });

  it('does not use native dialogs for record operations', () => {
    expect(recordSource).not.toMatch(/\bwindow\.alert\b|\bwindow\.confirm\b|\balert\(/);
    expect(appSource).not.toMatch(/\bwindow\.alert\b|\bwindow\.confirm\b|\balert\(/);
  });
});
