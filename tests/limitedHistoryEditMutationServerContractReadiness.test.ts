import { describe, expect, it } from 'vitest';
import { RECORD_DATA_HEALTH_MUTATION_ROUTES } from '../apps/api/src';
import { readSource } from './runtimeBoundaryTestHelpers';

const gate = () => readSource('docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md');

describe('limited history edit server contract readiness', () => {
  it('documents the existing server-side-only route boundary', () => {
    const doc = gate();

    expect(RECORD_DATA_HEALTH_MUTATION_ROUTES.map((route) => `${route.method} ${route.path}`)).toContain(
      'POST /history/:id/edit',
    );

    for (const expected of [
      '`POST /history/:id/edit` exists server-side only in the Node/dev API mutation skeleton.',
      'Browser runtime must not call `POST /history/:id/edit` yet.',
      'The existing server handler body shape must be inspected again before future implementation.',
      'Current inspected handler shape accepts route session id plus body fields compatible with `exerciseId`, `setId`, `patch`, and optional `reason`.',
      'Future client may send only server-compatible payload.',
      'Metadata may need to stay frontend-local if server contract does not accept it.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps Task 4.45 free of server contract and handler changes', () => {
    const doc = gate();

    for (const expected of [
      'No server contract changes are allowed in Task 4.45.',
      'No server handler changes are allowed in Task 4.45.',
      'No serverAdapter changes are allowed in Task 4.45.',
      'No httpRuntimeAdapter changes are allowed in Task 4.45.',
      'No sqliteRepository changes are allowed in Task 4.45.',
      'server contract extension',
      'frontend-only metadata',
      'adapter-side no-change',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
