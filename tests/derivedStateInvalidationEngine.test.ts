import { describe, expect, it } from 'vitest';
import {
  buildDerivedStateInvalidation,
  type AppMutationEvent,
} from '../src/engines/derivedStateInvalidationEngine';

const visibleText = (value: unknown) => JSON.stringify(value);

describe('derivedStateInvalidationEngine', () => {
  it.each<Array<[AppMutationEvent, Partial<ReturnType<typeof buildDerivedStateInvalidation>>]>>([
    ['session_completed', { invalidateToday: true, invalidateRecord: true, invalidateAnalytics: true, invalidateCoachActions: true }],
    ['session_edited', { invalidateRecord: true, invalidateAnalytics: true, invalidateCoachActions: true }],
    ['session_deleted', { invalidateToday: true, invalidateRecord: true, invalidateAnalytics: true, invalidateCoachActions: true }],
    ['session_dataflag_changed', { invalidateToday: true, invalidateRecord: true, invalidateAnalytics: true, invalidateCoachActions: true }],
    ['template_applied', { invalidateToday: true, invalidatePlan: true, invalidateCoachActions: true }],
    ['template_rolled_back', { invalidateToday: true, invalidatePlan: true, invalidateCoachActions: true }],
    ['coach_action_dismissed', { invalidateToday: true, invalidatePlan: true, invalidateCoachActions: true }],
    ['data_health_issue_dismissed', { invalidateRecord: true }],
    ['pending_patch_created', { invalidateToday: true, invalidateCoachActions: true }],
    ['pending_patch_consumed', { invalidateToday: true, invalidateCoachActions: true }],
    ['pending_patch_dismissed', { invalidateToday: true, invalidateCoachActions: true }],
    ['health_data_imported', { invalidateToday: true, invalidateCoachActions: true }],
    ['unit_changed', { invalidateToday: true, invalidatePlan: true, invalidateRecord: true, invalidateAnalytics: false }],
    ['replacement_applied', { invalidateToday: true, invalidateRecord: true, invalidateAnalytics: true, invalidateCoachActions: true }],
    ['backup_restored', { invalidateToday: true, invalidatePlan: true, invalidateRecord: true, invalidateAnalytics: true, invalidateCoachActions: true }],
  ])('returns explicit invalidation flags for %s', (event, expected) => {
    const result = buildDerivedStateInvalidation(event);

    expect(result).toMatchObject(expected);
    expect(result.reason).toMatch(/[\u4e00-\u9fff]/);
    expect(visibleText(result)).not.toMatch(/\bundefined|null\b/);
  });
});
