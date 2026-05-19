import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docPath = 'docs/UI_OS_R8_4_MOBILE_CHROME_GAP_MICROCOPY_DELETION.md';

describe('UI-OS R8.4 docs', () => {
  it('documents the mobile chrome gap and microcopy deletion fix', () => {
    expect(existsSync(resolve(root, docPath))).toBe(true);
    const doc = readFileSync(resolve(root, docPath), 'utf8');

    expect(doc).toContain('UI-OS R8.4');
    expect(doc).toContain('Mobile Chrome Gap & Microcopy Deletion');
    expect(doc).toContain('bottom white strip');
    expect(doc).toContain('mobile viewport background');
    expect(doc).toContain('global microcopy deletion');
    expect(doc).toContain('Primary-Flow Copy Budget');
    expect(doc).toContain('Details Ownership');
    expect(doc).toContain('No training algorithm change');
    expect(doc).toContain('No source-of-truth or persistence change');
    expect(doc).toContain('UI-OS R9 is not started by R8.4');
  });
});
