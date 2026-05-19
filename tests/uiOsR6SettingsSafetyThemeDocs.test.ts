import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R6_SETTINGS_SAFETY_THEME_EQUIPMENT_PROFILE_REWRITE.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R6 Settings Safety Theme Equipment Profile docs', () => {
  it('exists and records R5 baseline evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('UI-OS R6');
    expect(doc).toContain('Settings / Safety / Theme / Equipment Profile Rewrite V1');
    expect(doc).toContain('PR #285');
    expect(doc).toContain('284d7a675ca3a5b9a5dc28b77a89b300180730d2');
    expect(doc).toContain('1142 files / 4648 tests');
    expect(doc).toContain('dist token scan clean');
    expect(doc).toContain('R5 improved Progress and Data Health clarity');
  });

  it('documents Settings hierarchy theme equipment cloud and next task', () => {
    for (const expected of [
      'system / light / dark',
      'Focus Mode may use immersive dark',
      'Olympic barbell 45 lb',
      'Smith 25 lb',
      'Dumbbell per-hand / 5 lb increment',
      'Selectorized machine stack',
      'Plate-loaded base/sled warning',
      'Cloud candidate is manual candidate only',
      'No automatic sync',
      'No automatic repair',
      'UI-OS R7 — Mobile Safe Area / Component State Regression Lock V1',
      'UI-OS R7 is not started by R6',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents non-goals and safety boundaries', () => {
    for (const expected of [
      'No source-of-truth change',
      'No AppData schema change',
      'No training algorithm change',
      'No Data Health repair semantics change',
      'No `POST /data-health/repair/apply`',
      'localStorage remains default/fallback/migration/emergency',
      'accepted browser mutation routes remain exactly seven',
      'blocked repair/reset/import/export HTTP routes remain blocked',
      'no default cloud sync',
      'no background sync',
      'pnpm-lock.yaml remains absent',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
