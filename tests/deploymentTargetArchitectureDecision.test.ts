import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/DEPLOYMENT_TARGET_ARCHITECTURE_DECISION.md';

describe('deployment target architecture decision', () => {
  it('records the deployment architecture decision without implementing deployment', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 10.9 Deployment Target Architecture Decision V1',
      'Frontend may remain a Vercel/static web app.',
      'Backend should be a separate production API service unless a later explicit task decides otherwise.',
      'Auth provider integration should remain adapter-based until Phase 11',
      'This task is docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('rejects dev/runtime promotion and preview readiness assumptions', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Do not deploy devApiRunner as production backend.',
      'Do not promote api-primary-dev into production.',
      'Do not treat Vercel preview as production backend readiness.',
      'Do not use the local node:sqlite snapshot repository as production multi-user database.',
      'Do not treat backend-primary candidate mode as SaaS/multi-user production runtime.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents deployment options and current recommendation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Separate Node API Service',
      'Vercel Serverless/API Route Option',
      'Managed Backend Platform',
      'Self-Hosted Option',
      'Recommended future direction: keep the frontend deployable as a Vercel/static web app and plan a separate production API service',
      'The recommendation is architectural only. It does not authorize deployment implementation.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves runtime and cloud production boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend-primary candidate remains explicit opt-in and reversible.',
      'Auth skeleton remains disabled by default.',
      'Cloud sync skeleton remains disabled by default.',
      'Deployment runtime remains unimplemented.',
      'Monitoring external upload remains unimplemented.',
      '`api-primary-dev` remains explicit dev/local only and not production-ready.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('blocks deployment artifacts and recommends Task 10.10 only', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Vercel functions',
      'Docker files',
      'hosting config',
      'CI/CD scripts',
      'package scripts',
      'deployment runtime',
      'backend deployment',
      'Recommended next task: Task 10.10 Deployment Runtime Skeleton Boundary V1.',
      'Task 10.10 must not deploy anything, add hosting config, add CI/CD scripts, add Docker, or add Vercel functions.',
      'Task 10.10 is not part of Task 10.9.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
