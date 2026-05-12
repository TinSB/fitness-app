import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('API primary runtime acceptance docs', () => {
  it('documents the required Task 5.28 acceptance sections', () => {
    const doc = readSource('docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md');

    for (const expected of [
      '# API Primary Runtime Acceptance',
      '## Scope / Non-goals',
      '## Accepted Runtime Mode',
      '## Accepted Browser Mutation Routes',
      '## Boot Acceptance',
      '## Read Acceptance',
      '## Write Acceptance',
      '## API Unavailable Acceptance',
      '## No Fake Success Acceptance',
      '## LocalStorage Fallback Acceptance',
      '## Route Boundary Acceptance',
      '## Manual Acceptance Inventory',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
      'Task 5.29 API Primary Runtime Manual Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks acceptance scope, route inventory, and source-of-truth language', () => {
    const doc = readSource('docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md');

    for (const route of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]) {
      expect(doc).toContain(route);
    }

    for (const expected of [
      'Default mode remains `localStorage`',
      'API primary remains explicit dev/local `api-primary-dev`',
      'no fake success',
      'dedicated test browser profile',
      'dedicated dev DB',
      'no real personal training data',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('updates contract, refactor plan, and manual checklist parity', () => {
    const contract = readSource('API_CONTRACT.md');
    const plan = readSource('FULL_STACK_REFACTOR_PLAN.md');
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');

    for (const source of [contract, plan, checklist]) {
      expect(source).toContain('Task 5.28');
      expect(source).toContain('API Primary Runtime Acceptance');
      expect(source).toContain('Task 5.29 API Primary Runtime Manual Acceptance V1');
    }
  });

  it('does not instruct production or forbidden route expansion', () => {
    const doc = readSource('docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md');

    expect(doc).not.toMatch(/Task 5\.28 makes API primary the default|Task 5\.28 enables production backend|Task 5\.28 enables auth|Task 5\.28 enables sync|Task 5\.28 deploys production/i);
    expect(doc).not.toMatch(/accepts POST \/data-health\/repair\/apply|accepts backup\/import|accepts backup\/export|accepts reset\/recovery|eighth browser mutation route is accepted/i);
  });
});
