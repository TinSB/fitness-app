import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md';

describe('production backend database architecture decision', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Backend Database Architecture Decision',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Architecture Options',
      '## Current SQLite Snapshot Repository',
      '## Production Database Strategy',
      '## Normalized Schema Risk',
      '## Migration / Rollback Requirements',
      '## Backup Requirements',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('evaluates required backend and database options', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'no backend yet',
      'single Node backend',
      'serverless API',
      'hosted backend/database',
      'local-first desktop backend',
      'current SQLite snapshot repository',
      'normalized schema',
      'migration',
      'rollback',
      'backup',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no backend or normalized schema implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not production backend implementation.',
      'This is not a Fastify/Express/Koa/Hono server implementation.',
      'This is not a database migration implementation.',
      'This is not normalized schema implementation.',
      'No normalized tables are added in Task 6.4.',
      'No production migration is implemented in Task 6.4.',
      'do not implement production backend or normalized database schema yet',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.5', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1',
      'Task 6.5 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
