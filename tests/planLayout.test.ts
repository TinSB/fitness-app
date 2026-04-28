import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Plan layout', () => {
  const source = readFileSync('src/features/PlanView.tsx', 'utf8');

  it('uses the responsive product page layout', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain('xl:grid-cols-[340px_minmax(0,1fr)]');
  });

  it('keeps plan management content visible', () => {
    expect(source).toContain('当前模板状态');
    expect(source).toContain('训练基线');
    expect(source).toContain('调整历史');
  });

  it('does not become a history page', () => {
    expect(source).not.toContain('训练日历');
  });
});
