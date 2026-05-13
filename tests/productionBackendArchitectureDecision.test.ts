import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_BACKEND_ARCHITECTURE_DECISION.md';

describe('production backend architecture decision', () => {
  it('documents required decision sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Backend Architecture Decision',
      '## Task Identity',
      '## Architecture Decision',
      '## Rejected Option: Promote Dev API To Production',
      '## Recommended Production Backend Direction',
      '## Database Strategy Boundary',
      '## Auth Dependency',
      '## Sync Dependency',
      '## Deployment Dependency',
      '## Monitoring Dependency',
      '## Source-of-truth Dependency',
      '## Blocked Implementation Scope',
      '## Decision',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('rejects dev api promotion and production source switch', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Do not promote `devApiRunner`, `api-primary-dev`, or the Node-only SQLite snapshot runtime into production.',
      'deploying `devApiRunner` as production backend',
      'treating `api-primary-dev` as production-ready',
      'using local `node:sqlite` snapshot repository as production multi-user database',
      'switching source-of-truth in this task',
      'Task 7.7 is not started by Task 7.6.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps localStorage default in current runtime selector', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });
});
