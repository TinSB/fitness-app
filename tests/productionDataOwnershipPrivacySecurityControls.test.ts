import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const doc = () => readSource('docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md');

const dataDomains = [
  'training history',
  'active session',
  'program templates',
  'settings',
  'screening profile',
  'DataHealth state',
  'backup metadata',
  'readMirror summaries',
  'derived analytics',
  'migration state',
  'account identity metadata',
  'auth/session metadata',
  'sync metadata',
  'audit/security logs',
  'support/diagnostic data',
  'deletion/export records',
];

describe('production data ownership privacy and security controls', () => {
  it('requires every data domain to include ownership, privacy, retention, logging, sync, migration, and gate fields', () => {
    const source = doc();

    for (const domain of dataDomains) {
      const row = source.split('\n').find((line) => line.includes(`| ${domain} |`));
      expect(row, `missing matrix row for ${domain}`).toBeTruthy();
      const cells = row?.split('|').map((cell) => cell.trim()).filter(Boolean) ?? [];
      expect(cells).toHaveLength(12);
      expect(cells[0]).toBe(domain);
      for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        expect(cells[index], `${domain} column ${index}`).not.toHaveLength(0);
      }
      expect(cells[11], `${domain} required future gate`).toMatch(/gate/i);
    }
  });

  it('locks required privacy and security control areas', () => {
    const source = doc();

    for (const expected of [
      'PII',
      'personal training data',
      'log redaction',
      'secrets handling',
      'least privilege',
      'user data isolation',
      'account-linking boundaries',
      'retention/export/delete policy',
      'backup encryption future requirement',
      'audit logging future requirement',
      'real-data safety',
      'no raw AppData',
      'no raw localStorage',
      'no raw SQLite rows',
      'no raw logs',
    ]) {
      expect(source.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('keeps sync and migration as future gates only', () => {
    const source = doc();

    expect(source).toContain('Sync and migration are not implemented in Task 6.2.');
    expect(source).toContain('No data domain is production sync eligible until a future cloud sync conflict gate');
    expect(source).toContain('No data domain is production migration eligible until backup-first');
  });
});
