import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const plan = () => readSource('docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md');

const allowedFields = [
  '`exerciseId`',
  '`setId`',
  '`patch.weightKg`',
  '`patch.displayWeight`',
  '`patch.displayUnit`',
  '`patch.reps`',
  '`patch.rir`',
  '`patch.techniqueQuality`',
  '`patch.painFlag`',
  '`patch.note`',
];

const rejectedRows = [
  '`dataFlag`',
  'Session identity fields',
  'Session state fields',
  'Exercise identity fields',
  'Set identity and structure fields',
  'Add/remove/reorder operations',
  'Active session state',
  'Direct audit writes',
  'Derived summaries',
  'AppData replacement',
  'Non-training data',
];

describe('limited history edit field constraints', () => {
  it('locks the allowed fields table to a single existing set patch', () => {
    const doc = plan();

    expect(doc).toContain('The future candidate is limited to editing one existing set within one existing history session.');
    expect(doc).toContain('`exerciseId` and `setId` are only locators for the existing set to patch.');
    expect(doc).toContain('| Field | Role | Constraint | Calculation impact |');

    for (const field of allowedFields) {
      expect(doc, `${field} should be listed as allowed`).toContain(field);
    }

    for (const expected of [
      'must match an existing exercise identity',
      'must match an existing set id or set index',
      'must treat it as the actual load source and keep `actualWeightKg` aligned',
      'must remain display-only and must not become the trusted calculation source',
      'Must be `kg` or `lb`',
      'Finite integer, minimum 0',
      'Must be `good`, `acceptable`, or `poor`',
      'Must be boolean',
      'String only; future implementation must cap or validate display length before showing it.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('rejects broad history edit fields and operations', () => {
    const doc = plan();

    expect(doc).toContain('Rejected fields and operations:');
    for (const row of rejectedRows) {
      expect(doc, `${row} should be listed as rejected`).toContain(row);
    }

    for (const expected of [
      'Use existing `POST /history/:id/data-flag`; do not combine data status and set edit.',
      'No edit to `id`, `date`, `templateId`, `templateName`, `programTemplateId`, or `programTemplateName`.',
      'No edit to `trainingMode`, `focus`, `status`, `startedAt`, `finishedAt`, `completed`, or `durationMin`.',
      'No patch to `exerciseId`, `actualExerciseId`, `originalExerciseId`, `replacementExerciseId`, `legacyActualExerciseId`, or identity review fields.',
      'No patch to set `id`, `setIndex`, `type`, `warmupType`, `done`, `completedAt`, `completionStatus`, or `incompleteReason`.',
      'No adding, removing, replacing, or reordering exercises, sets, warmups, support logs, or blocks.',
      'No mutation of `activeSession`, Focus state, current step, current set, or unsaved training draft state.',
      'No direct edit to `editedAt`, `editHistory`, `affectedStats`, before/after summaries, or audit ids.',
      'No client-supplied PR, e1RM, effectiveSet, weighted effectiveSet, calendar, history, or summary totals.',
      'No raw AppData, history array, localStorage snapshot, or API snapshot replacement.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents calculation risk for each allowed calculation-affecting field', () => {
    const doc = plan();

    for (const expected of [
      '`patch.weightKg` must be treated as actualWeightKg-derived load',
      '`patch.reps` can change volume, PR, e1RM, effectiveSet, weighted effectiveSet, summaries, calendar, history, and readMirror output.',
      '`patch.rir` can change effort interpretation and effective-set quality.',
      '`patch.techniqueQuality` can change PR trust, effective-set quality, and DataHealth warnings.',
      '`patch.painFlag` can change PR trust, effective-set quality, and safety warnings.',
      '`patch.displayWeight` and `patch.displayUnit` are display-only; actualWeightKg remains the trusted calculation source.',
      '`patch.note` is audit/user-context only and must not change calculations.',
      '`identityInvalid` semantics remain unchanged.',
      '`test` and `excluded` dataFlag semantics remain unchanged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
