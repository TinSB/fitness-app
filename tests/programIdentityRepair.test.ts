import { describe, expect, it } from 'vitest';
import { analyzeImportedAppData, repairImportedAppData } from '../src/engines/dataRepairEngine';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { makeAppData, getTemplate } from './fixtures';

const draft = (id: string, status: ProgramAdjustmentDraft['status'] = 'ready_to_apply'): ProgramAdjustmentDraft => ({
  id,
  createdAt: '2026-04-30T00:00:00.000Z',
  status,
  sourceProgramTemplateId: 'program-hypertrophy-support',
  sourceTemplateId: 'pull-a',
  sourceRecommendationId: 'volume-back',
  title: '拉 A 下周实验调整',
  summary: '背部训练量建议',
  selectedRecommendationIds: ['volume-back'],
  changes: [
    {
      id: `${id}-change`,
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      exerciseId: 'seated-row',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部低于目标',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  notes: [],
});

describe('program identity and draft repair', () => {
  it('reports activeProgramTemplateId pointing at a day template without migrating it', () => {
    const data = makeAppData({ activeProgramTemplateId: 'pull-a' });

    const report = analyzeImportedAppData(data);
    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });

    expect(report.issues.some((issue) => issue.id === 'template.active_day_id')).toBe(true);
    expect(result.repairedData.activeProgramTemplateId).toBe('pull-a');
  });

  it('removes missing template references but only records duplicate drafts', () => {
    const pull = getTemplate('pull-a');
    const data = makeAppData({
      templates: [
        {
          ...pull,
          exercises: [
            {
              ...pull.exercises[0],
              alternativeIds: ['seated-row', 'missing-alt'],
              regressionIds: ['missing-regression'],
              progressionIds: ['barbell-row', 'missing-progression'],
            },
          ],
        },
      ],
      programAdjustmentDrafts: [draft('draft-1'), draft('draft-2')],
    });

    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });
    const exercise = result.repairedData.templates[0]?.exercises[0];

    expect(exercise?.alternativeIds).not.toContain('missing-alt');
    expect(exercise?.regressionIds).not.toContain('missing-regression');
    expect(exercise?.progressionIds).not.toContain('missing-progression');
    expect(result.repairedData.programAdjustmentDrafts).toHaveLength(2);
    expect(result.repairedData.programAdjustmentDrafts?.every((item) => item.sourceFingerprint)).toBe(true);
    expect(result.repairLog.some((entry) => entry.action.includes('重复调整草案'))).toBe(true);
  });
});
