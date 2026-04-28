import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Record layout', () => {
  const source = readFileSync('src/features/RecordView.tsx', 'utf8');

  it('defaults to the calendar-centered record view', () => {
    expect(source).toContain("initialSection || 'calendar'");
    expect(source).toContain("id: 'calendar'");
    expect(source).toContain("id: 'list'");
    expect(source).toContain("id: 'pr'");
    expect(source).toContain("id: 'stats'");
    expect(source).toContain("id: 'data'");
  });

  it('uses a responsive page and calendar/detail split', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain('xl:grid-cols-[minmax(0,1.35fr)_380px]');
    expect(source).toContain('训练日历');
  });

  it('keeps empty history lightweight', () => {
    expect(source).toContain('暂无训练记录');
    expect(source).toContain('完成一次训练后');
  });
});
