import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const gate = () => readSource('docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md');

const allowedFields = [
  '`exerciseId` locator',
  '`setId` locator',
  '`patch.weightKg`',
  '`patch.displayWeight`',
  '`patch.displayUnit`',
  '`patch.reps`',
  '`patch.rir`',
  '`patch.techniqueQuality`',
  '`patch.painFlag`',
  '`patch.note`',
];

const rejectedScopes = [
  '`dataFlag`',
  'Session identity fields',
  'Session state fields',
  'Exercise identity fields',
  'Set identity/structure fields',
  'Add/remove/reorder operations',
  'Active session state',
  'Direct audit writes',
  'Derived summaries',
  'AppData replacement',
  'Non-training data',
];

describe('limited history edit field gate', () => {
  it('covers all allowed Task 4.44 fields and locators', () => {
    const doc = gate();

    expect(doc).toContain('Task 4.44 allowed fields are precise enough for a future single-route implementation plan.');
    for (const field of allowedFields) {
      expect(doc, `${field} should be covered`).toContain(field);
    }

    for (const expected of [
      'must match an existing exercise and must not replace exercise identity',
      'must match an existing set id or set index and must not replace set identity or structure',
      'finite non-negative load',
      'finite non-negative integer',
      '`good`, `acceptable`, or `poor`',
      'boolean safety context',
      'capped or validated string context with no calculation impact',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers rejected Task 4.44 fields and rejects broad history edit', () => {
    const doc = gate();

    expect(doc).toContain('Rejected fields and operations remain rejected:');
    for (const scope of rejectedScopes) {
      expect(doc, `${scope} should be rejected`).toContain(scope);
    }

    for (const expected of [
      'broad history edit remains rejected',
      'use existing `POST /history/:id/data-flag`, not the edit route',
      'no direct edit to `editedAt`, `editHistory`, `affectedStats`, before/after summaries, or audit ids',
      'no client-supplied PR, e1RM, effectiveSet, weighted effectiveSet, calendar, history, or summary totals',
      'no raw AppData, history array, localStorage snapshot, or API snapshot replacement',
      'no mutation of `activeSession`, Focus state, current step, current set, or unsaved training draft state',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks calculation-source rules for allowed fields', () => {
    const doc = gate();

    for (const expected of [
      'actualWeightKg remains trusted calculation source.',
      '`patch.weightKg` must keep actualWeightKg-derived load aligned.',
      '`displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.',
      '`patch.displayWeight` and `patch.displayUnit` must not become trusted calculation inputs by themselves.',
      '`identityInvalid` semantics are unchanged.',
      '`test` dataFlag semantics are unchanged.',
      '`excluded` dataFlag semantics are unchanged.',
      'No training algorithm changes are allowed.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
