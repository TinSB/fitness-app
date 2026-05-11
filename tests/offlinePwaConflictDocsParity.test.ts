import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/OFFLINE_PWA_CONFLICT_STRATEGY.md',
  'docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
  'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('offline/PWA conflict docs parity', () => {
  it('records Task 5.6 across docs and keeps Task 5.7 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.6 Offline / PWA Conflict Strategy V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.6: Offline / PWA Conflict Strategy V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.6 Offline / PWA Conflict Strategy');

    const docs = allDocs();
    expect(docs).toContain('docs/OFFLINE_PWA_CONFLICT_STRATEGY.md');
    expect(docs).toContain('Task 5.7 API-backed Read Runtime Plan V1');
  });

  it('keeps offline/PWA topics aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'API unavailable',
      'offline training',
      'active session',
      'No full offline mutation queue',
      'visible failure',
      'Conflict diagnostics',
      'localStorage remains source of truth',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and implementation boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'No offline mutation queue is implemented.',
      'No source-of-truth switch is implemented.',
      'No API-backed runtime is implemented.',
      'API results never overwrite AppData',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

