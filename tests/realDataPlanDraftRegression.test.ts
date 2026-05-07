import { describe, expect, it } from 'vitest';
import planDraftFixture from './fixtures/realDataRegression/duplicate-plan-draft.json';
import { filterVisibleCoachActions } from '../src/engines/coachActionDismissEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';
import {
  buildRegeneratedPlanAdjustmentDraft,
  dedupePlanAdjustmentDraftsByFingerprint,
  upsertPlanAdjustmentDraftByFingerprint,
} from '../src/engines/planAdjustmentIdentityEngine';
import type { AppData, ProgramAdjustmentDraft } from '../src/models/training-model';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const rawFixture = planDraftFixture.data as Partial<AppData> & { coachActions: CoachAction[] };
const fixtureData = () =>
  sanitizeData({
    ...makeAppData(),
    programAdjustmentDrafts: rawFixture.programAdjustmentDrafts,
    programAdjustmentHistory: rawFixture.programAdjustmentHistory,
  });

const actionById = (id: string) => {
  const action = rawFixture.coachActions.find((item) => item.id === id);
  if (!action) throw new Error(`missing action ${id}`);
  return action;
};

describe('real data plan draft fingerprint regression', () => {
  it('dedupes same-source ready drafts by sourceFingerprint instead of random draft id', () => {
    const data = fixtureData();
    const readyDrafts = data.programAdjustmentDrafts?.filter((draft) => draft.sourceFingerprint === 'coach-action|volume|back|pull-a|add-sets') || [];
    const deduped = dedupePlanAdjustmentDraftsByFingerprint(readyDrafts);

    expect(readyDrafts).toHaveLength(2);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].sourceFingerprint).toBe('coach-action|volume|back|pull-a|add-sets');
  });

  it('hides same-source pending CoachActions for ready or applied drafts', () => {
    const data = fixtureData();
    const readyAction = actionById('coach-action-ready');
    const appliedAction = actionById('coach-action-applied');

    expect(filterVisibleCoachActions([readyAction], data.programAdjustmentDrafts, data.programAdjustmentHistory, [], '2026-05-04')).toHaveLength(0);
    expect(filterVisibleCoachActions([appliedAction], data.programAdjustmentDrafts, data.programAdjustmentHistory, [], '2026-05-04')).toHaveLength(0);
  });

  it('allows rolled-back advice to reappear unless an active child draft already exists', () => {
    const data = fixtureData();
    const rolledAction = actionById('coach-action-rolled');
    const rolledOnly = data.programAdjustmentDrafts?.filter((draft) => draft.id === 'rolled-legs-random') || [];
    const rolledHistory = data.programAdjustmentHistory?.filter((item) => item.id === 'history-rolled-legs') || [];
    const rolledWithChild = data.programAdjustmentDrafts?.filter((draft) => draft.sourceFingerprint === rolledAction.sourceFingerprint) || [];

    expect(filterVisibleCoachActions([rolledAction], rolledOnly, rolledHistory, [], '2026-05-04')).toEqual([rolledAction]);
    expect(filterVisibleCoachActions([rolledAction], rolledWithChild, rolledHistory, [], '2026-05-04')).toHaveLength(0);
  });

  it('does not duplicate regenerated child drafts for the same rolled-back parent', () => {
    const data = fixtureData();
    const rolled = data.programAdjustmentDrafts?.find((draft) => draft.id === 'rolled-legs-random') as ProgramAdjustmentDraft;
    const child = data.programAdjustmentDrafts?.find((draft) => draft.id === 'rolled-legs-child-random') as ProgramAdjustmentDraft;
    const regenerated = buildRegeneratedPlanAdjustmentDraft(rolled, [rolled, child], { now: '2026-05-04T12:00:00.000Z' });
    const upserted = upsertPlanAdjustmentDraftByFingerprint(
      [rolled, child],
      data.programAdjustmentHistory || [],
      { ...child, id: 'candidate-child-random' },
      rolled.sourceFingerprint,
    );

    expect(regenerated.existingDraft?.id).toBe(child.id);
    expect(upserted.outcome).toBe('opened_existing');
    expect(upserted.drafts).toHaveLength(2);
    expect(upserted.targetDraft?.id).toBe(child.id);
  });

  it('keeps sourceFingerprint stable and free of time or random identifiers', () => {
    const fingerprints = (fixtureData().programAdjustmentDrafts || []).map((draft) => draft.sourceFingerprint || '');

    expect(fingerprints.every((fingerprint) => fingerprint.length > 0)).toBe(true);
    fingerprints.forEach((fingerprint) => {
      expect(fingerprint).not.toMatch(/\d{13}|Date\.now|Math\.random|random/i);
    });
  });
});
