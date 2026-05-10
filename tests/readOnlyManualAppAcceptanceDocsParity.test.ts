import { describe, expect, it } from 'vitest';
import { DEV_API_READ_ONLY_ROUTES } from '../src/devApi/devApiReadOnlyClient';
import { SESSION_MUTATION_ROUTES } from '../apps/api/src/sessionMutation';
import { RECORD_DATA_HEALTH_MUTATION_ROUTES } from '../apps/api/src/recordDataHealthMutation';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('read-only App manual acceptance docs parity', () => {
  it('keeps the documented GET allowlist aligned with the read-only client routes', () => {
    const doc = readSource('docs/READONLY_APP_MANUAL_ACCEPTANCE.md');
    const documentedRoutes = [...doc.matchAll(/`GET ([^`]+)`/g)].map((match) => match[1]);

    expect(documentedRoutes).toEqual([...DEV_API_READ_ONLY_ROUTES]);
  });

  it('covers all current server mutation routes as forbidden manual App routes', () => {
    const doc = readSource('docs/READONLY_APP_MANUAL_ACCEPTANCE.md');
    const mutationRoutes = [
      ...SESSION_MUTATION_ROUTES.map((route) => route.path),
      ...RECORD_DATA_HEALTH_MUTATION_ROUTES.map((route) => route.path),
    ];

    mutationRoutes.forEach((route) => expect(doc).toContain(route));
    expect(doc).toContain('backup/import/reset/recovery HTTP route');
  });

  it('mentions Task 4.22 status names and source-of-truth guarantees', () => {
    const doc = readSource('docs/READONLY_APP_MANUAL_ACCEPTANCE.md');

    ['disabled', 'matching', 'mismatch', 'unavailable', 'misconfigured'].forEach((status) => {
      expect(doc.toLowerCase()).toContain(status);
    });
    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('No data was changed');
  });

  it('keeps production URL and bundle scan guidance safe', () => {
    const doc = readSource('docs/READONLY_APP_MANUAL_ACCEPTANCE.md');

    expect(doc).toContain('scan build output only: `dist/`');
    expect(doc).toContain('Do not scan docs, tests, or source comments');
    expect(doc).not.toMatch(/use .*production URL/i);
    expect(doc).not.toMatch(/production URL is allowed/i);
  });
});
