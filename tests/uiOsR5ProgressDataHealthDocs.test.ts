import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R5_PROGRESS_DATA_HEALTH_CLARITY_REWRITE.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R5 Progress Data Health clarity docs', () => {
  it('exists and records R4 baseline evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('UI-OS R5');
    expect(doc).toContain('Progress / Data Health Clarity Rewrite V1');
    expect(doc).toContain('PR #284');
    expect(doc).toContain('c4d1f482effbbb3d6ce41c7ed9ec01f26103af06');
    expect(doc).toContain('1135 files / 4617 tests');
    expect(doc).toContain('dist token scan clean');
    expect(doc).toContain('R4 made History calendar/frequency first');
  });

  it('documents clarity models visual direction and hierarchies', () => {
    for (const expected of [
      'Whoop / Athlytic',
      'Apple Health',
      'progress clarity summary model',
      'data health clarity summary model',
      'Progress insight hero',
      'readiness/recovery pressure',
      'strength trend / PR / e1RM',
      'effective sets / volume',
      'Data Health clarity panel',
      'owner-friendly issue cards',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents non-goals and next task', () => {
    for (const expected of [
      'No PR/e1RM calculation change',
      'No effective-set calculation change',
      'No data health detection change',
      'No data health repair semantics change',
      'No automatic repair',
      'No `POST /data-health/repair/apply`',
      'UI-OS R6 — Settings / Safety / Theme / Equipment Profile Rewrite V1',
      'UI-OS R6 is not started by R5',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
