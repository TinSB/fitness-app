import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R7_MOBILE_SAFE_AREA_COMPONENT_STATE_REGRESSION_LOCK.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R7 regression lock docs', () => {
  it('exists and records R6 baseline evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain('UI-OS R7');
    expect(doc).toContain('Mobile Safe Area / Component State Regression Lock V1');
    expect(doc).toContain('PR #286');
    expect(doc).toContain('0ddb2b17c78ecb6b34cb914e70429b4f3822dedb');
    expect(doc).toContain('1146 files / 4669 tests');
    expect(doc).toContain('dist token scan clean');
    expect(doc).toContain('Settings / Safety / Theme / Equipment Profile control center');
  });

  it('documents mobile safe area component state and theme locks', () => {
    for (const expected of [
      'mobile safe area',
      'Focus Mode hides bottom nav',
      'scroll content has bottom padding',
      'ActionButton',
      'StatusBadge',
      'SegmentedControl',
      'BottomSheet',
      'FloatingBottomNav',
      'GlassCard',
      'SettingsGroupCard',
      'EquipmentAwareLoadCard',
      'system/light/dark',
      'Focus Mode may remain immersive dark',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents copy route cloud boundaries and next task', () => {
    for (const expected of [
      'Copy Boundaries',
      '云端候选不会自动同步',
      '自动同步已启用',
      '后台同步',
      'accepted browser mutation routes remain exactly seven',
      'No eighth browser mutation route is accepted',
      'POST /data-health/repair/apply',
      'No default cloud sync',
      'No background sync',
      'pnpm-lock.yaml remains absent',
      'UI-OS R8 — Interaction OS Remediation Archive V1',
      'UI-OS R8 is not started by R7',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
