import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const audit = () => readSource('docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md');

const requiredRisks = [
  'history edit corruption',
  'PR/e1RM/effectiveSet drift',
  'active session data loss',
  'duplicate session completion',
  'offline failed mutation',
  'repair misuse',
  'backup/import data loss',
  'reset/recovery destructive action',
  'source-of-truth divergence',
  'browser route expansion',
  'production exposure',
  'user confusion',
];

const tableRowFor = (doc: string, risk: string) => {
  const escaped = risk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = doc.match(new RegExp(`\\|\\s*${escaped}\\s*\\|([^\\n]+)`));
  return match?.[0] || '';
};

describe('third mutation candidate risk matrix', () => {
  it('includes every required risk with severity, mitigation, and required gate', () => {
    const doc = audit();
    expect(doc).toContain('| Risk | Severity | Mitigation | Required gate |');

    for (const risk of requiredRisks) {
      const row = tableRowFor(doc, risk);
      expect(row, `${risk} row should exist`).toBeTruthy();
      const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean);
      expect(cells.length, `${risk} row should include risk, severity, mitigation, and gate`).toBe(4);
      expect(cells[1], `${risk} severity should be filled`).toMatch(/^(Medium|High|Critical)$/);
      expect(cells[2], `${risk} mitigation should be filled`).not.toBe('');
      expect(cells[3], `${risk} required gate should be filled`).toMatch(/gate/i);
    }
  });

  it('marks limited history edit high-risk and planning-only', () => {
    const doc = audit();
    const row = tableRowFor(doc, 'history edit corruption');

    expect(row).toContain('| High |');
    expect(row).toContain('Task 4.44 planning-only field constraint gate');
    expect(doc).toContain('Limited history edit is the most plausible future third candidate only for future planning, not implementation.');
    expect(doc).toContain('Task 4.44 must be planning-only.');
    expect(doc).toContain('Task 4.44 must not implement `POST /history/:id/edit`.');
  });

  it('keeps session mutation unrecommended and repair, backup, reset, and source-of-truth migration blocked', () => {
    const doc = audit();

    for (const expected of [
      'Session mutation is not ready to be the third browser mutation candidate.',
      'Session mutation cannot be third mutation yet.',
      'DataHealth repair remains blocked.',
      'Backup/import over HTTP remains high risk.',
      'Reset/recovery over HTTP remains destructive.',
      'Source-of-truth migration is not a mutation prototype.',
      'No API-backed persistence adapter is approved.',
      'No source-of-truth switch is approved.',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).not.toMatch(/Next recommended task: `Task 4\.44 Session/i);
    expect(doc).not.toMatch(/Next recommended task: `Task 4\.44 DataHealth repair/i);
    expect(doc).not.toMatch(/Next recommended task: `Task 4\.44 Source-of-truth/i);
  });
});
