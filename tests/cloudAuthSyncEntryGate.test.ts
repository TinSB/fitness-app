import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md';

describe('cloud auth sync entry gate', () => {
  it('exists and covers the required product and architecture sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const expected of [
      '# Phase 19A - Cloud Auth & Sync Entry Gate V1',
      '## Scope',
      '## Product Target',
      '## Future Candidate Architecture',
      '## Source-of-Truth Strategy',
      '## Data Ownership',
      '## Privacy, Export, And Delete',
      '## Offline Behavior',
      '## Conflict Strategy',
      '## Local-To-Cloud Migration Dry Run',
      '## Candidate Future Tables',
      '## RLS Principles',
      '## Acceptance Gates',
      '## Phase 19B-19L Sequence',
      '## Explicit Blocked Capabilities',
      '## Decision',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('targets single-user multi-device sync and rejects SaaS collaboration scope', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'single-user multi-device sync',
      'one user account syncing the same owner training data across phone, computer, and tablet',
      'not coach/student',
      'not social',
      'not team collaboration',
      'not marketplace',
      'not public SaaS',
      'personal-only IronPath',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents Supabase Auth Postgres and RLS as candidate architecture only', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Supabase Auth',
      'Supabase Postgres',
      'RLS',
      'candidate architecture only',
      'does not install a provider SDK',
      'does not add environment variables',
      'does not connect to a cloud database',
      'does not create tables or migrations',
      'does not add routes',
      'does not change package files',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps localStorage as source fallback and emergency rollback while sequencing future sync safely', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains the current runtime source of truth.',
      '`localStorage` remains fallback, migration source, and emergency rollback source.',
      'Cloud sync must remain explicit opt-in until proven safe.',
      'read mirror',
      'write shadow',
      'explicit opt-in sync',
      'cloud-primary can be considered only after acceptance gates pass',
      'No Phase 19A work may silently overwrite local data.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers ownership privacy offline conflict migration table and RLS gates', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'one account owns one AppData snapshot stream',
      'Devices are clients for the same owner',
      'Export must include cloud snapshots',
      'Delete must require explicit confirmation',
      'offline-first',
      'no background sync worker',
      'no service-worker sync',
      'No last-write-wins default',
      'owner mismatch',
      'device clock mismatch',
      'dry run must not upload',
      'dry run must not download',
      'cloud_appdata_snapshots',
      'cloud_sync_operations',
      'cloud_devices',
      'cloud_conflicts',
      'auth.uid()',
      'service role key must never enter browser runtime',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines the Phase 19B through 19L sequence and records 19B as inventory-only', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '19B - Account Boundary & Local Inventory V1',
      'pure local owner/account/device inventory',
      '19C - Supabase Data Model & RLS Contract V1',
      '19D - Supabase Migration Files + Local Type Contracts V1',
      '19E - Auth Client Skeleton + Env Guard V1',
      '19F - Auth UI Skeleton V1',
      '19G - Cloud Read Mirror V1',
      '19H - Cloud Write Shadow Mode V1',
      '19I - Local-to-Cloud Migration Dry Run V1',
      '19J - Explicit Opt-In Single-User Sync Candidate V1',
      '19K - Conflict / Offline / Rollback Acceptance V1',
      '19L - Production Manual Acceptance V1',
      'Do not start 19B from 19A.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records root docs parity for API and refactor planning', () => {
    const apiContract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');

    for (const source of [apiContract, refactorPlan]) {
      expect(source).toContain('Phase 19A - Cloud Auth & Sync Entry Gate V1');
      expect(source).toContain('docs/static tests only');
      expect(source).toContain('single-user multi-device sync');
      expect(source).toContain('localStorage remains default, fallback, migration source, and emergency rollback source');
      expect(source).toContain('read mirror -> write shadow -> explicit opt-in sync');
      expect(source).toContain('does not add routes, schemas, runtime auth, cloud sync, env vars, package changes, or lockfile changes');
    }
  });
});
