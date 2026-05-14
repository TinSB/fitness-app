import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal production environment setup plan', () => {
  const doc = () => readSource('docs/PERSONAL_PRODUCTION_ENVIRONMENT_SETUP_PLAN.md');

  it('uses manual setup checklist items', () => {
    const content = doc();

    expect(content.match(/- \[ \]/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    for (const expected of [
      'Create a real Supabase project manually outside the repo',
      'Classify the Supabase anon key manually as browser-safe.',
      'Keep service role outside the browser and outside committed files.',
      'Do not commit `.env` files.',
      'Use a synthetic/manual test account first.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines environment roles without launching production', () => {
    const content = doc();

    for (const expected of [
      'Local: development and synthetic checks only.',
      'Preview: candidate/read-only checks only.',
      'Production-candidate: owner-only manual verification and rehearsals only.',
      'Production: not launched in Phase 14.',
      'Emergency-local: always available and localStorage-primary.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('locks repo safety and no drift', () => {
    const content = doc();

    for (const expected of [
      'No package dependency changes.',
      'No package script changes.',
      'No lockfile changes.',
      'No generated `dist` committed.',
      'No route changes.',
      'No real secrets committed.',
      'No real Supabase project data in automated tests.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
