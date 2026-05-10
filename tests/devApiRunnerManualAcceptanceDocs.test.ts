import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md';

const requiredSections = [
  '## Scope / Non-goals',
  '## Prerequisites',
  '## Build Runner',
  '## Start Runner With Seed Empty',
  '## Health Check',
  '## Read Routes',
  '## Mutation Smoke',
  '## Failure Smoke',
  '## Shutdown',
  '## Localhost Safety',
  '## DB File Safety',
  '## Browser Safety',
  '## Manual Pass / Fail Template',
];

const requiredPhrases = [
  'npm run api:dev:build',
  'npm run api:dev -- --seed-empty',
  'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/dev-api.sqlite',
  'IronPath dev API ready: <url>',
  'curl http://127.0.0.1:8787/health',
  'Invoke-RestMethod http://127.0.0.1:8787/health',
  'Success response shape is `{ "result": <value>, "snapshot": <metadata if present> }`',
  'Error response shape is `{ "error": { "code": string, "message": string } }`',
  'Default host is `127.0.0.1`',
  'Default DB file is `.ironpath/dev-api.sqlite`',
  'Browser-facing `apps/api/src/index.ts` does not export the runner',
  'App runtime still uses localStorage',
  'valid AppData snapshot with a startable template',
];

const allowedNegativeBoundaryPhrases = [
  'no App.tsx integration',
  'no UI integration',
  'no localStorage replacement',
  'no auth',
  'no sync',
  'no deployment',
  'not a production backend',
  'no normalized tables',
  'no backup import/export HTTP endpoint',
];

const misleadingActionInstructions = [
  /\benable auth\b/i,
  /\benable sync\b/i,
  /\bconnect(?:s|ing)?\s+App\.tsx\s+to\s+(?:the\s+)?API\b/i,
  /\breplace\s+localStorage\b/i,
  /\bdeploy\s+(?:a\s+)?production server\b/i,
  /\bnpm install tsx\b/i,
  /\badd Fastify\b/i,
  /\badd Express\b/i,
];

describe('dev API runner manual acceptance docs', () => {
  it('contains the required runbook sections and checkbox shape', () => {
    expect(existsSync(resolve(repoRoot(), runbookPath))).toBe(true);

    const runbook = readSource(runbookPath);
    requiredSections.forEach((section) => expect(runbook).toContain(section));
    expect(runbook.match(/^- \[ \]/gm)?.length ?? 0).toBeGreaterThan(50);
  });

  it('documents runner commands, expected output, safety boundaries, and response shapes', () => {
    const runbook = readSource(runbookPath);

    requiredPhrases.forEach((phrase) => expect(runbook).toContain(phrase));
    allowedNegativeBoundaryPhrases.forEach((phrase) => expect(runbook).toContain(phrase));

    expect(runbook).toContain('Malformed JSON returns `400` with `invalid_json`');
    expect(runbook).toContain('Unsupported media type returns `415` with `unsupported_media_type`');
    expect(runbook).toContain('Body too large returns `413` with `request_body_too_large`');
    expect(runbook).toContain('Unknown route returns `404` with `unsupported_route`');
    expect(runbook).toContain('Wrong method returns `405` with `unsupported_route`');
  });

  it('rejects misleading implementation instructions while allowing negative boundary statements', () => {
    const runbook = readSource(runbookPath);

    allowedNegativeBoundaryPhrases.forEach((phrase) => expect(runbook).toContain(phrase));
    misleadingActionInstructions.forEach((pattern) => expect(runbook).not.toMatch(pattern));
  });

  it('keeps linked docs aligned with Task 4.16 status without implying runtime migration', () => {
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');
    const strategy = readSource('docs/LOCAL_API_RUNNER_STRATEGY.md');
    const contract = readSource('API_CONTRACT.md');
    const plan = readSource('FULL_STACK_REFACTOR_PLAN.md');

    expect(checklist).toContain(runbookPath);
    expect(strategy).toContain('Task 4.16 Manual Acceptance Result');
    expect(contract).toContain('Dev API Runner Manual Acceptance');
    expect(plan).toContain('Task 4.16: Dev API Runner Manual Acceptance V1');
    [checklist, strategy, contract, plan].forEach((doc) => {
      expect(doc).not.toMatch(/\bproduction backend readiness has been reached\b/i);
      expect(doc).not.toMatch(/\bApp\.tsx HTTP migration is ready\b/i);
    });
  });
});
