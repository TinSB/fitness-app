import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const docPath = resolve(root, 'docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md');

const readDoc = () => readFileSync(docPath, 'utf8');

describe('active session UX confirmation and rollback plan', () => {
  it('contains every required planning section', () => {
    const doc = readDoc();

    [
      '## Scope / Non-goals',
      '## UX State Model',
      '## Start Confirmation',
      '## Duplicate Start Protection',
      '## Pending State',
      '## Failure UX',
      '## No Optimistic Success',
      '## No Auto Retry',
      '## Rollback / Recovery UX',
      '## App Usability On Dev API Failure',
      '## Local App Fallback',
      '## Route Boundary',
      '## Required Gates Before Session Start Prototype',
      '## Decision Record',
      '## Final Recommendation',
    ].forEach((section) => expect(doc).toContain(section));
  });

  it('locks confirmation, pending, duplicate-submit, and failure UX requirements', () => {
    const doc = readDoc();

    expect(doc).toContain('explicit user confirmation');
    expect(doc).toContain('Cancel must prevent POST');
    expect(doc).toContain('one pending request per visible prototype instance');
    expect(doc).toContain('repeated click sends one request');
    expect(doc).toContain('disabled submit controls while pending');
    expect(doc).toContain('retry after failure requires explicit user action and re-confirmation');
    expect(doc).toContain('no automatic retry');
    expect(doc).toContain('Dev API unavailable');
    expect(doc).toContain('App must remain usable');
  });

  it('requires no optimistic success and preserves source-of-truth boundaries', () => {
    const doc = readDoc();

    expect(doc).toContain('Success requires all of:');
    expect(doc).toContain('HTTP 2xx');
    expect(doc).toContain('`result.ok === true`');
    expect(doc).toContain('`result.changed === true`');
    expect(doc).toContain('`result.status === "success"`');
    expect(doc).toContain('snapshot metadata exists');
    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API results never overwrite AppData or localStorage');
    expect(doc).toContain('no API-backed persistence adapter');
    expect(doc).toContain('no offline mutation queue');
  });

  it('keeps active-session routes blocked and recommends Task 4.59 only', () => {
    const doc = readDoc();

    expect(doc).toContain('No active-session route is implemented');
    expect(doc).toContain('`POST /sessions/start`');
    expect(doc).toContain('`POST /sessions/active/patches`');
    expect(doc).toContain('`POST /sessions/active/complete`');
    expect(doc).toContain('`POST /sessions/active/discard`');
    expect(doc).toContain('Task 4.59 Session Start Mutation Prototype Plan V1');
    expect(doc).toContain('planning-only');
  });
});
