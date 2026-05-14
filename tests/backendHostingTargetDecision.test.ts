import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('backend hosting target decision', () => {
  const doc = () => readSource('docs/BACKEND_HOSTING_TARGET_DECISION.md');

  it('documents the required hosting decision', () => {
    const content = doc();

    for (const expected of [
      'Frontend: Vercel/static web app candidate.',
      'Backend: separate production API service candidate.',
      'Cloud DB: Supabase Postgres candidate.',
      '`api-primary-dev` and `devApiRunner`: not production backend.',
      '`node:sqlite` snapshot repository: not cloud production DB.',
      'Vercel preview: not production backend readiness.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('compares approved hosting options and recommends separate backend service candidate', () => {
    const content = doc();

    for (const expected of [
      'Vercel serverless/API route option',
      'Railway/Render/Fly.io-style Node service',
      'Self-hosted Node API',
      'Managed backend platform',
      'The backend should remain a separate production API service candidate.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('rejects prohibited production promotions and deployment config changes', () => {
    const content = doc();

    for (const expected of [
      'Do not deploy `devApiRunner` as production backend.',
      'Do not promote `api-primary-dev` to production.',
      'Do not use `node:sqlite` snapshot repository as production multi-user DB.',
      'Do not treat Vercel preview as production backend readiness.',
      'Do not add hosting config, Docker, Vercel functions, deployment scripts, or dependencies.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
