import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const doc = () => readSource('docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md');

const requiredRisks = [
  'production data loss',
  'auth leakage',
  'account identity mismatch',
  'sync conflict corruption',
  'cloud write duplication',
  'offline queue corruption',
  'migration rollback failure',
  'localStorage/API divergence',
  'production DB schema mistake',
  'deployment misconfiguration',
  'secret leakage',
  'privacy exposure',
  'monitoring/logging sensitive data leakage',
  'branch protection bypass',
  'real user data misuse',
];

describe('production architecture risk matrix', () => {
  it('includes every required risk with severity, mitigation, and future gate', () => {
    const source = doc();

    for (const risk of requiredRisks) {
      const row = source.split('\n').find((line) => line.includes(`| ${risk} |`));
      expect(row, `missing risk row for ${risk}`).toBeTruthy();
      const cells = row?.split('|').map((cell) => cell.trim()).filter(Boolean) ?? [];
      expect(cells[0]).toBe(risk);
      expect(cells[1], `${risk} severity`).toMatch(/^(Critical|High|Medium|Low)$/);
      expect(cells[2], `${risk} mitigation`).not.toHaveLength(0);
      expect(cells[3], `${risk} required future gate`).toMatch(/gate/i);
    }
  });

  it('does not recommend direct production implementation', () => {
    const source = doc();

    expect(source).toContain('Phase 6 should start with production architecture planning, not implementation.');
    expect(source).toContain('Do not select production backend implementation yet.');
    expect(source).toContain('No auth implementation in Task 6.1.');
    expect(source).toContain('No cloud sync in Task 6.1.');
    expect(source).toContain('No production deployment in Task 6.1.');
  });
});
