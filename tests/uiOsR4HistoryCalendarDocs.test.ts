import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R4_HISTORY_CALENDAR_PR_E1RM_REWRITE.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R4 History calendar docs', () => {
  it('exists and records baseline evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('UI-OS R4');
    expect(doc).toContain('History Calendar & PR/e1RM Rewrite V1');
    expect(doc).toContain('PR #283');
    expect(doc).toContain('5be45f7f978c67a361421ed2ba672c5dfc4857ed');
    expect(doc).toContain('1128 files / 4600 tests');
    expect(doc).toContain('dist token scan clean');
    expect(doc).toContain('R3 converted Today into a decision surface');
  });

  it('documents calendar frequency first and PR/e1RM access', () => {
    for (const expected of [
      'calendar/frequency',
      'which days trained and which days did not',
      'calendar training frequency',
      'PR/e1RM quick access',
      'frequency summary',
      'selected day summary',
      'Recent sessions as secondary',
      'Calm Data Health hint',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents non-goals and next task', () => {
    for (const expected of [
      'No PR/e1RM calculation change',
      'No effective-set calculation change',
      'No history data model change',
      'No persistence change',
      'No source-of-truth change',
      'No route change',
      'No cloud sync',
      'No automatic Data Health repair',
      'No `POST /data-health/repair/apply`',
      'UI-OS R5 — Progress / Data Health Clarity Rewrite V1',
      'UI-OS R5 is not started by R4',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
