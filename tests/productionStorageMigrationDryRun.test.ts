import { describe, expect, it } from 'vitest';
import { runProductionStorageMigrationDryRun } from '../src/storage/productionStorageMigrationDryRun';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production storage migration dry run', () => {
  it('returns an inspection-only result for synthetic snapshots', () => {
    expect(runProductionStorageMigrationDryRun({
      source: { version: '1', workouts: [] },
      sourceLabel: 'synthetic-fixture',
      expectedVersion: '1',
    })).toEqual({
      ok: true,
      status: 'passed',
      sourceLabel: 'synthetic-fixture',
      target: 'dry-run-only',
      writesPerformed: false,
      errors: [],
      warnings: [],
      summary: {
        topLevelKeyCount: 2,
        hasVersion: true,
        expectedVersion: '1',
      },
    });
  });

  it('blocks invalid sources without writing', () => {
    expect(runProductionStorageMigrationDryRun({ source: null })).toMatchObject({
      ok: false,
      status: 'blocked',
      target: 'dry-run-only',
      writesPerformed: false,
      errors: ['source must be an object snapshot'],
    });
  });

  it('warns on empty and version-mismatch sources', () => {
    expect(runProductionStorageMigrationDryRun({
      source: {},
      expectedVersion: '2',
    })).toMatchObject({
      ok: true,
      status: 'passed',
      writesPerformed: false,
      warnings: [
        'source snapshot is empty',
        'source version does not match expected version',
      ],
    });
  });

  it('contains no write, SQLite, storage mutation, or network behavior', () => {
    const source = readSource('src/storage/productionStorageMigrationDryRun.ts');

    for (const forbidden of [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'node:sqlite',
      'sqliteRepository',
      'INSERT ',
      'UPDATE ',
      'DELETE ',
      'fetch(',
      'writeFile',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
