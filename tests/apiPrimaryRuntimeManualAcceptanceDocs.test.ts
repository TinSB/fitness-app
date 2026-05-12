import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md';

describe('API primary runtime manual acceptance docs', () => {
  it('exists, uses checkboxes, and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    expect(doc).toContain('- [ ]');
    for (const section of [
      '## Scope / Non-goals',
      '## Safety Before Testing',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Start App Dev Server',
      '## API Primary Boot Check',
      '## API Primary Read Check',
      '## API Primary Write Check',
      '## API Unavailable Fallback Check',
      '## LocalStorage Integrity Check',
      '## Forbidden Network And UI Check',
      '## Browser Build Safety',
      '## Cleanup',
      '## Manual Pass / Fail Template',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('contains commands, env setup, cleanup, and deterministic ready line', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-api-primary-runtime.sqlite',
      '$env:VITE_IRONPATH_RUNTIME_SOURCE="api-primary-dev"',
      '$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"',
      'VITE_IRONPATH_RUNTIME_SOURCE=api-primary-dev VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev',
      'IronPath dev API ready: <url>',
      'Remove-Item Env:VITE_IRONPATH_RUNTIME_SOURCE',
      'unset VITE_IRONPATH_RUNTIME_SOURCE',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers dedicated profile, dedicated dev DB, no real data, localStorage integrity, and pass/fail template', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Use a dedicated test browser profile only.',
      'Do not use real personal training data.',
      '.ironpath/manual-api-primary-runtime.sqlite',
      'Snapshot localStorage from the dedicated test profile.',
      'API results do not silently overwrite localStorage.',
      'Pass / Fail',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
