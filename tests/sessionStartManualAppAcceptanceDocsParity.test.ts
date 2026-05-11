import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Session Start manual App acceptance docs parity', () => {
  it('matches the accepted session-start route and experiment flag', () => {
    const text = read('docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md');

    expect(`POST ${DEV_API_SESSION_START_ROUTE}`).toBe('POST /sessions/start');
    expect(text).toContain('POST /sessions/start');
    expect(text).toContain('session-start');
    expect(text).toContain('datahealth-dismiss');
    expect(text).toContain('history-data-flag');
    expect(text).toContain('limited-history-edit');
  });

  it('records Task 4.62 across contract, refactor, acceptance, and manual checklist docs', () => {
    expect(read('API_CONTRACT.md')).toMatch(/Task 4\.62:? Session Start Manual App Acceptance V1/);
    expect(read('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.62: Session Start Manual App Acceptance V1');
    expect(read('docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md')).toContain('Task 4.62 Session Start Manual App Acceptance V1');
    expect(read('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.62 Session Start Manual App Acceptance');
  });

  it('does not imply production readiness or enable forbidden routes', () => {
    const docs = [
      read('docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
      read('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
    ].join('\n');

    [
      /production-ready session start/i,
      /enable active patch/i,
      /enable active complete/i,
      /enable active discard/i,
      /replace localStorage with API/i,
      /make API source of truth/i,
      /enable auth/i,
      /enable sync/i,
    ].forEach((pattern) => expect(docs).not.toMatch(pattern));
  });
});
