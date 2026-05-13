import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE8_COMPLETION_ARCHIVE.md';

describe('phase 8 completion archive', () => {
  it('records completed Phase 8 task evidence through Task 8.13', () => {
    const doc = readSource(docPath);

    const evidence = [
      ['Task 8.1 Production Runtime Implementation Entry Gate V1', '#163', '`405f788`'],
      ['Task 8.2 Production Runtime Skeleton Boundary V1', '#164', '`3e795f9`'],
      ['Task 8.3 Production Runtime Config Guard V1', '#165', '`66798a9`'],
      ['Task 8.4 Production Health & Capability Endpoint V1', '#166', '`a24cd6b`'],
      ['Task 8.5 Production Persistence Strategy Adapter V1', '#167', '`90f5a0b`'],
      ['Task 8.6 Production Read Contract Implementation V1', '#168', '`9e34d06`'],
      ['Task 8.7 Frontend Production API Client Skeleton V1', '#169', '`fb7ee62`'],
      ['Task 8.8 Production Dual-Read Comparison V1', '#170', '`caac53f`'],
      ['Task 8.9 Production Mutation Contract Guard V1', '#171', '`c0e13fc`'],
      ['Task 8.10 Production Write Shadow Mode V1', '#172', '`9c41c3a`'],
      ['Task 8.11 Production Backend Deployment Boundary V1', '#173', '`bf61007`'],
      ['Task 8.12 Production Runtime Manual Acceptance V1', '#174', '`0660243`'],
      ['Task 8.13 Phase 8 Runtime Boundary Regression Lock V1', '#175', '`85944c4`'],
    ];

    for (const expected of evidence.flat()) {
      expect(doc).toContain(expected);
    }
  });

  it('does not require Task 8.14 final PR and merge evidence before merge', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 8.14 Phase 8 Completion Archive V1 | pending final response | pending final response');
    expect(doc).toContain('Task 8.14 final PR number, merge commit, and merged status are reported in the final Codex response after merge.');
  });

  it('records validation commands and Phase 8 result', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'dist token scan',
      'minimal production runtime skeleton and boundary pieces only',
      'disabled-by-default frontend production API client skeleton',
      'diagnostic-only dual-read comparison',
      'disabled-by-default write shadow mode',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 9.1 only and keeps Phase 9 unstarted', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Recommended next task: Task 9.1 Production Source-of-Truth Cutover Entry Gate V1.');
    expect(doc).toContain('Task 9.1 is recommended only.');
    expect(doc).toContain('Phase 9 is not started by Task 8.14.');
    expect(doc).toContain('No source-of-truth cutover is performed in Phase 8.');
  });
});
