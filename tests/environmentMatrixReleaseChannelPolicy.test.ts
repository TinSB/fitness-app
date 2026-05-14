import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('environment matrix release channel policy', () => {
  const doc = () => readSource('docs/ENVIRONMENT_MATRIX_RELEASE_CHANNEL_POLICY.md');

  it('defines every required environment', () => {
    const content = doc();

    for (const expected of [
      '| local |',
      '| dev |',
      '| preview |',
      '| production-candidate |',
      '| production |',
      '| emergency-local |',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines every required capability column', () => {
    const content = doc();

    for (const expected of [
      'localStorage-primary',
      'backend-primary candidate',
      'Supabase adapter candidate',
      'cloud pull candidate',
      'cloud push candidate',
      'manual conflict resolution',
      'monitoring candidate',
      'production deployment candidate',
      'real personal data',
      'source-of-truth switch',
      'cloud sync',
      'background sync',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('locks production and emergency-local behavior', () => {
    const content = doc();

    expect(content).toContain('production remains blocked for source-of-truth/cloud sync until a later explicit phase.');
    expect(content).toContain('emergency-local must always be available.');
    expect(content).toContain('default cloud sync remains blocked.');
    expect(content).toContain('background sync remains blocked.');
    expect(content).toContain('cloud push requires manual confirmation.');
  });

  it('does not claim runtime enablement', () => {
    const content = doc();

    for (const forbidden of [
      'production runtime enabled',
      'cloud sync enabled by default',
      'background sync enabled',
      'source-of-truth switch enabled',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });
});
