import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('limited history edit acceptance docs', () => {
  it('adds the manual acceptance runbook sections', () => {
    const doc = readSource('docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md');

    for (const heading of [
      '## Scope / Non-goals',
      '## Safety Before Testing',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Start App With Required Flags',
      '## Flag Matrix Manual Check',
      '## Target Set Manual Check',
      '## Confirmation Manual Check',
      '## Pending / Duplicate-submit Manual Check',
      '## Successful Limited Edit Manual Check',
      '## Failure / No-fake-success Manual Checks',
      '## Field Constraint Manual Check',
      '## Data Semantics Manual Check',
      '## localStorage Integrity Manual Check',
      '## Network Route Boundary Manual Check',
      '## Forbidden UI Controls Manual Check',
      '## Cleanup / Env Reset',
      '## Browser Build Safety',
      '## Manual Pass / Fail Template',
    ]) {
      expect(doc).toContain(heading);
    }
  });

  it('keeps acceptance docs aligned to the three-route boundary and non-goals', () => {
    const combined = [
      readSource('docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md'),
      readSource('API_CONTRACT.md'),
      readSource('FULL_STACK_REFACTOR_PLAN.md'),
      readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
    ].join('\n');

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'localStorage remains',
      'API results never overwrite AppData or localStorage',
      'Task 4.48 Limited History Edit Manual App Acceptance V1',
    ]) {
      expect(combined).toContain(expected);
    }

    expect(combined).toContain('No session/DataHealth repair/backup/reset route is approved.');
    expect(combined).toContain('do not imply production readiness');
  });
});
