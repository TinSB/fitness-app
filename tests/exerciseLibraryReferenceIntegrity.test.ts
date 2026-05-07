import { describe, expect, it } from 'vitest';
import { EXERCISE_DISPLAY_NAMES, EXERCISE_EQUIVALENCE_CHAINS, EXERCISE_KNOWLEDGE_OVERRIDES } from '../src/data/exerciseLibrary';

const knownIds = () =>
  new Set([...Object.keys(EXERCISE_DISPLAY_NAMES), ...Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES), ...Object.keys(EXERCISE_EQUIVALENCE_CHAINS)]);

const referenceFields = ['alternativeIds', 'regressionIds', 'progressionIds'] as const;
const syntheticPattern = /__auto_alt|__auto_alt_alt|__alt_/;

describe('exercise library reference integrity', () => {
  it('does not reference missing or synthetic exercise ids', () => {
    const ids = knownIds();
    const missing: string[] = [];
    const synthetic: string[] = [];

    Object.entries(EXERCISE_KNOWLEDGE_OVERRIDES).forEach(([exerciseId, metadata]) => {
      referenceFields.forEach((field) => {
        const refs = Array.isArray(metadata[field]) ? (metadata[field] as string[]) : [];
        refs.forEach((ref) => {
          if (!ids.has(ref)) missing.push(`${exerciseId}.${field}:${ref}`);
          if (syntheticPattern.test(ref)) synthetic.push(`${exerciseId}.${field}:${ref}`);
        });
      });

      Object.keys((metadata.alternativePriorities as Record<string, string> | undefined) || {}).forEach((ref) => {
        if (!ids.has(ref)) missing.push(`${exerciseId}.alternativePriorities:${ref}`);
        if (syntheticPattern.test(ref)) synthetic.push(`${exerciseId}.alternativePriorities:${ref}`);
      });
    });

    Object.entries(EXERCISE_EQUIVALENCE_CHAINS).forEach(([chainKey, chain]) => {
      chain.members.forEach((ref) => {
        if (!ids.has(ref)) missing.push(`${chainKey}.equivalence.members:${ref}`);
        if (syntheticPattern.test(ref)) synthetic.push(`${chainKey}.equivalence.members:${ref}`);
      });
    });

    expect(missing).toEqual([]);
    expect(synthetic).toEqual([]);
  });

  it('keeps alternative priority keys aligned with alternative ids', () => {
    const mismatches: string[] = [];

    Object.entries(EXERCISE_KNOWLEDGE_OVERRIDES).forEach(([exerciseId, metadata]) => {
      const alternativeIds = new Set(Array.isArray(metadata.alternativeIds) ? (metadata.alternativeIds as string[]) : []);
      const priorities = (metadata.alternativePriorities as Record<string, string> | undefined) || {};
      Object.keys(priorities).forEach((id) => {
        if (!alternativeIds.has(id)) mismatches.push(`${exerciseId}:${id}`);
      });
      alternativeIds.forEach((id) => {
        if (!priorities[id]) mismatches.push(`${exerciseId}:${id}:missing-priority`);
      });
      if (alternativeIds.has(exerciseId)) mismatches.push(`${exerciseId}:self`);
    });

    expect(mismatches).toEqual([]);
  });

  it('keeps canonical ids known and non-synthetic', () => {
    const ids = knownIds();
    const invalidCanonicalIds: string[] = [];

    Object.entries(EXERCISE_KNOWLEDGE_OVERRIDES).forEach(([exerciseId, metadata]) => {
      const canonicalId = metadata.canonicalExerciseId;
      if (!canonicalId) return;
      if (typeof canonicalId !== 'string' || !ids.has(canonicalId) || syntheticPattern.test(canonicalId)) {
        invalidCanonicalIds.push(`${exerciseId}:${String(canonicalId)}`);
      }
    });

    expect(invalidCanonicalIds).toEqual([]);
  });
});
