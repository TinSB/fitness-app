import { describe, expect, it } from 'vitest';
import { buildHistoryCalendarSummary } from '../src/engines/historyCalendarSummary';
import { makeSession } from './fixtures';

const session = (id: string, date: string, exerciseId = 'bench-press') =>
  makeSession({
    id,
    date,
    templateId: exerciseId === 'bench-press' ? 'push-a' : 'pull-a',
    exerciseId,
    setSpecs: [{ weight: exerciseId === 'bench-press' ? 100 : 70, reps: 5, rir: 1, techniqueQuality: 'good' }],
  });

describe('historyCalendarSummary', () => {
  it('marks trained rest today selected and PR days without mutating sessions', () => {
    const sessions = [
      session('bench-1', '2026-05-04'),
      session('pull-1', '2026-05-07', 'lat-pulldown'),
      session('bench-2', '2026-05-12'),
    ];
    const before = JSON.stringify(sessions);

    const result = buildHistoryCalendarSummary({
      sessions,
      selectedDate: '2026-05-07',
      today: '2026-05-13',
      month: '2026-05',
      dataHealthIssueCount: 1,
    });

    expect(result.calendarDays.find((day) => day.date === '2026-05-04')).toMatchObject({ hasTraining: true, hasPr: true });
    expect(result.calendarDays.find((day) => day.date === '2026-05-05')).toMatchObject({ hasTraining: false, intensityLabel: '休息' });
    expect(result.calendarDays.find((day) => day.date === '2026-05-13')).toMatchObject({ isToday: true });
    expect(result.calendarDays.find((day) => day.date === '2026-05-07')).toMatchObject({ isSelected: true });
    expect(result.selectedDaySummary).toMatchObject({ date: '2026-05-07', trained: true });
    expect(result.selectedDaySummary.sessionTitles.length).toBe(1);
    expect(result.thisWeekTrainingDays).toBe(1);
    expect(result.thisMonthTrainingDays).toBe(3);
    expect(result.recentFourWeekAverage).toBe(0.75);
    expect(result.dataHealthHint).toBe('有 1 条记录建议检查');
    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.trainingAlgorithmChanged).toBe(false);
    expect(JSON.stringify(sessions)).toBe(before);
  });

  it('returns friendly empty state and PR/e1RM quick access placeholders for empty history', () => {
    const result = buildHistoryCalendarSummary({
      sessions: [],
      selectedDate: '2026-05-10',
      today: '2026-05-10',
      month: '2026-05',
    });

    expect(result.selectedDaySummary).toMatchObject({
      trained: false,
      emptyCopy: '这天没有训练记录。休息日也属于计划的一部分。',
    });
    expect(result.trainedDaysCount).toBe(0);
    expect(result.restDaysCount).toBeGreaterThan(0);
    expect(result.dataHealthHint).toBe('没有明显异常');
    expect(result.prQuickAccessItems.find((item) => item.exerciseId === 'bench-press')).toMatchObject({
      label: '卧推',
      hasData: false,
      prLabel: '暂无正式记录',
      e1rmLabel: '暂无 e1RM',
    });
  });

  it('uses existing calculated PR and e1RM data for quick access', () => {
    const result = buildHistoryCalendarSummary({
      sessions: [session('bench-1', '2026-05-04')],
      selectedDate: '2026-05-04',
      today: '2026-05-05',
      month: '2026-05',
    });

    const bench = result.prQuickAccessItems.find((item) => item.exerciseId === 'bench-press');
    expect(bench?.hasData).toBe(true);
    expect(bench?.prLabel).toContain('kg');
    expect(bench?.e1rmLabel).toContain('e1RM');
  });
});
