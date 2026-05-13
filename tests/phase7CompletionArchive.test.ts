import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE7_COMPLETION_ARCHIVE.md';

describe('phase 7 completion archive', () => {
  it('records completed Phase 7 task evidence through Task 7.9', () => {
    const doc = readSource(docPath);

    const taskEvidence = [
      ['Task 7.1 Production Runtime Implementation Authorization Gate V1', '#153', '`8759329`'],
      ['Task 7.2 Production Runtime Contract Scaffold Authorization V1', '#154', '`3e9c27d`'],
      ['Task 7.3 Production Route Surface Freeze V1', '#155', '`25aa987`'],
      ['Task 7.4 Production Source-of-Truth Migration Preconditions V1', '#156', '`c62ee21`'],
      ['Task 7.5 Production Auth & User Data Boundary Plan V1', '#157', '`68221e2`'],
      ['Task 7.6 Production Backend Architecture Decision V1', '#158', '`9f4a69f`'],
      ['Task 7.7 Production Runtime Skeleton Authorization V1', '#159', '`1e0b112`'],
      ['Task 7.8 Frontend Runtime Selector Production Guard V1', '#160', '`85beac7`'],
      ['Task 7.9 Production Release Readiness Checklist V1', '#161', '`29b8c90`'],
    ];

    for (const expected of taskEvidence.flat()) {
      expect(doc).toContain(expected);
    }
  });

  it('does not require Task 7.10 final PR and merge evidence before merge', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 7.10 Phase 7 Completion Archive V1 | pending final response | pending final response');
    expect(doc).toContain('Task 7.10 final PR number, merge commit, and merged status are reported in the final Codex response after merge.');
  });

  it('locks final boundaries and Phase 8 non-start', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 7 stayed within authorization, planning, guard, readiness, and archive scope.',
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only and not production-ready.',
      'Production source-of-truth switch remains unimplemented.',
      'Accepted browser mutation routes remain exactly seven:',
      'Task 8.1 Production Runtime Implementation Entry Gate V1',
      'Task 8.1 is not started by Task 7.10.',
      'Phase 8 is not started automatically.',
      'A separate explicit user prompt is required.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records required validation commands and token scan expectations', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
