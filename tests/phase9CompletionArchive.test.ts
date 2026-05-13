import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE9_COMPLETION_ARCHIVE.md';

describe('phase 9 completion archive', () => {
  it('records completed Phase 9 task evidence through Task 9.11', () => {
    const doc = readSource(docPath);

    const evidence = [
      ['Task 9.1 Production Source-of-Truth Cutover Entry Gate V1', '#177', '`5ef03a41e8ee44974fcb17ab9c416a0a6b83c30d`'],
      ['Task 9.2 Backend-Primary Runtime Host Boundary V1', '#178', '`421358647879f2592a32163df1b151ed7ff0e929`'],
      ['Task 9.3 Backend AppData Repository Candidate V1', '#179', '`97908d20eaecfec8d642082f2dfc9d3b72696cf1`'],
      ['Task 9.4 Cutover Data Migration Dry Run V1', '#180', '`f6cdf5753f814a61e493747126f2ba9ef1b5bca9`'],
      ['Task 9.5 Backend-Primary Read Candidate V1', '#181', '`063b2a50fa212b1b05d9e3483ab24f0ed362c979`'],
      ['Task 9.6 Backend-Primary Mutation Candidate V1', '#182', '`18251b2b3808078523b9a2695801d2a0c0f2d3c5`'],
      ['Task 9.7 Frontend Source-of-Truth Runtime Switch Guard V1', '#183', '`4184087ca4c0046055c1d375ad3a5ae8f921a83a`'],
      ['Task 9.8 Cutover Fallback, Rollback & Emergency Restore V1', '#184', '`cec4617cf365d12283fa88fa057360e5eebcc5ff`'],
      ['Task 9.9 Cutover Confirmation UX & Safety Copy V1', '#185', '`06e204b76f5960fc1af8f1b337b03112e1bf210f`'],
      ['Task 9.10 Source-of-Truth Cutover Manual Acceptance V1', '#186', '`d8fbbced5102bd8f3e58624e4e5b490b02600b43`'],
      ['Task 9.11 Backend-Primary Regression Lock V1', '#187', '`4661efa546f6de91efa3204c543597d34f0d29b9`'],
    ];

    for (const expected of evidence.flat()) {
      expect(doc).toContain(expected);
    }
  });

  it('does not require Task 9.12 final PR and merge evidence before merge', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 9.12 Phase 9 Completion Archive V1 | pending final response | pending final response');
    expect(doc).toContain('Task 9.12 final PR number, merge commit, and merged status are reported in the final Codex response after merge.');
  });

  it('records validation commands and Phase 9 accepted result', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'dist token scan',
      'backend-primary candidate cutover path',
      'backend AppData repository candidate',
      'cutover data migration dry run',
      'backend-primary mutation candidate',
      'fallback / rollback / emergency restore',
      'backend-primary regression lock',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 10.1 only and keeps Phase 10 unstarted', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Recommended next task: Task 10.1 Production Auth / Cloud Sync / Deployment Entry Gate V1.');
    expect(doc).toContain('Task 10.1 is recommended only.');
    expect(doc).toContain('Phase 10 is not started by Task 9.12.');
    expect(doc).toContain('Backend-primary candidate is not SaaS/multi-user production runtime.');
  });
});
