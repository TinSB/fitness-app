import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Session Start hardening docs parity', () => {
  it('records Task 4.63 and hardening coverage across docs', () => {
    expect(read('docs/SESSION_START_PROTOTYPE_HARDENING.md')).toContain('Session Start Prototype Hardening V1');
    expect(read('API_CONTRACT.md')).toMatch(/Task 4\.63:? Session Start Prototype Hardening V1/);
    expect(read('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.63: Session Start Prototype Hardening V1');
    expect(read('docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md')).toContain('Task 4.63 Session Start Prototype Hardening V1');
  });

  it('keeps exact route allowlist and does not imply production or forbidden routes', () => {
    const docs = [
      read('docs/SESSION_START_PROTOTYPE_HARDENING.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
      read('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
    ].join('\n');

    [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'localStorage remains source of truth',
      'API results never overwrite AppData/localStorage',
    ].forEach((term) => expect(docs).toContain(term));

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
