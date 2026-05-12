import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_DRY_RUN.md';

describe('localStorage to SQLite migration dry-run docs', () => {
  it('documents dry-run scope, validation, warnings, and no-write flags', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# LocalStorage to SQLite Migration Dry-run',
      '## Scope / Non-goals',
      '## Dry-run Inputs',
      '## Validation Behavior',
      '## Warning-only Behavior',
      '## No-write Lock',
      '## Accepted Browser Mutation Routes',
      '## Still Blocked',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }

    for (const expected of [
      'shouldWriteSqlite: false',
      'shouldWriteLocalStorage: false',
      'shouldSwitchSource: false',
      'productionReady: false',
      'Task 5.33 LocalStorage to SQLite Migration Apply Prototype V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('updates contract, refactor plan, and manual checklist parity', () => {
    const docs = [
      docPath,
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const expected of [
      'Task 5.32',
      'LocalStorage to SQLite Migration Dry-run',
      'no SQLite write',
      'does not switch source of truth',
      'Task 5.33 LocalStorage to SQLite Migration Apply Prototype V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct apply, deletion, production, or route expansion', () => {
    const docs = [
      docPath,
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    expect(docs).not.toMatch(/run migration apply now|write SQLite snapshot now|delete localStorage now|switch source of truth now|enable production backend now|enable auth now|enable sync now|enable eighth browser mutation route/i);
  });
});
