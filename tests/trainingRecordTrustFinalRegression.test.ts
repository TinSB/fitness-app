import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildDataHealthReport, dismissDataHealthIssueToday } from '../src/engines/dataHealthEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildEffectiveSetExplanation } from '../src/engines/effectiveSetExplanationEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, sessionEditFeedbackMessage, updateSessionSet, validateSessionEdit } from '../src/engines/sessionEditEngine';
import { deleteTrainingSession, filterAnalyticsHistory, listSessionHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { buildTrainingCalendar, getSessionCalendarDate, resolveCalendarSelectedDate } from '../src/engines/trainingCalendarEngine';
import { formatExerciseName } from '../src/i18n/formatters';
import { buildDataHealthViewModel, type DataHealthActionView } from '../src/presenters/dataHealthPresenter';
import type { AppData, SessionEditAffectedStat, TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

const forbiddenVisibleText = /\b(undefined|null|identityInvalid|legacyActualExerciseId|actualExerciseId|replacementExerciseId|ready_to_apply|applied|rolled_back)\b|__auto_alt|__alt_/;

const completedWorkingExclusionReasons = new Set([
  'identity_invalid',
  'test_or_excluded',
  'pain_flag',
  'poor_technique',
  'rir_missing',
  'not_enough_effort',
]);

const firstSession = (data: AppData, id: string) => {
  const session = data.history.find((item) => item.id === id);
  if (!session) throw new Error(`missing fixture session ${id}`);
  return session;
};

const warmupSet = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: 'main:bench-press:warmup:0',
  exerciseId: 'bench-press',
  type: 'warmup',
  weight: 40,
  actualWeightKg: 40,
  reps: 8,
  rir: '',
  done: true,
  ...overrides,
});

const recordSaveFields = (before: TrainingSession, after: TrainingSession) => {
  const editedFields: string[] = [];
  if (JSON.stringify(before.focusWarmupSetLogs || []) !== JSON.stringify(after.focusWarmupSetLogs || [])) editedFields.push('warmupSets');
  if (JSON.stringify((before.exercises || []).map((exercise) => exercise.sets)) !== JSON.stringify((after.exercises || []).map((exercise) => exercise.sets))) {
    editedFields.push('sets');
  }
  if ((before.dataFlag || 'normal') !== (after.dataFlag || 'normal')) editedFields.push('dataFlag');
  return editedFields;
};

const saveLikeRecord = (before: TrainingSession, after: TrainingSession) => {
  const validation = validateSessionEdit(after);
  if (!validation.valid) return { changed: false, toast: '保存失败，请检查输入后重试。', session: before };
  const fields = recordSaveFields(before, after);
  if (!fields.length) return { changed: false, toast: '没有需要保存的修改。', session: before };
  const session = markSessionEdited(after, fields, '历史训练详情修正', before);
  return { changed: true, toast: sessionEditFeedbackMessage(fields), session };
};

const resolveDataHealthRecordAction = (history: TrainingSession[], action?: DataHealthActionView) => {
  if (!action || action.type !== 'open_session_detail') return { section: 'list' as const, toast: '已打开历史列表。' };
  const target = history.find((session) => session.id === action.targetId);
  if (!target) return { section: 'list' as const, toast: '暂时无法定位到这次训练，已打开历史列表。' };
  return {
    section: 'list' as const,
    sessionId: target.id,
    date: getSessionCalendarDate(target),
    toast: '已打开相关训练。',
  };
};

const assertSummaryExplanationAlignment = (session: TrainingSession) => {
  const summary = buildSessionDetailSummary(session);
  const explanation = buildEffectiveSetExplanation(session);
  const completedNotCounted = summary.completedWorkingSets - summary.effectiveSets;
  const explainedCompletedExclusions = explanation.excludedSets.filter((item) => completedWorkingExclusionReasons.has(item.reasonCode)).length;

  expect(explanation.countedEffectiveSets).toBe(summary.effectiveSets);
  expect(explanation.completedWorkingSets).toBe(summary.completedWorkingSets);
  expect(explainedCompletedExclusions).toBeGreaterThanOrEqual(completedNotCounted);
  return { summary, explanation };
};

describe('training record trust final regression', () => {
  it('keeps Record calendar, history list, and detail selection on the same sanitized session/date source', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const rawHistory = data.history;
    const selectedSession = firstSession(data, 'fixture-assisted-valid');
    const selectedDateKey = resolveCalendarSelectedDate(rawHistory, '2026-05', getSessionCalendarDate(selectedSession), '2026-05-07');
    const calendarDay = buildTrainingCalendar(rawHistory, '2026-05', { includeDataFlags: 'all' })
      .days.find((day) => day.date === selectedDateKey);
    const historyList = listSessionHistory(rawHistory);

    expect(rawHistory).toHaveLength(2);
    expect(getSessionCalendarDate(selectedSession)).toBe('2026-05-02');
    expect(calendarDay?.sessions.map((session) => session.sessionId)).toContain('fixture-assisted-valid');
    expect(historyList.map((session) => session.id)).toContain('fixture-assisted-valid');
    expect(selectedSession.id).toBe('fixture-assisted-valid');
    expect(buildSessionDetailSummary(selectedSession).completedWorkingSets).toBe(1);
  });

  it('aligns Summary and EffectiveSetExplanation for done=false, warmup, identityInvalid, and test/excluded records', () => {
    const draftData = buildAppDataFromFixture('incomplete-draft-sets-session');
    const draftSession = {
      ...draftData.history[0],
      focusWarmupSetLogs: [warmupSet()],
    };
    const draft = assertSummaryExplanationAlignment(draftSession);

    expect(draft.summary).toMatchObject({
      completedWorkingSets: 1,
      incompleteSets: 1,
      warmupSets: 1,
    });
    expect(draft.explanation.excludedSets).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: 'incomplete', reason: '该组未完成，不计入有效组。' }),
      expect.objectContaining({ reasonCode: 'warmup', reason: '热身组不计入有效组。' }),
    ]));

    const assistedData = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const invalid = assertSummaryExplanationAlignment(firstSession(assistedData, 'fixture-assisted-legacy-invalid'));
    expect(invalid.summary.identityIssueCount).toBeGreaterThan(0);
    expect(invalid.explanation.excludedSets).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: 'identity_invalid', reason: '动作身份需要检查，暂不进入有效组统计。' }),
    ]));

    const excludedSession = { ...draftData.history[0], dataFlag: 'test' as const };
    const excluded = assertSummaryExplanationAlignment(excludedSession);
    expect(excluded.summary.excludedFromStats).toBe(true);
    expect(excluded.explanation.excludedSets).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: 'test_or_excluded', reason: '该训练被标记为测试或排除，不参与默认统计。' }),
    ]));

    const visibleText = [
      draft.explanation.summary,
      ...draft.explanation.excludedSets.map((item) => `${item.exerciseName} ${item.reason}`),
      ...invalid.explanation.excludedSets.map((item) => `${item.exerciseName} ${item.reason}`),
      ...excluded.explanation.excludedSets.map((item) => `${item.exerciseName} ${item.reason}`),
    ].join('\n');
    expect(visibleText).not.toMatch(forbiddenVisibleText);
  });

  it('keeps legacy fixture statistics attributed to real set logs and actual exercise identity', () => {
    const assistedData = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const unitData = buildAppDataFromFixture('legacy-unit-display');
    const assistedValid = firstSession(assistedData, 'fixture-assisted-valid');
    const unitActual = firstSession(unitData, 'fixture-unit-actual-source');

    expect(buildPrs(assistedData.history).map((item) => item.exerciseId)).toContain('assisted-pull-up');
    expect(buildE1RMProfile(assistedData.history, 'lat-pulldown').best).toBeUndefined();
    expect(buildEffectiveVolumeSummary(assistedData.history).byMuscle.back?.completedSets).toBe(1);
    expect(buildSessionDetailSummary(unitActual, unitData.unitSettings)).toMatchObject({
      completedWorkingSets: 1,
      workingVolumeKg: 526,
    });
    expect(formatExerciseName(assistedValid.exercises[0].actualExerciseId)).toBe('辅助引体向上');
  });

  it('tracks edit audit with real session edit helpers and blocks no-op success semantics', () => {
    const data = buildAppDataFromFixture('incomplete-draft-sets-session');
    const original = firstSession(data, 'fixture-incomplete-draft');
    const editedWorking = updateSessionSet(original, 'bench-press', 'bench-press-1', { weightKg: 90, reps: 7 });
    const savedWorking = saveLikeRecord(original, editedWorking);

    expect(savedWorking.changed).toBe(true);
    expect(savedWorking.toast).toBe('已保存修正，相关统计会重新计算。');
    expect(buildSessionDetailSummary(savedWorking.session).workingVolumeKg).toBe(630);
    expect(savedWorking.session.editHistory?.at(-1)?.affectedStats).toEqual(expect.arrayContaining<SessionEditAffectedStat>(['volume', 'effectiveSet', 'PR', 'e1RM']));

    const beforeWarmup = { ...original, focusWarmupSetLogs: [warmupSet()] };
    const afterWarmup = { ...beforeWarmup, focusWarmupSetLogs: [warmupSet({ actualWeightKg: 45, weight: 45 })] };
    const savedWarmup = saveLikeRecord(beforeWarmup, afterWarmup);
    expect(savedWarmup.changed).toBe(true);
    expect(savedWarmup.toast).toBe('已更新热身组，不影响 PR、e1RM 和有效组。');
    expect(savedWarmup.session.editHistory?.at(-1)?.affectedStats).toEqual(['none']);
    expect(buildEffectiveVolumeSummary([savedWarmup.session]).effectiveSets).toBe(buildEffectiveVolumeSummary([beforeWarmup]).effectiveSets);

    const noOp = saveLikeRecord(original, { ...original });
    expect(noOp.changed).toBe(false);
    expect(noOp.toast).toBe('没有需要保存的修改。');
    expect(noOp.session.editHistory || []).toEqual(original.editHistory || []);
  });

  it('synchronizes calendar markers and analytics through delete and dataFlag mutations', () => {
    const base = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const sameDay = {
      ...firstSession(base, 'fixture-assisted-valid'),
      id: 'fixture-assisted-valid-copy',
    };
    const data = { ...base, history: [...base.history, sameDay] };

    const oneDeleted = deleteTrainingSession(data, 'fixture-assisted-valid', true);
    expect(oneDeleted.data.history).toHaveLength(2);
    expect(buildTrainingCalendar(oneDeleted.data.history, '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-02')?.sessions.map((item) => item.sessionId)).toEqual(['fixture-assisted-valid-copy']);

    const lastDeleted = deleteTrainingSession(oneDeleted.data, 'fixture-assisted-valid-copy', true);
    expect(buildTrainingCalendar(lastDeleted.data.history, '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-02')?.sessions).toEqual([]);
    expect(resolveCalendarSelectedDate(lastDeleted.data.history, '2026-05', '2026-05-02', '2026-05-07')).toBe('2026-05-02');

    const asTest = markSessionDataFlag(base, 'fixture-assisted-valid', 'test');
    expect(asTest.session?.dataFlag).toBe('test');
    expect(filterAnalyticsHistory(asTest.data.history).map((session) => session.id)).not.toContain('fixture-assisted-valid');
    expect(buildSessionDetailSummary(asTest.session!).excludedFromStats).toBe(true);
    expect(buildTrainingCalendar(asTest.data.history, '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-02')?.sessions[0]).toMatchObject({ dataFlag: 'test' });

    const asExcluded = markSessionDataFlag(asTest.data, 'fixture-assisted-valid', 'excluded');
    expect(asExcluded.session?.dataFlag).toBe('excluded');
    expect(buildSessionDetailSummary(asExcluded.session!).excludedFromStats).toBe(true);

    const restored = markSessionDataFlag(asExcluded.data, 'fixture-assisted-valid', 'normal');
    expect(restored.session?.dataFlag).toBe('normal');
    expect(filterAnalyticsHistory(restored.data.history).map((session) => session.id)).toContain('fixture-assisted-valid');
    expect(buildSessionDetailSummary(restored.session!).excludedFromStats).toBe(false);
  });

  it('keeps DataHealth actions aligned with Record detail routing, fallback, and dismiss scope', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const report = buildDataHealthReport(data);
    const viewModel = buildDataHealthViewModel(report, { currentDate: '2026-05-04' });
    const identityIssue = viewModel.primaryIssues.find((issue) => issue.title === '动作记录身份需要检查');
    const route = resolveDataHealthRecordAction(data.history, identityIssue?.action);

    expect(identityIssue?.action).toMatchObject({
      type: 'open_session_detail',
      targetId: 'fixture-assisted-legacy-invalid',
    });
    expect(route).toMatchObject({
      section: 'list',
      sessionId: 'fixture-assisted-legacy-invalid',
      date: '2026-05-01',
    });
    expect(resolveDataHealthRecordAction([], identityIssue?.action)).toEqual({
      section: 'list',
      toast: '暂时无法定位到这次训练，已打开历史列表。',
    });

    const dismissed = [dismissDataHealthIssueToday(identityIssue!.id, '2026-05-04T10:00:00.000Z')];
    expect(buildDataHealthViewModel(report, { currentDate: '2026-05-04', dismissedIssues: dismissed }).primaryIssues.find((issue) => issue.id === identityIssue?.id)).toBeUndefined();
    expect(buildDataHealthViewModel(report, { currentDate: '2026-05-05', dismissedIssues: dismissed }).primaryIssues.find((issue) => issue.id === identityIssue?.id)).toBeDefined();

    const defaultText = [identityIssue?.title, identityIssue?.userMessage, identityIssue?.action?.label].join('\n');
    expect(defaultText).toContain('不会把它用于 PR、e1RM 或有效组');
    expect(defaultText).not.toMatch(forbiddenVisibleText);
  });

  it('aligns DataHealth summary mismatch and incomplete draft issues with Record explanations', () => {
    const draftData = buildAppDataFromFixture('incomplete-draft-sets-session');
    const staleSession = {
      ...draftData.history[0],
      completedSets: 99,
      effectiveSets: 99,
      totalVolumeKg: 99999,
    } as TrainingSession & Record<string, unknown>;
    const report = buildDataHealthReport({ ...draftData, history: [staleSession] });
    const viewModel = buildDataHealthViewModel(report, { currentDate: '2026-05-04' });
    const summary = buildSessionDetailSummary(staleSession);
    const explanation = buildEffectiveSetExplanation(staleSession);
    const text = [
      viewModel.primaryIssues.map((issue) => `${issue.title} ${issue.userMessage}`).join('\n'),
      `未完成组 ${summary.incompleteSets}`,
      explanation.excludedSets.map((item) => item.reason).join('\n'),
    ].join('\n');

    expect(report.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      'summary-completed-mismatch-fixture-incomplete-draft',
      'summary-volume-mismatch-fixture-incomplete-draft',
      'summary-effective-mismatch-fixture-incomplete-draft',
      'incomplete-draft-set-fixture-incomplete-draft-incline-db-press-draft-1',
    ]));
    expect(summary.completedWorkingSets).toBe(1);
    expect(summary.incompleteSets).toBe(1);
    expect(explanation.excludedSets).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: 'incomplete', reason: '该组未完成，不计入有效组。' }),
    ]));
    expect(text).not.toMatch(forbiddenVisibleText);
  });

  it('keeps stale Today status and duplicate Plan drafts from changing Record history truth', () => {
    const recordData = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const sorenessData = buildAppDataFromFixture('stale-today-soreness');
    const planData = buildAppDataFromFixture('duplicate-plan-draft');
    const combined = {
      ...recordData,
      todayStatus: sorenessData.todayStatus,
      programAdjustmentDrafts: planData.programAdjustmentDrafts,
      programAdjustmentHistory: planData.programAdjustmentHistory,
    };

    expect(combined.history.map((session) => session.id)).toEqual(recordData.history.map((session) => session.id));
    expect(buildTrainingCalendar(combined.history, '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-02')?.sessions.map((item) => item.sessionId)).toEqual(['fixture-assisted-valid']);
    expect(buildSessionDetailSummary(firstSession(combined, 'fixture-assisted-valid')).completedWorkingSets).toBe(1);
    expect((combined.programAdjustmentDrafts || []).map((draft) => draft.sourceFingerprint).filter(Boolean).length).toBeGreaterThan(0);
  });
});
