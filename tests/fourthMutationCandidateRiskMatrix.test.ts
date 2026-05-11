import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const audit = () => readSource('docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md');

const requiredRisks = [
  'Active session data loss',
  'Duplicate session start',
  'Duplicate session complete',
  'Unsaved session discard',
  'Stale active session patch',
  'Offline failed active-session mutation',
  'Source-of-truth divergence',
  'PR/e1RM/effectiveSet drift',
  'DataHealth repair misuse',
  'Backup/import data loss',
  'Reset/recovery destructive action',
  'Browser route expansion',
  'Production exposure',
  'User confusion',
];

describe('fourth mutation candidate risk matrix', () => {
  it('includes every required risk with severity, mitigation, and required gate columns', () => {
    const doc = audit();

    expect(doc).toContain('| Risk | Severity | Mitigation | Required gate |');
    for (const risk of requiredRisks) {
      const row = doc.split('\n').find((line) => line.startsWith(`| ${risk} |`));
      expect(row, `${risk} row should exist`).toBeTruthy();
      expect(row?.split('|').map((part) => part.trim()).filter(Boolean).length, `${risk} row should have four cells`).toBe(4);
    }
  });

  it('marks active-session mutation as high-risk and planning-only', () => {
    const doc = audit();

    for (const risk of [
      'Active session data loss',
      'Duplicate session start',
      'Duplicate session complete',
      'Unsaved session discard',
      'Stale active session patch',
      'Offline failed active-session mutation',
    ]) {
      const row = doc.split('\n').find((line) => line.startsWith(`| ${risk} |`));
      expect(row, `${risk} should be high severity`).toContain('| High |');
    }

    expect(doc).toContain('Task 4.56 must be planning-only.');
    expect(doc).toContain('It is too risky for direct implementation.');
  });

  it('keeps repair, backup/reset, and source-of-truth migration blocked', () => {
    const doc = audit();

    for (const expected of [
      'DataHealth repair remains blocked.',
      'Repair remains blocked from browser mutation code.',
      'Backup/import/export over HTTP remains high risk.',
      'Reset/recovery over HTTP remains destructive.',
      'Backup/import/export/reset/recovery over HTTP remains blocked.',
      'Source-of-truth migration is not a mutation prototype.',
      'Current source of truth remains localStorage.',
      'No API-backed persistence adapter exists.',
      'No source-of-truth switch is approved.',
      'No dual-write strategy is active.',
      'No offline mutation queue exists.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
