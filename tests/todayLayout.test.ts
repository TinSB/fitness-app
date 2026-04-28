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
    expect((source.match(/MetricCard\s+label="准备度"/g) || []).length).toBe(1);
    expect((source.match(/MetricCard\s+label="预计时长"/g) || []).length).toBe(1);
  });

  it('answers the Today page decision questions without long-term panels', () => {
    expect(source).toContain('今天练不练、练什么，以及从哪里开始');
    expect(source).toContain('训练预览');
    expect(source).toContain('计划进度');
    expect(source).not.toContain('WeeklyPrescriptionCard');
    expect(source).not.toContain('e1RM');
  });

  it('keeps completed state away from start-training as the primary CTA', () => {
    expect(source).toContain('查看本次训练');
    expect(source).toContain('再练一场');
    expect(source).toContain('下次建议');
    expect(source).toContain('你今天已经完成训练，确定要再开始一场吗？');
  });
});
