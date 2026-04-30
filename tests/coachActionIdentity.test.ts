import { describe, expect, it } from 'vitest';
import { buildCoachActionFingerprint } from '../src/engines/coachActionIdentityEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'random-runtime-id-1',
  title: overrides.title || '生成训练量调整草案',
  description: overrides.description || '背部训练量低于目标，可以生成下周调整草案。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'create_plan_adjustment_preview',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? true,
  reversible: overrides.reversible ?? true,
  createdAt: overrides.createdAt || '2026-04-30T12:00:00.000Z',
  targetId: Object.prototype.hasOwnProperty.call(overrides, 'targetId') ? overrides.targetId : 'back',
  targetType: Object.prototype.hasOwnProperty.call(overrides, 'targetType') ? overrides.targetType : 'muscle',
  reason: overrides.reason || '背部有效组低于目标，且近期完成率良好。',
});

describe('CoachAction identity', () => {
  it('builds the same fingerprint for the same business action even when runtime ids differ', () => {
    const left = makeAction({ id: 'runtime-a' });
    const right = makeAction({ id: 'runtime-b' });

    expect(buildCoachActionFingerprint(left)).toBe(buildCoachActionFingerprint(right));
  });

  it('builds different fingerprints for different targets', () => {
    const back = makeAction({ targetId: 'back' });
    const chest = makeAction({ targetId: 'chest', description: '胸部训练量低于目标，可以生成下周调整草案。', reason: '胸部有效组低于目标。' });

    expect(buildCoachActionFingerprint(back)).not.toBe(buildCoachActionFingerprint(chest));
  });

  it('does not use Date.now, random ids, or draft ids as identity inputs', () => {
    const action = makeAction({ id: 'draft-123-random-456', createdAt: '2026-04-30T12:00:00.000Z' });
    const fingerprint = buildCoachActionFingerprint(action);

    expect(fingerprint).not.toContain('draft-123-random-456');
    expect(fingerprint).not.toContain('2026-04-30');
    expect(fingerprint).not.toMatch(/\b(undefined|null)\b/);
  });
});
