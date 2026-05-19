import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_COMPLETION_ARCHIVE.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS completion archive', () => {
  it('exists and records UI-OS 1 through UI-OS 7 evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    for (const expected of [
      'UI-OS 7',
      'UI Operating System Completion Archive',
      'PR #272',
      'e69cbe44ee65c861550e21068159e133486f957a',
      'PR #273',
      'ironpath-ui-prototype',
      'PR #274',
      '181e36d355c01fcd1ebb207b9d7cd5fabbf889db',
      'PR #275',
      '5e1a76fb173d79439f61cf235ab886dffa093a0f',
      'PR #276',
      '423630e96d9fa31344534ecd080bcd598ed3b5de',
      'PR #277',
      '5bb9f1b27a94732cc803724e96dd4835a9b39f5d',
      'PR #278',
      '6a9470c4aed10d0341c5f1c88db9fa2afb36d0b2',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('confirms the completed UI operating system outcomes', () => {
    for (const expected of [
      'Mobile App OS shell exists',
      'Bottom nav exists',
      'Today / Train / History / Progress / Settings structure exists',
      'Today / Train / Focus Mode were redesigned',
      'History / Progress / Data Health were redesigned',
      'Settings / Safety / Equipment Profiles were redesigned',
      'Equipment-aware feasible load remains primary in training UI',
      'Bench 17 lb warmup display path resolves to empty 45 lb Olympic bar',
      'Local-first safety is visible',
      'Personal-only direction remains active',
      'SaaS remains deferred',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records validation evidence for implementation tasks', () => {
    expect(doc).toContain('1106 files / 4514 tests');
    expect(doc).toContain('1108 files / 4523 tests');
    expect(doc).toContain('1110 files / 4532 tests');
  });

  it('recommends only the next feedback task without starting it', () => {
    expect(doc).toContain('UI-OS Real-Use Polish / Phase 18');
    expect(doc).toContain('Task UI-OS 8A — Real Training UI Feedback Intake V1');
    expect(doc).toContain('recommended only and not started');
    expect(doc).toContain('does not authorize cloud sync');
    expect(doc).toContain('does not authorize cloud sync, default cloud sync, background sync, SaaS');
  });
});
