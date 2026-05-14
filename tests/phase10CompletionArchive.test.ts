import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE10_COMPLETION_ARCHIVE.md';

describe('phase 10 completion archive', () => {
  it('records completed Phase 10 task evidence through Task 10.13', () => {
    const doc = readSource(docPath);

    const evidence = [
      ['Task 10.1 Production Auth / Cloud Sync / Deployment Entry Gate V1', '#189', '`86d99726f1b454219649196f2a7df3dfc7100fe7`'],
      ['Task 10.2 User Identity & Data Ownership Contract V1', '#190', '`f4c8ea491f93b2f9eb3d0dccf9125f50ef5affb3`'],
      ['Task 10.3 Auth Provider Strategy Decision V1', '#191', '`b110ade18e744c3d8d746a4b87f2e11f3a383b15`'],
      ['Task 10.4 Auth Runtime Skeleton Boundary V1', '#192', '`060f6b20a0a5c9ad916c1c7362584bdceff85867`'],
      ['Task 10.5 Account-Scoped AppData Boundary V1', '#193', '`d799cc9ee0595b0ede169cd46f21f5bb6996163c`'],
      ['Task 10.6 Cloud Sync Strategy & Conflict Policy V1', '#194', '`15c362445bfdb998f1e7daaca80a0410baee117e`'],
      ['Task 10.7 Cloud Sync Disabled Skeleton V1', '#195', '`42135971ee5a1b87245e9e2eca203c01fb90e7e0`'],
      ['Task 10.8 Production Secrets & Environment Guard V1', '#196', '`ffd2c58f303a633db26c6e24e3f047edfb755073`'],
      ['Task 10.9 Deployment Target Architecture Decision V1', '#197', '`418b34db57c126fd624745d4b82d10e9662e99c8`'],
      ['Task 10.10 Deployment Runtime Skeleton Boundary V1', '#198', '`19659a9eb30a1ce1bff8279a26cd606d568adcad`'],
      ['Task 10.11 Monitoring & Audit Event Boundary V1', '#199', '`468c5aa5ff7c177f136beb53b77083d556cc2654`'],
      ['Task 10.12 Production Privacy / Data Safety Manual Acceptance V1', '#200', '`d85aca7531f4e381f89c0b3b6876882e485a78aa`'],
      ['Task 10.13 Cloud Production Regression Lock V1', '#201', '`1f3a2d0390ece056b4b0b8dfebf3c303c96072e1`'],
    ];

    for (const expected of evidence.flat()) {
      expect(doc).toContain(expected);
    }
  });

  it('does not require Task 10.14 final PR and merge evidence before merge', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 10.14 Phase 10 Completion Archive V1 | pending final response | pending final response');
    expect(doc).toContain('Task 10.14 final PR number, merge commit, and merged status are reported in the final Codex response after merge.');
  });

  it('records validation commands and Phase 10 accepted result', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'dist token scan',
      'auth/cloud/deployment/monitoring entry boundaries only',
      'disabled auth runtime skeleton',
      'disabled cloud sync skeleton',
      'production secrets and environment guard',
      'disabled deployment runtime skeleton',
      'monitoring/audit event boundary with in-memory collection only',
      'cloud production regression lock',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 11.1 only and keeps Phase 11 unstarted', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Recommended next task: Task 11.1 Auth Provider Integration Entry Gate V1.');
    expect(doc).toContain('Task 11.1 is recommended only.');
    expect(doc).toContain('Phase 11 is not started by Task 10.14.');
    expect(doc).toContain('No auth provider integration is performed in Phase 10.');
  });
});
