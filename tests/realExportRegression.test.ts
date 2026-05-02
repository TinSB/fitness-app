import { describe, expect, it } from 'vitest';
import hypertrophyExport from './fixtures/realExports/hypertrophy_user_export.json';
import fatLossHybridExport from './fixtures/realExports/fat_loss_hybrid_user_export.json';
import { buildPrs, buildExerciseTrend } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { formatTrainingVolume, formatWeight } from '../src/engines/unitConversionEngine';
import { auditGoalModeConsistency } from '../src/engines/goalConsistencyEngine';
import { sanitizeData } from '../src/storage/persistence';
import { analyzeImportedAppData, repairImportedAppData } from '../src/engines/dataRepairEngine';

describe('real export regression fixtures', () => {
  it('keeps hypertrophy export unit display stable in lb', () => {
    const data = sanitizeData(hypertrophyExport);
    const set = data.history[0]?.exercises[0]?.sets?.[0];
    if (!set || typeof set === 'number') throw new Error('Missing fixture set');

    expect(data.unitSettings.weightUnit).toBe('lb');
    expect(formatWeight(set.weight, data.unitSettings)).toBe('45lb');
    expect(formatWeight(set.actualWeightKg, data.unitSettings)).toBe('45lb');
    expect(formatTrainingVolume(100, data.unitSettings)).toBe('220lb');
  });

  it('keeps legacy synthetic replacement ids for data repair review instead of silent fallback', () => {
    const report = analyzeImportedAppData(fatLossHybridExport);
    const result = repairImportedAppData(fatLossHybridExport, { repairDate: '2026-05-01', sourceFileName: 'fixture.json' });
    const exercise = result.repairedData.history[0]?.exercises[0];

    expect(report.issues.some((issue) => issue.id === 'replacement.synthetic_id')).toBe(true);
    expect(exercise?.id).toContain('__auto_alt');
    expect(exercise?.actualExerciseId).toBeUndefined();
    expect(exercise?.legacyActualExerciseId).toContain('__auto_alt');
    expect(exercise?.replacementExerciseId).toBeUndefined();
    expect(exercise?.identityInvalid).toBe(true);
  });

  it('keeps fat_loss + hybrid legal and explains hypertrophy-style mesocycle as support work', () => {
    const data = sanitizeData(fatLossHybridExport);
    const audit = auditGoalModeConsistency(data);

    expect(audit.primaryGoal).toBe('fat_loss');
    expect(audit.trainingMode).toBe('hybrid');
    expect(audit.mesocycleGoal).toBe('fat_loss_support');
    expect(audit.isConsistent).toBe(true);
    expect(audit.explanation).toContain('保肌');
  });

  it('keeps replacement PR and e1RM in the actual exercise pool', () => {
    const data = sanitizeData(hypertrophyExport);
    const prs = buildPrs(data.history);

    expect(prs.some((pr) => pr.exerciseId === 'db-bench-press')).toBe(true);
    expect(prs.some((pr) => pr.exerciseId === 'bench-press')).toBe(false);
    expect(buildE1RMProfile(data.history, 'db-bench-press').best).toBeTruthy();
    expect(buildE1RMProfile(data.history, 'bench-press').best).toBeUndefined();
  });

  it('does not include replacement sessions in the original exercise trend', () => {
    const data = sanitizeData(hypertrophyExport);

    expect(buildExerciseTrend(data.history, 'bench-press')).toEqual([]);
    expect(buildExerciseTrend(data.history, 'db-bench-press').length).toBeGreaterThan(0);
  });
});
