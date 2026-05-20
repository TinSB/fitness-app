import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R9_1_BOTTOM_NAV_CHROME_REAL_LIGHT_THEME_HOTFIX.md';
const parityDocPath = 'docs/UI_OS_R9_1_REAL_LIGHT_THEME_SURFACE_PARITY_HOTFIX.md';

describe('UI-OS R9.1 docs', () => {
  it('documents the bottom nav chrome and real light theme hotfix', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'UI-OS R9.1',
      'Bottom Nav Chrome & Real Light Theme Hotfix V1',
      'large black bottom dead zone',
      'Light / dark selector',
      'Bottom nav now uses a native safe-area offset',
      'Light / dark / system theme',
      'ironpath:ui-theme',
      'No training algorithm change',
      'No source-of-truth change',
      'No AppData schema change',
      'No route, cloud, package, script, or lockfile change',
      'UI-OS 10A - Real Gym Use Acceptance & Bug Intake V1',
      'UI-OS 10A is not started by R9.1',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents the real light theme surface parity hotfix', () => {
    expect(existsSync(parityDocPath)).toBe(true);
    const doc = readFileSync(parityDocPath, 'utf8');

    for (const required of [
      'UI-OS R9.1',
      'Real Light Theme Surface Parity Hotfix V1',
      'light theme only changed the outer background',
      'Light shell with dark Training cards',
      'Training Detail and Record Detail surfaces',
      'input_surface',
      'action_surface',
      'record_detail_surface',
      'training_detail_surface',
      'Focus remains an explicit immersive dark exception',
      'No training algorithm change',
      'No source-of-truth behavior change',
      'No route, cloud, package, script, or lockfile change',
      'UI-OS 10A - Real Gym Use Acceptance & Bug Intake V1',
      'UI-OS 10A is recommended but not started by R9.1',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
