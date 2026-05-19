import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = resolve(process.cwd(), 'docs/UI_OS_R8_5_FOCUS_TRAINING_DETAIL_DARK_SURFACE_FIX.md');

describe('UI-OS R8.5 docs', () => {
  it('records the Focus and Training Detail dark surface acceptance fix', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    for (const phrase of [
      'UI-OS R8.5',
      'Focus & Training Detail Dark Surface Acceptance Fix V1',
      'ccb7ddff25276bfdb7e1ab651819e7c73b714504',
      'Focus still exposed a white bottom area',
      '切换动作',
      '推荐依据',
      'Training Detail',
      'duplicate',
      'EquipmentAwareLoadCard',
      'No training algorithm change',
      'R9 archive remains postponed',
      'R9 is not started',
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});
