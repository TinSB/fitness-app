import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docPath = resolve(root, 'docs/UI_OS_INTERACTION_REMEDIATION_ARCHIVE.md');

describe('UI-OS Interaction remediation archive', () => {
  it('exists and archives the remediation sequence from R0 through R9', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('UI-OS R9');
    expect(doc).toContain('Interaction OS Remediation Archive V1');
    expect(doc).toContain('technically complete but did not pass product acceptance');

    for (const step of [
      'R0: v0 design system extraction',
      'R1: product specification',
      'R2: Focus state machine',
      'R3: Today decision surface',
      'R4: History calendar',
      'R5: Progress and Data Health',
      'R6: Settings, Safety, Theme',
      'R7: mobile safe-area',
      'R8: information density',
      'R8.1: mobile Today safe-area',
      'R8.2: global legacy surface',
      'R8.3: training density',
      'R8.4: mobile chrome gap',
      'R8.5: Focus and Training Detail',
      'R8.6: Focus final interaction',
      'R8.7A: actionable load contract',
      'R8.7B: practical warmup policy refinement',
      'R8.7C: one-layer sheet interaction standard',
      'R8.7D: Focus More menu',
      'R8.7E: Focus final acceptance regression lock',
    ]) {
      expect(doc).toContain(step);
    }
  });

  it('records final completion, preserved boundaries, and the next recommended task', () => {
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('Interaction OS remediation is complete through R9');
    expect(doc).toContain('Source-of-truth behavior unchanged');
    expect(doc).toContain('Persistence behavior unchanged');
    expect(doc).toContain('AppData schema unchanged');
    expect(doc).toContain('No routes added');
    expect(doc).toContain('No cloud sync');
    expect(doc).toContain('No package, package script, or lockfile drift');
    expect(doc).toContain('pnpm-lock.yaml remains absent');
    expect(doc).toContain('Personal-only remains active');
    expect(doc).toContain('SaaS and multi-user runtime remain deferred');
    expect(doc).toContain('UI-OS 10A — Real Gym Use Acceptance & Bug Intake V1');
    expect(doc).toContain('UI-OS 10A is recommended next but is not started by R9');
  });
});
