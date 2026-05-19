import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = resolve(process.cwd(), 'docs/UI_OS_R8_6_FOCUS_FINAL_ACCEPTANCE_PRACTICAL_WARMUP.md');

describe('UI-OS R8.6 docs', () => {
  it('records the final Focus acceptance and practical warmup alignment task', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    for (const phrase of [
      'UI-OS R8.6',
      'Focus Final Acceptance & Practical Warmup Alignment V1',
      '0b65177e6b3c3ae1ac68e69aefc4a36b97517bbf',
      '更多',
      'bottom area',
      'End confirmation',
      '套用建议',
      'planned reps',
      'practical warmup policy',
      'one to three sets',
      'Actionable load',
      'No source-of-truth change',
      'No persistence or AppData schema change',
      'No route, browser mutation route',
      'R9 archive remains postponed',
      'UI-OS R9 is not started by R8.6',
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});
