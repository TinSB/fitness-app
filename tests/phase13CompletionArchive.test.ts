import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 13 completion archive', () => {
  const doc = () => readSource('docs/PHASE13_COMPLETION_ARCHIVE.md');

  it('summarizes tasks 13.1 through 13.15 with PR and merge evidence', () => {
    const content = doc();

    for (const expected of [
      '| 13.1 Production Deployment / Monitoring / Release Hardening Entry Gate | #232 | `14fd63cbf6f6319f86fe7ff5d64062b7eaa5aec8` |',
      '| 13.2 Environment Matrix & Release Channel Policy | #233 | `f8cb39088ebaae7454c828353a40fb122653078f` |',
      '| 13.3 Supabase Production Project Readiness Plan | #234 | `dae2ee4c4c1ea6fb3cb851ee714514501f2276f9` |',
      '| 13.4 Backend Hosting Target Decision | #235 | `64b6ea96aa5b4fe0d587117285b927cf424531bb` |',
      '| 13.5 Production Runtime Deployment Config Guard | #236 | `5919c81df0d93c6dd6a3f791a335b64046d250aa` |',
      '| 13.6 Backend Deployment Package Boundary | #237 | `ec62e8bdbf350eff59256ceb42bd8cd62af837dc` |',
      '| 13.7 Frontend Production Environment Separation | #238 | `58847472902b6053a2e83cf5995e27af3c2923e7` |',
      '| 13.8 Release Capability Matrix | #239 | `2497dc2659795cd56b967ade3468fab028e7f823` |',
      '| 13.9 Monitoring Provider Strategy Decision | #240 | `7e407b49885c460727c519c577e92d0ff9dc4cfb` |',
      '| 13.10 Monitoring / Audit Adapter Candidate | #241 | `c1784747ab6f9bdc959f0f9cfdb1962cc0583f94` |',
      '| 13.11 Production Diagnostics & Incident Snapshot | #242 | `59cc06d4505946f4d30ce0dfbe681df345c3e0bc` |',
      '| 13.12 Release Rollback / Kill Switch | #243 | `ec3bc14ab0269c55d00e37f58e30bca78afc757b` |',
      '| 13.13 Privacy, Export & Delete Readiness | #244 | `d5914fdbdeb3b78acb4fe29a2647f1471a023479` |',
      '| 13.14 Production Release Manual Acceptance | #245 | `2a34d20253900238b2599e82a2c7ab4771b43a7d` |',
      '| 13.15 Production Release Regression Lock | #246 | `82a5d9fdefbedd7a1b7f135e84b4a0261e9da088` |',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 13.16 validation evidence and pre-merge final evidence rule', () => {
    const content = doc();

    for (const expected of [
      'Task 13.16 final PR and merge evidence will be reported after merge',
      '`npm run api:dev:build` passed.',
      '`npm run typecheck` passed.',
      '`npm test` passed.',
      '`npm run build` passed.',
      'dist token scan clean.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms Phase 13 deliverables exist', () => {
    const content = doc();

    for (const expected of [
      'Environment matrix/release channel policy exists.',
      'Supabase production project readiness plan exists.',
      'Backend hosting decision exists.',
      'Deployment config guard exists.',
      'Backend deployment package boundary exists.',
      'Frontend environment separation exists.',
      'Release capability matrix exists.',
      'Monitoring strategy and adapter candidate exist with no external upload.',
      'Diagnostics/incident snapshot exists and is redacted.',
      'Rollback/kill switch exists.',
      'Privacy/export/delete readiness exists.',
      'Production release manual acceptance exists.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Task 14.1 only and does not start Phase 14', () => {
    const content = doc();

    expect(content).toContain('Recommended next task only: Task 14.1 — Personal Production Candidate Release Entry Gate V1.');
    expect(content).toContain('Phase 14 is not started.');
    expect(content).toContain('Deployment hardening does not equal production launch.');
    expect(content).toContain('Monitoring candidate does not equal external upload.');
    expect(content).toContain('Release readiness does not equal public SaaS.');
  });
});
