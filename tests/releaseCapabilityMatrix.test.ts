import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('release capability matrix', () => {
  const doc = () => readSource('docs/RELEASE_CAPABILITY_MATRIX.md');

  it('defines required release channels', () => {
    const content = doc();

    for (const expected of [
      '| Capability | local | dev | preview | production-candidate | production | emergency-local |',
      '| localStorage-primary |',
      'production-candidate',
      'emergency-local',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines required capabilities', () => {
    const content = doc();

    for (const expected of [
      'backend-primary candidate',
      'Supabase adapter candidate',
      'cloud pull candidate',
      'cloud push candidate',
      'manual conflict resolution',
      'monitoring candidate',
      'production deployment candidate',
      'source-of-truth switch',
      'cloud sync',
      'background sync',
      'automatic worker',
      'external monitoring upload',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('locks unsafe defaults as blocked or manual-only', () => {
    const content = doc();

    for (const expected of [
      'Source-of-truth switch: blocked.',
      'Default cloud sync: blocked.',
      'Background sync: blocked.',
      'Automatic worker: blocked.',
      'Cloud push: manual confirmation only in allowed candidate channels.',
      'Cloud pull apply: manual confirmation only in allowed candidate channels.',
      'Monitoring: redacted/internal candidate only.',
      'Deployment: candidate only, no auto-start.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves route source and localStorage boundaries', () => {
    const content = doc();

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend/cloud candidate remains explicit opt-in and reversible.',
      'Cloud pull does not auto-apply.',
      'Cloud push requires manual confirmation.',
      'Conflict resolution remains manual.',
      'Accepted browser mutation routes remain exactly seven.',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim runtime enablement or package changes', () => {
    const content = doc();

    for (const forbidden of [
      'production launch complete',
      'cloud sync enabled by default',
      'background sync enabled',
      'automatic worker enabled',
      'external monitoring upload enabled',
      'new package dependency',
      'new route added',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('recommends only Task 13.9', () => {
    expect(doc()).toContain('Recommended next task: Task 13.9 Monitoring Provider Strategy Decision V1.');
  });
});
