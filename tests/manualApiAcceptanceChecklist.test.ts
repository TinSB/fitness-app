import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';
import { resolve } from 'node:path';

const checklistPath = 'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md';

const readChecklist = () => readSource(checklistPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Prerequisites',
  '## Launcher Boundary Verification',
  '## Health Check Acceptance',
  '## Seed Empty Acceptance',
  '## Read Route Acceptance',
  '## Mutation Route Acceptance',
  '## HTTP Parsing Acceptance',
  '## Localhost Safety Acceptance',
  '## DB File Safety Acceptance',
  '## Browser Build Safety Acceptance',
  '## Data Semantics Acceptance',
  '## Manual Pass / Fail Template',
];

const requiredBoundaryPhrases = [
  'no App.tsx integration',
  'no UI integration',
  'no localStorage replacement',
  'no production server',
  'no auth',
  'no sync',
  'no deployment',
  'no normalized tables',
  'no backup import/export HTTP endpoint',
  'Default host is `127.0.0.1`',
  'Default DB file is `.ironpath/dev-api.sqlite`',
  '`seedEmpty=false` does not create an AppData snapshot automatically',
  '`seedEmpty=true` creates one empty AppData snapshot only when no latest snapshot exists',
  'The seed snapshot label is `dev-launcher:seed-empty`',
  'Successful responses use `{ "result": <adapter result>, "snapshot": <metadata if present> }`',
  'Error responses use `{ "error": { "code": string, "message": string } }`',
  'Browser build is not polluted by `node:http`',
  'Browser build is not polluted by `node:sqlite`',
];

const requiredRoutes = [
  'GET /app-data/summary',
  'GET /sessions/summary',
  'GET /history',
  'GET /history/:id',
  'GET /data-health/summary',
  'POST /sessions/start',
  'POST /sessions/active/patches',
  'POST /sessions/active/complete',
  'POST /sessions/active/discard',
  'POST /history/:id/edit',
  'POST /history/:id/data-flag',
  'POST /data-health/issues/:issueId/dismiss',
  'POST /data-health/repair/apply',
];

const misleadingActionInstructions = [
  /\bnpm install\b/i,
  /\bpnpm add\b/i,
  /\byarn add\b/i,
  /\bswitch(?:es|ing)?\s+(?:the\s+)?App runtime\s+(?:to|onto)\s+(?:HTTP|SQLite)/i,
  /\breplace(?:s|ing)?\s+localStorage\b/i,
  /\bdeploy(?:s|ing)?\s+(?:a\s+)?production server\b/i,
  /\bconnect(?:s|ing)?\s+(?:the\s+)?(?:UI|App\.tsx)\s+to\s+(?:the\s+)?API\b/i,
];

describe('manual API acceptance checklist documentation', () => {
  it('exists and contains the required checklist sections', () => {
    expect(existsSync(resolve(repoRoot(), checklistPath))).toBe(true);

    const checklist = readChecklist();
    requiredSections.forEach((section) => expect(checklist).toContain(section));
    expect(checklist.match(/^- \[ \]/gm)?.length ?? 0).toBeGreaterThan(40);
  });

  it('documents the required dev-only boundary facts without requiring runtime changes', () => {
    const checklist = readChecklist();

    requiredBoundaryPhrases.forEach((phrase) => expect(checklist).toContain(phrase));
    requiredRoutes.forEach((route) => expect(checklist).toContain(route));

    expect(checklist).toContain('POST with an empty body is allowed without `Content-Type`');
    expect(checklist).toContain('Malformed JSON returns `400` with `invalid_json`');
    expect(checklist).toContain('Body larger than `maxBodyBytes` returns `413` with `request_body_too_large`');
    expect(checklist).toContain('Unsupported media type returns `415` with `unsupported_media_type`');
    expect(checklist).toContain('HEAD forwards to serverAdapter and usually returns `405` with `unsupported_route`');
  });

  it('rejects misleading action instructions while allowing negative boundary statements', () => {
    const checklist = readChecklist();

    expect(checklist).toContain('no App.tsx integration');
    expect(checklist).toContain('no production server');
    expect(checklist).toContain('no localStorage replacement');

    misleadingActionInstructions.forEach((pattern) => expect(checklist).not.toMatch(pattern));
  });

  it('keeps API contract and full-stack plan linked to the checklist without implying runtime migration', () => {
    const apiContract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');

    expect(apiContract).toContain('Manual API Acceptance Checklist');
    expect(apiContract).toContain('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');
    expect(apiContract).toContain('acceptance procedure, not a runtime feature');
    expect(apiContract).toContain('App runtime remains browser localStorage');

    expect(refactorPlan).toContain('Task 4.12: Manual API Acceptance Checklist V1');
    expect(refactorPlan).toContain('Completed as a manual acceptance checklist');
    expect(refactorPlan).toContain('Do not migrate `App.tsx` to HTTP/SQLite');
  });
});
