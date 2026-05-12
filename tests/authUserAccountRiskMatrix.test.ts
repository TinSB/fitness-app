import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const doc = () => readSource('docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md');

const requiredRisks = [
  'anonymous local user linked to wrong account',
  'account identity mismatch',
  'stale local data overwrites account data',
  'account deletion removes local fallback',
  'token/session leakage',
  'auth failure fake success',
  'export/delete responsibility gap',
  'support diagnostics leak identity data',
];

describe('auth user account risk matrix', () => {
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

  it('does not recommend direct auth implementation', () => {
    const source = doc();

    expect(source).toContain('Task 6.3 result: auth and user account lifecycle architecture gate only.');
    expect(source).toContain('No account identity is implemented in Task 6.3.');
    expect(source).toContain('No login/signup is implemented in Task 6.3.');
    expect(source).toContain('No token/session/OAuth handling is implemented in Task 6.3.');
    expect(source).toContain('No user table is added in Task 6.3.');
  });
});
