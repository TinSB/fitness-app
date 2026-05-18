import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 17 equipment aware load model archive', () => {
  const archive = () => readSource('docs/PHASE17_EQUIPMENT_AWARE_LOAD_MODEL_ARCHIVE.md');

  it('archives Tasks 17A through 17F with PR and merge evidence', () => {
    const content = archive();

    for (const expected of [
      'Task 17G',
      'Phase 17 Equipment-Aware Load Model Archive',
      'Phase 17 is complete',
      'Task 17A',
      'PR #263',
      '0cb0021c0444afeeedda8b2be902a319fe3e6f17',
      'entry gate complete',
      'Task 17B',
      'PR #264',
      '0c1e1a6a06f520089e04d7d8fc19be86b2205e12',
      'feasible load engine complete',
      'Task 17C',
      'PR #265',
      '9253382ec4bf9e02ad90a63406c5d9874c624053',
      'exercise equipment defaults complete',
      'Task 17D',
      'PR #266',
      'b6542bc2f51bd7ad448bff1fb3fb161234ae6256',
      'recommendation display helper/component complete',
      'Task 17E',
      'PR #267',
      'b4d3b6754b390677923e959ae5e9a6b10777bf24',
      'training UI integration complete where safe',
      'Task 17F',
      'PR #268',
      '3e2784eee783184feeccca2fb747c8e6f8b03f38',
      'equipment profile editing UX complete as presentational draft UX',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms equipment-aware Phase 17 outcomes', () => {
    const content = archive();

    for (const expected of [
      'equipment-aware load model complete',
      'feasible load engine complete',
      'exercise equipment defaults exist',
      'recommendation display helper/component complete',
      'live display integration exists where safely integrated',
      'equipment profile editing UX exists as presentational draft UX',
      'Bench 17 lb warmup now has an equipment-aware display path to empty 45 lb Olympic bar',
      'barbell total + per-side plates supported',
      'Smith 25 lb default supported',
      'dumbbell per-hand supported',
      'selectorized machine stack supported',
      'plate-loaded optional base/sled warning supported',
      'unknown/custom fallback supported',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Phase 18 and Task 18A only without starting them', () => {
    const content = archive();

    expect(content).toContain('Phase 18 — Real-Use Equipment Feedback & Training Flow Refinement');
    expect(content).toContain('Task 18A — Equipment-Aware Real-Use Feedback Intake V1');
    expect(content).toContain('Phase 18 is recommended only.');
    expect(content).toContain('Task 18A is not started.');
    expect(content).toContain('Phase 17 archive does not authorize SaaS.');
    expect(content).toContain('Phase 17 archive does not authorize default cloud sync.');
  });
});
