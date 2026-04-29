import { describe, expect, it } from 'vitest';
import { buildTemplateBodyPartConflictScore } from '../src/engines/recoveryAwareScheduler';
import { getTemplate } from './fixtures';

const shoulder = '\u80a9\u90e8';
const chest = '\u80f8\u90e8';
const back = '\u80cc\u90e8';
const leg = '\u817f\u90e8';

describe('template body part conflict scoring', () => {
  it('rates shoulder soreness against Upper as moderate or high', () => {
    const conflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('upper'),
      sorenessAreas: [shoulder],
    });

    expect(['moderate', 'high']).toContain(conflict.level);
    expect(conflict.affectedAreas).toContain(shoulder);
    expect(conflict.conflictingExercises.length).toBeGreaterThan(0);
  });

  it('rates shoulder soreness against Legs A as low or none', () => {
    const conflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('legs-a'),
      sorenessAreas: [shoulder],
    });

    expect(['none', 'low']).toContain(conflict.level);
  });

  it('rates leg soreness against Legs A as high', () => {
    const conflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('legs-a'),
      sorenessAreas: [leg],
    });

    expect(conflict.level).toBe('high');
  });

  it('rates chest soreness against Push A as high', () => {
    const conflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('push-a'),
      sorenessAreas: [chest],
    });

    expect(conflict.level).toBe('high');
  });

  it('rates back soreness against Pull A as high', () => {
    const conflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('pull-a'),
      sorenessAreas: [back],
    });

    expect(conflict.level).toBe('high');
  });

  it('weights pain higher than soreness', () => {
    const sorenessConflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('push-a'),
      sorenessAreas: [chest],
    });
    const painConflict = buildTemplateBodyPartConflictScore({
      template: getTemplate('push-a'),
      painAreas: [chest],
    });

    expect(painConflict.score).toBeGreaterThan(sorenessConflict.score);
  });
});
