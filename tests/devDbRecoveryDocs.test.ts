import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const recoveryDocPath = 'docs/DEV_API_RECOVERY_RESET.md';

const requiredSections = [
  '## Scope / Non-goals',
  '## When to use',
  '## Dev DB artifacts',
  '## Inspect',
  '## Backup',
  '## Reset',
  '## Manual safe reset checklist',
  '## Pass / Fail template',
];

const requiredPhrases = [
  'no HTTP reset endpoint',
  'no App.tsx integration',
  'no UI integration',
  'no localStorage replacement',
  'no auth',
  'no sync',
  'no deployment',
  'no automatic destructive repair',
  '.ironpath/dev-api.sqlite',
  '.ironpath/dev-api.sqlite-wal',
  '.ironpath/dev-api.sqlite-shm',
  '.ironpath/dev-api.sqlite-journal',
  '.ironpath/dev-api-runner',
  'RESET_DEV_API_DB',
  'backupFirst',
  'dry run',
  'Main DB paths must end with `.sqlite`',
  'Symlink and path-escape artifacts must be rejected',
];

const misleadingInstructions = [
  /\bHTTP reset endpoint\b.*\bavailable\b/i,
  /\bcurl .*reset\b/i,
  /\bnpm run .*reset\b/i,
  /\bconnect(?:s|ing)?\s+App\.tsx\s+to\s+(?:the\s+)?API\b/i,
  /\breplace\s+localStorage\b/i,
  /\benable auth\b/i,
  /\benable sync\b/i,
  /\bdeploy\s+(?:a\s+)?production server\b/i,
];

describe('dev DB recovery reset documentation', () => {
  it('exists and contains required checklist sections and safety facts', () => {
    expect(existsSync(resolve(repoRoot(), recoveryDocPath))).toBe(true);
    const doc = readSource(recoveryDocPath);

    requiredSections.forEach((section) => expect(doc).toContain(section));
    requiredPhrases.forEach((phrase) => expect(doc).toContain(phrase));
    expect(doc.match(/^- \[ \]/gm)?.length ?? 0).toBeGreaterThan(40);
  });

  it('does not document nonexistent HTTP or package-script reset instructions', () => {
    const doc = readSource(recoveryDocPath);

    misleadingInstructions.forEach((pattern) => expect(doc).not.toMatch(pattern));
  });
});
