import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Today layout', () => {
  const source = readFileSync('src/features/TodayView.tsx', 'utf8');

  it('uses the responsive dashboard layout', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain("from '../ui/layouts/DashboardLayout'");
    expect(source).toContain('<DashboardLayout');
  });

  it('keeps the core decision metrics single-purpose', () => {
    expect((source.match(/MetricCard label="准备度"/g) || []).length).toBe(1);
    expect((source.match(/MetricCard label="预计时长"/g) || []).length).toBe(1);
  });

  it('keeps completed state away from start-training as the primary CTA', () => {
    expect(source).toContain('查看本次训练');
    expect(source).toContain('再练一场');
    expect(source).toContain('下次建议');
    expect(source).toContain('你今天已经完成训练，确定要再开始一场吗？');
  });
});
