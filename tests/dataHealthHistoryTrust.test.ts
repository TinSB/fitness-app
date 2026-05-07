import { describe, expect, it } from 'vitest';
import {
  buildDataHealthReport,
  dismissDataHealthIssueToday,
  type DataHealthIssue,
} from '../src/engines/dataHealthEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const session = (id: string, date = '2026-05-04') =>
  makeSession({
    id,
    date,
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  });

const issueIds = (issues: DataHealthIssue[]) => issues.map((issue) => issue.id);

const visibleText = (vm: ReturnType<typeof buildDataHealthViewModel>) =>
  [
    vm.statusLabel,
    vm.summary,
    ...vm.primaryIssues.flatMap((issue) => [issue.title, issue.userMessage, issue.severityLabel, issue.action?.label || '', issue.dismissAction?.label || '']),
    ...vm.secondaryIssues.flatMap((issue) => [issue.title, issue.userMessage, issue.severityLabel, issue.action?.label || '', issue.dismissAction?.label || '']),
  ].join('\n');

describe('DataHealth history trustworthiness checks', () => {
  it('reports identityInvalid and legacy actual exercise identity without exposing internal ids in default UI', () => {
    const source = session('identity-invalid-session');
    source.exercises[0] = {
      ...source.exercises[0],
      identityInvalid: true,
      legacyActualExerciseId: '__auto_alt_bench',
      actualExerciseId: undefined,
    };

    const report = buildDataHealthReport(makeAppData({ history: [source] }));
    const vm = buildDataHealthViewModel(report);
    const identityIssue = report.issues.find((issue) => issue.id.startsWith('exercise-identity-review'));

    expect(identityIssue).toMatchObject({
      severity: 'error',
      category: 'replacement',
      canAutoFix: false,
    });
    expect(identityIssue?.affectedIds).toEqual(expect.arrayContaining(['identity-invalid-session', '__auto_alt_bench']));
    expect(vm.primaryIssues[0]).toMatchObject({
      title: '动作记录身份需要检查',
      userMessage: expect.stringContaining('不会把它用于 PR、e1RM 或有效组'),
    });
    expect(visibleText(vm)).not.toMatch(/__auto_alt|identity-invalid-session|undefined|null/);
  });

  it('reports incomplete draft sets and summary mismatches from real set logs', () => {
    const source = session('draft-summary-session');
    source.exercises[0].sets[0] = {
      ...source.exercises[0].sets[0],
      done: false,
      weight: 92.5,
      actualWeightKg: 92.5,
      reps: 5,
      rir: 2,
    };
    (source as TrainingSession & { completedSets: number; totalVolumeKg: number; effectiveSets: number }).completedSets = 1;
    (source as TrainingSession & { completedSets: number; totalVolumeKg: number; effectiveSets: number }).totalVolumeKg = 462.5;
    (source as TrainingSession & { completedSets: number; totalVolumeKg: number; effectiveSets: number }).effectiveSets = 1;

    const report = buildDataHealthReport(makeAppData({ history: [source] }));

    expect(issueIds(report.issues)).toEqual(expect.arrayContaining([
      'incomplete-draft-set-draft-summary-session-bench-press-1',
      'summary-completed-mismatch-draft-summary-session',
      'summary-volume-mismatch-draft-summary-session',
      'summary-effective-mismatch-draft-summary-session',
      'incomplete-counted-in-summary-draft-summary-session',
    ]));
  });

  it('reports warmup counted in effective sets, missing actualWeightKg, duplicate timestamps, and invalid exercise references', () => {
    const first = session('trust-a');
    const second = session('trust-b');
    first.startedAt = '2026-05-04T14:00:00.000Z';
    first.finishedAt = '2026-05-04T15:00:00.000Z';
    second.startedAt = first.startedAt;
    second.finishedAt = first.finishedAt;
    first.exercises[0].sets[0] = {
      ...first.exercises[0].sets[0],
      id: 'warmup-with-display',
      type: 'warmup',
      actualWeightKg: undefined,
      displayWeight: 135,
      displayUnit: 'lb',
    } as TrainingSetLog;
    (first as TrainingSession & { effectiveSets: number }).effectiveSets = 2;
    second.exercises[0].id = 'missing-exercise-id';

    const report = buildDataHealthReport(makeAppData({ history: [first, second] }));
    const ids = issueIds(report.issues);

    expect(ids).toContain('warmup-counted-effective-trust-a');
    expect(ids.some((id) => id.startsWith('display-weight-without-actual-kg-trust-a'))).toBe(true);
    expect(ids.some((id) => id.startsWith('duplicate-session-timestamp-trust-a-trust-b'))).toBe(true);
    expect(ids).toContain('invalid-exercise-reference-trust-b-0');
  });

  it('aggregates same-type visible issues, keeps the original report intact, and respects today dismiss', () => {
    const first = session('draft-one');
    const second = session('draft-two');
    first.exercises[0].sets[0] = { ...first.exercises[0].sets[0], done: false, actualWeightKg: 80, reps: 6, rir: 2 };
    second.exercises[0].sets[0] = { ...second.exercises[0].sets[0], done: false, actualWeightKg: 82.5, reps: 5, rir: 1 };

    const report = buildDataHealthReport(makeAppData({ history: [first, second] }));
    const before = JSON.stringify(report);
    const vm = buildDataHealthViewModel(report, { currentDate: '2026-05-04' });
    const visibleIds = [...vm.primaryIssues, ...vm.secondaryIssues].map((issue) => issue.id);
    const dismissed = [dismissDataHealthIssueToday('aggregate-incomplete-draft-sets', '2026-05-04')];
    const todayVm = buildDataHealthViewModel(report, { dismissedIssues: dismissed, currentDate: '2026-05-04' });
    const tomorrowVm = buildDataHealthViewModel(report, { dismissedIssues: dismissed, currentDate: '2026-05-05' });

    expect(report.issues.filter((issue) => issue.id.startsWith('incomplete-draft-set'))).toHaveLength(2);
    expect(visibleIds).toContain('aggregate-incomplete-draft-sets');
    expect(visibleIds).not.toContain('incomplete-draft-set-draft-one-bench-press-1');
    expect(JSON.stringify(report)).toBe(before);
    expect([...todayVm.primaryIssues, ...todayVm.secondaryIssues].map((issue) => issue.id)).not.toContain('aggregate-incomplete-draft-sets');
    expect([...tomorrowVm.primaryIssues, ...tomorrowVm.secondaryIssues].map((issue) => issue.id)).toContain('aggregate-incomplete-draft-sets');
  });

  it('keeps DataHealth visible text free of raw enums, undefined, null, and internal ids', () => {
    const source = session('visible-text-session');
    source.exercises[0].sets[0] = { ...source.exercises[0].sets[0], done: false, actualWeightKg: 80, reps: 6, rir: 2 };

    const vm = buildDataHealthViewModel(buildDataHealthReport(makeAppData({ history: [source] })));
    const text = visibleText(vm);

    expect(text).not.toMatch(/\b(history|summary|analytics|warning|error|info)\b/);
    expect(text).not.toMatch(/visible-text-session|bench-press|undefined|null|__auto_alt|__alt_/);
  });
});
