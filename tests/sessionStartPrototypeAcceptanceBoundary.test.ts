import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Session Start prototype acceptance docs/runtime boundary', () => {
  it('records Task 4.61 without adding another route', () => {
    expect(read('API_CONTRACT.md')).toMatch(/Task 4\.61:? Session Start Prototype Acceptance V1/);
    expect(read('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.61: Session Start Prototype Acceptance V1');
    expect(read('docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md')).toContain('Task 4.61 Session Start Prototype Acceptance V1');
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');
  });

  it('does not instruct production readiness or forbidden active-session routes', () => {
    const docs = [
      read('docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md'),
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
