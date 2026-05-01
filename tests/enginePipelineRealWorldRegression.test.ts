import { describe, expect, it } from 'vitest';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { buildFocusStepQueue } from '../src/engines/focusModeStateEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { updateSessionSet } from '../src/engines/sessionEditEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const exerciseForTemplate: Record<string, string> = {
  'push-a': 'bench-press',
  'pull-a': 'lat-pulldown',
  'legs-a': 'squat',
};

const completedSession = (templateId: string, date: string) => ({
  ...makeSession({
    id: `${templateId}-${date}`,
    date,
    templateId,
    exerciseId: exerciseForTemplate[templateId],
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: `${date}T10:00:00-04:00`,
});

const buildPullSession = () => {
  const data = makeAppData();
  return createSession(
    getTemplate('pull-a'),
    data.todayStatus,
    data.history,
    data.trainingMode,
    null,
    null,
    data.screeningProfile,
    data.mesocyclePlan,
  );
};

describe('engine pipeline real world regression', () => {
  it('uses cycle-aware scheduling for out-of-order Push, Legs and Pull history', () => {
    const history = [
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ];
    const pipeline = buildEnginePipeline(makeAppData({ history }), '2026-04-30');

    expect(pipeline.nextWorkout.templateId).toBe('push-a');
    expect(pipeline.nextWorkout.templateId).not.toBe('legs-a');
    expect(pipeline.nextWorkout.reason).toMatch(/[\u4e00-\u9fff]/);
  });

  it('keeps replacement identity stable for the current session', () => {
    const session = createSession(
      getTemplate('push-a'),
      makeAppData().todayStatus,
      [],
      'hybrid',
      null,
      null,
      makeAppData().screeningProfile,
      makeAppData().mesocyclePlan,
    );
    const replaced = applyExerciseReplacement(session, 0, 'db-bench-press');
    const exercise = replaced.exercises[0];

    expect(exercise.originalExerciseId).toBe('bench-press');
    expect(exercise.actualExerciseId).toBe('db-bench-press');
    expect(exercise.replacementExerciseId).toBe('db-bench-press');
    expect(exercise.prIndependent).toBe(true);
  });

  it('keeps Pull A warmup decisions scoped without changing working sets', () => {
    const session = buildPullSession();
    const queue = buildFocusStepQueue(session);
    const latWarmups = queue.filter((step) => step.exerciseId === 'lat-pulldown' && step.stepType === 'warmup');
    const seatedWarmups = queue.filter((step) => step.exerciseId === 'seated-row' && step.stepType === 'warmup');
    const barbellWarmups = queue.filter((step) => step.exerciseId === 'barbell-row' && step.stepType === 'warmup');

    expect(latWarmups[0]?.warmupPolicy?.warmupDecision).toBe('full_warmup');
    expect(seatedWarmups).toHaveLength(0);
    expect(barbellWarmups).toHaveLength(1);
    expect(barbellWarmups[0]?.warmupPolicy?.warmupDecision).toBe('feeder_set');
    for (const exercise of session.exercises) {
      const plannedWorkingSets = Array.isArray(exercise.sets) ? exercise.sets.length : Number(exercise.sets || 0);
      expect(queue.filter((step) => step.exerciseId === exercise.id && step.stepType === 'working')).toHaveLength(
        plannedWorkingSets,
      );
    }
  });

  it('recomputes history summary when a working set is edited', () => {
    const session = makeSession({
      id: 'edit-session',
      date: '2026-04-29',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6 }],
    });
    const before = buildSessionDetailSummary(session);
    const edited = updateSessionSet(session, 'bench-press', 'bench-press-1', { weightKg: 100, reps: 8 });
    const after = buildSessionDetailSummary(edited);

    expect(after.workingVolumeKg).toBeGreaterThan(before.workingVolumeKg);
    expect(session.exercises[0].sets[0].weight).toBe(80);
  });

  it('keeps DataHealth concise by default', () => {
    const report = {
      status: 'has_errors' as const,
      summary: '发现多项数据问题。',
      issues: Array.from({ length: 5 }, (_, index) => ({
        id: `issue-${index}`,
        severity: index === 0 ? ('error' as const) : ('warning' as const),
        category: 'history' as const,
        title: '训练汇总可能过期',
        message: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
        canAutoFix: false,
      })),
    };
    const viewModel = buildDataHealthViewModel(report);

    expect(viewModel.primaryIssues).toHaveLength(3);
    expect(viewModel.secondaryIssues).toHaveLength(2);
  });

  it('does not flag first-time prescription sets but flags manual extreme weight', () => {
    const recommended = detectSetAnomalies({
      exerciseId: 'lat-pulldown',
      recentHistory: [],
      currentDraft: {
        actualWeightKg: 52.5,
        actualReps: 8,
        actualRir: 2,
        setType: 'working',
        source: 'prescription',
      },
      plannedPrescription: { plannedWeightKg: 52.5, plannedReps: 8 },
    });
    const manualExtreme = detectSetAnomalies({
      exerciseId: 'lat-pulldown',
      recentHistory: [],
      currentDraft: {
        actualWeightKg: 140,
        actualReps: 8,
        actualRir: 2,
        setType: 'working',
        source: 'manual',
      },
      plannedPrescription: { plannedWeightKg: 52.5, plannedReps: 8 },
    });

    expect(recommended.some((item) => item.severity === 'critical')).toBe(false);
    expect(manualExtreme.some((item) => item.requiresConfirmation)).toBe(true);
  });
});
