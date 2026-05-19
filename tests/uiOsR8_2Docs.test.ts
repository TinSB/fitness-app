import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R8_2_GLOBAL_LEGACY_SURFACE_DENSITY_SWEEP.md';

describe('UI-OS R8.2 docs', () => {
  it('documents the global surface and density sweep', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'UI-OS R8.2',
      'PR #289',
      '035215637a396de83849c24097a33de7109b32fb',
      '1164 files / 4737 tests',
      'Global Audit Inventory',
      'white-card',
      'theme parity',
      'Duplicate Deletion Rules',
      'Today owns the daily decision',
      'Settings owns safety',
      'UI-OS R9 Archive is recommended next and is not started',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
