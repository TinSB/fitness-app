import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionCompletedSets, sessionVolume } from '../src/engines/engineUtils';
import { applyExerciseReplacement, buildReplacementOptions } from '../src/engines/replacementEngine';
import { getNextTemplateAfterLastCompletedSession, pickSuggestedTemplate } from '../src/engines/sessionBuilder';
import { markSessionEdited, updateSessionSet, validateSessionEdit } from '../src/engines/sessionEditEngine';
import { formatTrainingVolume, parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession, templates } from './fixtures';

describe('real world regressions from 2026-04-28', () => {
  it('does not suggest Legs A again immediately after a normal completed Legs A session', () => {
    const legsSession = makeSession({
      id: 'legs-done',
      date: '2026-04-28',
      templateId: 'legs-a',
      exerciseId: 'squat',
      setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });
    const data = makeAppData({ history: [legsSession], templates, selectedTemplateId: 'legs-a' });

    expect(getNextTemplateAfterLastCompletedSession(data.history, templates)).toBe('push-a');
    expect(pickSuggestedTemplate(data)).not.toBe('legs-a');
  });

  it('ignores test and excluded sessions when calculating the next template', () => {
    const normalPush = makeSession({
      id: 'push-real',
      date: '2026-04-26',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
    });
    const testLegs = { ...normalPush, id: 'legs-test', templateId: 'legs-a', dataFlag: 'test' as const };
    const excludedLegs = { ...normalPush, id: 'legs-excluded', templateId: 'legs-a', dataFlag: 'excluded' as const };

    expect(getNextTemplateAfterLastCompletedSession([testLegs, excludedLegs, normalPush], templates)).toBe('pull-a');
  });

  it('keeps Focus Mode replacement action visible and bottom-sheet backed', () => {
    const focusSource = readFileSync(resolve(process.cwd(), 'src/features/TrainingFocusView.tsx'), 'utf8');

    expect(focusSource).toContain('替代动作');
    expect(focusSource).toContain('onClick={openReplacementPicker}');
    expect(focusSource).toContain('setShowReplacementPicker(true)');
    expect(focusSource).toContain('<BottomSheet open={showReplacementPicker}');
    expect(focusSource).not.toContain('__auto_alt');
  });

  it('opens real replacement options for squat and never synthetic ids', () => {
    const squat = templates.find((template) => template.id === 'legs-a')?.exercises.find((exercise) => exercise.id === 'squat') as ExercisePrescription;
    const ids = buildReplacementOptions(squat).map((option) => option.id);

    expect(ids).toEqual(expect.arrayContaining(['hack-squat', 'leg-press']));
    expect(ids.some((id) => id.includes('__auto_alt'))).toBe(false);

    const session: TrainingSession = {
      id: 'replace-squat',
      date: '2026-04-28',
      templateId: 'legs-a',
      templateName: '腿 A',
      trainingMode: 'hybrid',
      exercises: [squat],
    };
    const replaced = applyExerciseReplacement(session, 0, 'leg-press');
    expect(replaced.exercises[0].actualExerciseId).toBe('leg-press');
    expect(replaced.exercises[0].originalExerciseId).toBe('squat');
  });

  it('keeps session summary metrics consistent with recorded working sets', () => {
    const session = makeSession({
      id: 'summary-real',
      date: '2026-04-28',
      templateId: 'legs-a',
      exerciseId: 'squat',
      setSpecs: [
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      ],
    });
    session.exercises[0].sets = session.exercises[0].sets.map((set) => ({ ...set, actualWeightKg: set.weight }));

    expect(sessionCompletedSets(session)).toBe(3);
    expect(sessionVolume(session)).toBe(1500);
    expect(formatTrainingVolume(sessionVolume(session), { weightUnit: 'lb' })).toBe('3307lb');
    expect(buildEffectiveVolumeSummary([session]).completedSets).toBe(3);
  });

  it('allows editing a historical set without changing the template structure', () => {
    const session = makeSession({
      id: 'edit-real',
      date: '2026-04-28',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    const weightKg = parseDisplayWeightToKg(155, 'lb');
    const edited = markSessionEdited(
      updateSessionSet(session, 'bench-press', 'bench-press-1', {
        weightKg,
        displayWeight: 155,
        displayUnit: 'lb',
        reps: 6,
        rir: 3,
        techniqueQuality: 'poor',
        painFlag: true,
        note: '修正输入错误',
      }),
      ['sets'],
    );

    expect(validateSessionEdit(edited).valid).toBe(true);
    expect(edited.exercises[0].sets[0].actualWeightKg).toBeCloseTo(weightKg);
    expect(edited.exercises[0].sets[0].displayWeight).toBe(155);
    expect(edited.exercises[0].sets[0].reps).toBe(6);
    expect(edited.exercises[0].sets[0].techniqueQuality).toBe('poor');
    expect(edited.exercises[0].sets[0].painFlag).toBe(true);
    expect(edited.editHistory?.length).toBe(1);
    expect(buildE1RMProfile([edited], 'bench-press').best?.confidence).not.toBe('high');
  });

  it('keeps mobile detail headers safe-area aware', () => {
    const drawerSource = readFileSync(resolve(process.cwd(), 'src/ui/Drawer.tsx'), 'utf8');
    const sheetSource = readFileSync(resolve(process.cwd(), 'src/ui/BottomSheet.tsx'), 'utf8');
    const safeHeaderSource = readFileSync(resolve(process.cwd(), 'src/ui/SafeAreaHeader.tsx'), 'utf8');

    expect(drawerSource).toContain('SafeAreaHeader');
    expect(sheetSource).toContain('SafeAreaHeader');
    expect(safeHeaderSource).toContain('env(safe-area-inset-top)');
    expect(safeHeaderSource).toContain('aria-label={closeLabel}');
  });
});
