import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_PRIMARY_RUNTIME_HARDENING.md';

describe('API primary runtime hardening docs', () => {
  it('documents required hardening sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# API Primary Runtime Hardening',
      '## Scope / Non-goals',
      '## Startup Race Hardening',
      '## API Unavailable Hardening',
      '## Snapshot Mismatch Hardening',
      '## Reload Behavior Hardening',
      '## Stale AppData Hardening',
      '## Failure Rollback Hardening',
      '## No Silent Overwrite Hardening',
      '## Accepted Route Boundary',
      '## Manual Retest Inventory',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required risk topics and next task', () => {
    const doc = readSource(docPath);
    const lowerDoc = doc.toLowerCase();

    for (const expected of [
      'startup race',
      'API unavailable',
      'snapshot mismatch',
      'reload',
      'stale AppData',
      'failure rollback',
      'never silently',
      'remains default',
    ]) {
      expect(lowerDoc).toContain(expected.toLowerCase());
    }

    for (const expected of [
      'Task 5.31 API Primary Runtime Regression Lock V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps docs parity and forbidden instructions blocked', () => {
    const docs = [
      docPath,
      'docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md',
      'docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const route of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]) {
      expect(docs).toContain(route);
    }

    expect(docs).not.toMatch(/enable production backend now|enable auth now|enable sync now|enable cloud|delete localStorage now|enable DataHealth repair|enable reset\/recovery over HTTP|enable eighth browser mutation route/i);
  });
});
