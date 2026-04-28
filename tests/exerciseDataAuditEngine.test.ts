import { describe, expect, it } from 'vitest';
import { INITIAL_TEMPLATES, mapLegacyAlternativeLabelsToIds } from '../src/data/trainingData';
import { auditExerciseLibrary } from '../src/engines/exerciseDataAuditEngine';
import { hydrateTemplates } from '../src/engines/engineUtils';
import type { ExerciseTemplate } from '../src/models/training-model';

describe('exerciseDataAuditEngine', () => {
  const exercises = hydrateTemplates(INITIAL_TEMPLATES).flatMap((template) => template.exercises);

  it('passes the active default exercise library without relationship errors', () => {
    const report = auditExerciseLibrary();

    expect(report.errors).toEqual([]);
  });

  it('maps legacy Chinese alternative labels to stable exercise ids', () => {
    const mapped = mapLegacyAlternativeLabelsToIds(['器械推胸', '哑铃卧推', '不存在动作']);

    expect(mapped.ids).toContain('machine-chest-press');
    expect(mapped.ids).toContain('db-bench-press');
    expect(mapped.warnings[0]).toContain('无法映射');
  });

  it('detects duplicate ids and invalid relationship ids in custom data', () => {
    const [bench] = exercises;
    const broken = [
      bench,
      { ...bench },
      {
        ...bench,
        id: 'custom-broken',
        name: '坏动作',
        alias: '坏动作',
        alternativeIds: ['missing-exercise'],
        progressionIds: ['close-grip-bench'],
      } as ExerciseTemplate,
    ];
    const report = auditExerciseLibrary(broken);

    expect(report.errors.some((item) => item.includes('动作 ID 重复'))).toBe(true);
    expect(report.errors.some((item) => item.includes('missing-exercise'))).toBe(true);
  });

  it('keeps equivalence chain members and progression references resolvable', () => {
    const report = auditExerciseLibrary(exercises);

    expect(report.errors.some((item) => item.includes('close-grip-bench'))).toBe(false);
    expect(report.errors.some((item) => item.includes('member 不存在'))).toBe(false);
  });
});
