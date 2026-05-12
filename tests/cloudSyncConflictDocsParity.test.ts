import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md',
].map(readSource).join('\n');

describe('cloud sync conflict docs parity', () => {
  it('records Task 6.5 across contract, plan, checklist, backend decision, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.5: Cloud Sync & Conflict Resolution Architecture Gate V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.5: Cloud Sync & Conflict Resolution Architecture Gate V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate');
    expect(readSource('docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md')).toContain('Task 6.5 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.5 Cloud Sync Conflict Alignment');
  });

  it('keeps docs aligned on planning-only sync/conflict boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1',
      'docs/static tests only',
      'no sync',
      'manual backup sync',
      'single-device cloud backup',
      'multi-device bidirectional sync',
      'conflict detection',
      'conflict merge policy',
      'remote write duplication',
      'offline queue risk',
      'Task 6.6 Deployment, Environment & Secrets Strategy V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct sync or production implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement cloud sync now/i,
      /enable multi-device sync now/i,
      /add remote write queue now/i,
      /start background sync worker now/i,
      /auto-merge conflicts now/i,
      /deploy production now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
