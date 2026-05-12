import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE6_COMPLETION_ARCHIVE.md';

describe('phase 6 completion archive', () => {
  it('documents required archive sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 6 Completion Archive',
      '## Scope / Non-goals',
      '## Phase 6 Complete',
      '## Production Readiness Status',
      '## Source-of-truth Status',
      '## Auth / Account Status',
      '## Sync Status',
      '## Deployment Status',
      '## Privacy / Security Status',
      '## Migration / Backup / Recovery Status',
      '## Final Accepted Routes',
      '## Final Blocked Routes and Capabilities',
      '## Final Validation Commands',
      '## Final CI / Ruleset Policy',
      '## Recommended Next Task',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('states Phase 6 completion and final status', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 6 is complete after Task 6.40.',
      'Production backend activation remains unimplemented.',
      '`localStorage` remains default runtime source',
      'Auth runtime is not implemented.',
      'Cloud sync runtime is not implemented.',
      'Production deployment is not implemented.',
      'Raw AppData logging is blocked.',
      'Production storage migration remains dry-run only.',
      'Do not auto-start Phase 7.',
      'Do not auto-start Task 6.41.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records final routes, blocked routes, validation, and recommended next task', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'Backup/import/export over HTTP',
      'Reset/recovery over HTTP',
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'Phase 7 Task 7.1 Production Runtime Implementation Authorization Gate V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records Task 6.40 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.40: Phase 6 Completion Archive V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.40: Phase 6 Completion Archive V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.40 Phase 6 Completion Archive');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.40 Phase 6 Completion Archive Alignment');
  });
});
