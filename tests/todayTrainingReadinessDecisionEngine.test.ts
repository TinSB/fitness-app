// todayTrainingReadinessDecisionEngine — signal-only contract after
// Training Recommendation Hard Rewrite V2. Tests assert only the enum +
// numeric / structured outputs (decisionKind, action, riskLevel, reasonCodes).
// User-facing text fields are no longer produced by this engine.

import { describe, expect, it } from 'vitest';
import { buildTodayTrainingReadinessDecision } from '../src/engines/todayTrainingReadinessDecisionEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import type { ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const nowIso = '2026-05-20T12:00:00.000Z';

const normalReadiness: ReadinessResult = {
  score: 82,
  level: 'high',
  trainingAdjustment: 'normal',
  reasons: [],
};

const baseContext = (overrides: Parameters<typeof makeAppData>[0] = {}) =>
  buildTrainingDecisionContext(makeAppData(overrides), '2026-05-20', {
    readinessResult: normalReadiness,
    currentTrainingTemplate: getTemplate('push-a'),
    activeTemplate: getTemplate('push-a'),
  });

describe('todayTrainingReadinessDecisionEngine signal-only contract', () => {
  it('returns a normal start-as-planned decision for a normal day', () => {
    const decision = buildTodayTrainingReadinessDecision({ context: baseContext(), nowIso });
    expect(decision.decisionKind).toBe('normal');
    expect(decision.action).toBe('start_as_planned');
    expect(decision.riskLevel).toBe('low');
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('returns continue_active_session when an active session is in progress', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      activeSessionState: 'active',
      nowIso,
    });
    expect(decision.action).toBe('continue_active_session');
  });

  it('returns view_completed_session when today is already completed', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      activeSessionState: 'completed',
      nowIso,
    });
    expect(decision.action).toBe('view_completed_session');
    expect(decision.riskLevel).toBe('low');
  });

  it('blocks start with review_first when severe data health is set', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      severeDataHealthBlocker: true,
      nowIso,
    });
    expect(decision.decisionKind).toBe('postpone');
    expect(decision.action).toBe('review_first');
    expect(decision.riskLevel).toBe('high');
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('produces no user-facing text fields on the result', () => {
    const decision = buildTodayTrainingReadinessDecision({ context: baseContext(), nowIso });
    expect(decision).not.toHaveProperty('title');
    expect(decision).not.toHaveProperty('summary');
    expect(decision).not.toHaveProperty('userMessage');
    expect(decision).not.toHaveProperty('suggestedActions');
  });
});
