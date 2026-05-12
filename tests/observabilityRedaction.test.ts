import { describe, expect, it } from 'vitest';
import { redactForPrivacySafeLog } from '../src/observability/redaction';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('observability redaction skeleton', () => {
  it('redacts sensitive object keys and records paths', () => {
    expect(redactForPrivacySafeLog({
      event: 'synthetic-diagnostic',
      userToken: 'abc',
      nested: {
        email: 'test@example.invalid',
        safe: 'visible',
      },
    })).toEqual({
      value: {
        event: 'synthetic-diagnostic',
        userToken: '[redacted]',
        nested: {
          email: '[redacted]',
          safe: 'visible',
        },
      },
      redactedPaths: ['userToken', 'nested.email'],
    });
  });

  it('redacts long strings and bearer-like credentials', () => {
    expect(redactForPrivacySafeLog({
      longMessage: 'x'.repeat(81),
      header: 'Bearer synthetic',
    })).toEqual({
      value: {
        longMessage: '[redacted:long-string]',
        header: '[redacted:credential]',
      },
      redactedPaths: ['longMessage', 'header'],
    });
  });

  it('handles arrays and primitives without side effects', () => {
    expect(redactForPrivacySafeLog(['safe', { password: 'hidden' }, 4])).toEqual({
      value: ['safe', { password: '[redacted]' }, 4],
      redactedPaths: ['[1].password'],
    });
    expect(redactForPrivacySafeLog(true)).toEqual({ value: true, redactedPaths: [] });
  });

  it('contains no external logging service, storage dump, network, or Node runtime behavior', () => {
    const source = readSource('src/observability/redaction.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'localStorage.',
      'sessionStorage.',
      'indexedDB',
      'navigator.sendBeacon',
      'node:http',
      'node:sqlite',
      'writeFile',
      'createServer',
      'listen(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
