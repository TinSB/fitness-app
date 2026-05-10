import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('limited history edit hardening docs parity', () => {
  it('documents hardening-only scope and the accepted three-route boundary', () => {
    const doc = readSource('docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md');

    for (const expected of [
      'Task 4.49 hardens the existing dev-only Limited History Edit prototype without adding mutation capability.',
      'Do not add any new mutation route.',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'No other browser mutation route is accepted.',
      'Task 4.50 Limited History Edit Observability & Recovery Notes V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents no-fake-success, source-of-truth, semantics, and browser build locks', () => {
    const doc = readSource('docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md');

    for (const expected of [
      'Success requires HTTP success.',
      'Success requires `result.ok === true`.',
      'Success requires `result.changed === true`.',
      'Success requires `result.status === "success"`.',
      'Success requires snapshot metadata.',
      'Missing snapshot metadata is failure.',
      'Source fingerprint missing is failure.',
      'API results never overwrite AppData or localStorage.',
      '`actualWeightKg` remains trusted.',
      '`displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.',
      'Browser build stays free of `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
