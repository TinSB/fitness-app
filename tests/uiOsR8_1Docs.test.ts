import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R8_1_MOBILE_TODAY_SAFE_AREA_DENSITY_FIX.md';

describe('UI-OS R8.1 docs', () => {
  it('documents the mobile Today safe-area and density acceptance fix', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('UI-OS R8.1');
    expect(doc).toContain('PR #288');
    expect(doc).toContain('790872f215d77b63206aa8081f5cb4298dec2295');
    expect(doc).toContain('bottom nav overlapped');
    expect(doc).toContain('Today density');
    expect(doc).toContain('local-first safety copy');
    expect(doc).toContain('Normal recovery / fatigue is a compact badge row only');
    expect(doc).toContain('collapsed `为什么这样推荐？`');
    expect(doc).toContain('does not change');
    expect(doc).toContain('UI-OS R9');
    expect(doc).toContain('not started');
  });
});
