import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI-OS R8 docs', () => {
  it('documents the information density and theme parity remediation', () => {
    const path = 'docs/UI_OS_R8_INFORMATION_DENSITY_THEME_PARITY_REMEDIATION.md';
    expect(existsSync(path)).toBe(true);
    const doc = readFileSync(path, 'utf8');

    for (const expected of [
      'UI-OS R8',
      'Information Density Reduction & Theme Parity Remediation V1',
      'archive is postponed',
      'PR: #287',
      'b60b2a65ff72b6dc8ced63d379b8491b4a8d4f3b',
      '1153 files / 4701 tests',
      'dist token scan clean',
      'information density',
      'theme parity',
      'Duplicate information',
      'Today first screen',
      '切换目标',
      'Bottom nav hides on downward scroll',
      'Dark theme forbids large uncontrolled white cards',
      'UI-OS R9 — Interaction OS Remediation Archive V1',
      'UI-OS R9 is not started by R8',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
