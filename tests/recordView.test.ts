import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RecordView information architecture', () => {
  const recordSource = readFileSync(resolve(process.cwd(), 'src/features/RecordView.tsx'), 'utf8');
  const progressSource = readFileSync(resolve(process.cwd(), 'src/features/ProgressView.tsx'), 'utf8');

  it('wraps the existing progress capabilities and defaults to calendar', () => {
    expect(recordSource).toContain('ProgressView');
    expect(recordSource).toContain("initialSection={props.initialSection || 'calendar'}");
    expect(progressSource).toContain("initialSection || 'calendar'");
  });

  it('keeps the second-level record tabs visible', () => {
    for (const label of ['训练日历', '历史训练', '统计', '个人记录 / PR', '数据管理']) {
      expect(progressSource).toContain(label);
    }
  });

  it('shows a useful empty state for calendar-first records', () => {
    expect(progressSource).toContain('暂无训练记录');
    expect(progressSource).toContain('完成一次训练后，这里会自动显示训练日历');
    expect(progressSource).toContain('开始训练');
  });
});
