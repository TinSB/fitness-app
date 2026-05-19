import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R3_TODAY_DECISION_SURFACE_REWRITE.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R3 Today decision docs', () => {
  it('exists and records baseline evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('UI-OS R3');
    expect(doc).toContain('Today Decision Surface Rewrite V1');
    expect(doc).toContain('PR #282');
    expect(doc).toContain('d3711d59ea320109d0e683e1fd77f3175a7a6c54');
    expect(doc).toContain('1125 files / 4586 tests');
    expect(doc).toContain('dist token scan clean');
    expect(doc).toContain('R2 completed the Focus Mode interaction state machine');
  });

  it('documents the required decision states and hierarchy', () => {
    for (const expected of [
      'train_recommended',
      'train_conservative',
      'recovery_recommended',
      'continue_unfinished',
      'blocked_by_severe_risk',
      'source_unclear',
      'no_plan_available',
      'Decision hero',
      'Primary start/continue action',
      'Readiness/fatigue summary',
      'Medium-priority focus override',
      'Severe risk only',
      'Safety strip',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents non-goals and next task', () => {
    for (const expected of [
      'No training algorithm change',
      'No rotation/planning logic change',
      'No source-of-truth change',
      'No persistence change',
      'No cloud sync',
      'No route change',
      'No package dependency change',
      'No History/Progress/Settings rewrite',
      'UI-OS R4 — History Calendar & PR/e1RM Rewrite V1',
      'UI-OS R4 is not started by R3',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
