import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_RUNTIME_MANUAL_ACCEPTANCE.md';

describe('production runtime manual acceptance', () => {
  it('contains checkboxes and required acceptance sections', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '- [ ]',
      '## Scope / Non-goals',
      '## Prerequisites',
      '## Health / Capability Route-like Handling',
      '## Production Config Guard',
      '## Production Read Contract',
      '## Frontend API Client Disabled By Default',
      '## Dual-read Comparison',
      '## Write Shadow Mode',
      '## Source-of-truth And Local Data Safety',
      '## Browser / Node Isolation',
      '## Route Surface Lock',
      '## Vercel / Frontend Deployment Boundary',
      '## Failure / Fallback Behavior',
      '## Pass / Fail Template',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks manual acceptance safety boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'no source-of-truth switch',
      'localStorage remains default runtime source',
      'localStorage remains fallback, migration source, and emergency backup',
      'api-primary-dev` is rejected as production runtime',
      'Do not use real personal training data.',
      'accepted browser mutation routes remain exactly seven',
      'no eighth browser mutation route',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'no production backend deployment is implemented',
      'Task 8.13 may begin only after Task 8.12 is fully merged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
