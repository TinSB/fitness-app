import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md',
].map(readSource).join('\n');

describe('production backend database docs parity', () => {
  it('records Task 6.4 across contract, plan, checklist, auth gate, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.4: Production Backend & Database Architecture Decision V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.4: Production Backend & Database Architecture Decision V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.4 Production Backend & Database Architecture Decision');
    expect(readSource('docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md')).toContain('Task 6.4 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.4 Backend Database Alignment');
  });

  it('keeps docs aligned on planning-only backend/database boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.4 Production Backend & Database Architecture Decision V1',
      'planning/docs/static tests only',
      'no backend yet',
      'single Node backend',
      'serverless API',
      'hosted backend/database',
      'local-first desktop backend',
      'current SQLite snapshot repository',
      'normalized schema risk',
      'Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct backend or schema implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement production backend now/i,
      /add Fastify now/i,
      /add Express now/i,
      /create normalized tables now/i,
      /run production migration now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
