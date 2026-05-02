import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { RecordView } from '../src/features/RecordView';
import { makeAppData, makeSession } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const session = (id: string, date: string, templateId = 'pull-a') =>
  makeSession({
    id,
    date,
    templateId,
    exerciseId: templateId === 'pull-a' ? 'lat-pulldown' : 'bench-press',
    setSpecs: [{ weight: 70, reps: 8 }],
  });

const renderRecord = (history: ReturnType<typeof session>[], selectedDate?: string) => {
  const data = makeAppData({ history });
  return visibleText(
    <RecordView
      data={data}
      unitSettings={data.unitSettings}
      weeklyPrescription={buildWeeklyPrescription(data)}
      bodyWeightInput=""
      setBodyWeightInput={noop as React.Dispatch<React.SetStateAction<string>>}
      onSaveBodyWeight={noop}
      onDeleteSession={noop}
      onMarkSessionDataFlag={noop}
      onUpdateUnitSettings={noop}
      onRestoreData={noop}
      initialSection="calendar"
      selectedDate={selectedDate}
    />,
  );
};

describe('Record calendar history visibility', () => {
  it('defaults to the latest training month instead of locking the calendar to today', () => {
    const text = renderRecord([session('pull-a-april', '2026-04-30')]);

    expect(text).toContain('2026-04');
    expect(text).toContain('30');
    expect(text).not.toContain('当天没有训练记录');
    expect(text).not.toMatch(/\b(undefined|null)\b/);
  });

  it('renders month navigation controls for previous month, next month, and today', () => {
    const text = renderRecord([session('pull-a-april', '2026-04-30'), session('push-a-may', '2026-05-01', 'push-a')]);

    expect(text).toContain('上一月');
    expect(text).toContain('下一月');
    expect(text).toContain('今天');
  });

  it('syncs an externally selected April date into the April calendar', () => {
    const text = renderRecord([session('pull-a-april', '2026-04-30'), session('push-a-may', '2026-05-01', 'push-a')], '2026-04-30');

    expect(text).toContain('2026-04');
    expect(text).toContain('2026-04-30');
  });

  it('guards RecordView against direct current-month calendar construction', () => {
    const source = readFileSync('src/features/RecordView.tsx', 'utf8');

    expect(source).toContain('const [calendarMonth');
    expect(source).toContain('buildTrainingCalendar(rawHistory, calendarMonth');
    expect(source).not.toContain('buildTrainingCalendar(rawHistory, undefined');
  });
});
