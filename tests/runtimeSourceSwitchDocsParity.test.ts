import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md',
  'docs/API_CLIENT_RUNTIME_STRATEGY.md',
  'docs/APPDATA_OWNERSHIP_MATRIX.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('runtime source switch docs parity', () => {
  it('records Task 5.4 across docs and keeps Task 5.5 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.4 Runtime Source Switch Feature Flag Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.4: Runtime Source Switch Feature Flag Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.4 Runtime Source Switch Feature Flag Plan');

    const docs = allDocs();
    expect(docs).toContain('docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md');
    expect(docs).toContain('Task 5.5 Migration Backup & Rollback Strategy V1');
  });

  it('keeps runtime source modes and fallback wording aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage',
      'api-readonly',
      'api-primary-dev',
      'VITE_IRONPATH_RUNTIME_SOURCE',
      'Default fallback is localStorage',
      'explicit dev/local',
      'No production API primary mode is approved in Phase 5.',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and implementation boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No runtime source selector is implemented.',
      'No API-backed runtime is implemented.',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

