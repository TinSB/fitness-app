import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDerivedStateInvalidation } from '../src/engines/derivedStateInvalidationEngine';

describe('record invalidation after mutations', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('keeps derived invalidation scoped to successful record mutations', () => {
    expect(appSource).toContain("invalidateDerivedState('session_deleted')");
    expect(appSource).toContain("invalidateDerivedState('session_dataflag_changed')");
    expect(appSource).toContain("fields.includes('dataFlag') ? 'session_dataflag_changed' : 'session_edited'");
    expect(appSource).toContain('if (!result.ok)');
    expect(appSource).toContain('if (result.changed)');
  });

  it('invalidates the expected derived state for record mutations', () => {
    expect(buildDerivedStateInvalidation('session_edited')).toMatchObject({
      invalidateRecord: true,
      invalidateAnalytics: true,
      invalidateCoachActions: true,
    });
    expect(buildDerivedStateInvalidation('session_deleted')).toMatchObject({
      invalidateToday: true,
      invalidateRecord: true,
      invalidateAnalytics: true,
      invalidateCoachActions: true,
    });
    expect(buildDerivedStateInvalidation('session_dataflag_changed')).toMatchObject({
      invalidateToday: true,
      invalidateRecord: true,
      invalidateAnalytics: true,
      invalidateCoachActions: true,
    });
  });
});
