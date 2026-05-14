import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('supabase production project readiness plan', () => {
  const doc = () => readSource('docs/SUPABASE_PRODUCTION_PROJECT_READINESS_PLAN.md');

  it('covers every required readiness area', () => {
    const content = doc();

    for (const expected of [
      'Project URL classification',
      'Anon key classification',
      'Service role key isolation',
      'Service role never in browser.',
      'RLS policy readiness',
      'Backup / restore readiness',
      'Schema migration policy',
      'Auth callback URL compatibility',
      'Owner scope policy',
      'Manual test account policy',
      'No real personal training data in tests.',
      'Environment separation',
      'Production-candidate vs production distinction',
      'Rollback/emergency local mode readiness',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks Supabase execution and real project data', () => {
    const content = doc();

    for (const expected of [
      'No SQL is applied.',
      'No tables are created.',
      'No Supabase connection is made.',
      'No real environment files are read.',
      'No `.env` files are committed.',
      'No package changes are made.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim production Supabase is connected', () => {
    const content = doc();

    for (const forbidden of [
      'connected to Supabase production',
      'SQL applied',
      'tables created',
      'real project data used',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });
});
