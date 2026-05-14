import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AuthCandidatePanel,
  authCandidateStateLabel,
} from '../src/cloudProduction/AuthCandidatePanel';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('login logout candidate UI', () => {
  it('renders nothing unless explicitly visible', () => {
    expect(renderToStaticMarkup(createElement(AuthCandidatePanel, {
      state: 'disabled',
    }))).toBe('');
  });

  it('renders stable candidate state labels', () => {
    expect(authCandidateStateLabel('disabled')).toBe('Disabled');
    expect(authCandidateStateLabel('provider_candidate')).toBe('Provider candidate');
    expect(authCandidateStateLabel('provider_not_configured')).toBe('Provider not configured');
    expect(authCandidateStateLabel('session_unavailable')).toBe('Session unavailable');
    expect(authCandidateStateLabel('user_unavailable')).toBe('User unavailable');
    expect(authCandidateStateLabel('unsupported')).toBe('Unsupported');
    expect(authCandidateStateLabel('authenticated-candidate')).toBe('Authenticated candidate');
    expect(authCandidateStateLabel('unauthenticated')).toBe('Unauthenticated');
  });

  it('states auth candidate safety copy and latest statuses', () => {
    const markup = renderToStaticMarkup(createElement(AuthCandidatePanel, {
      visible: true,
      state: 'provider_candidate',
      providerCandidate: 'supabase-auth-candidate',
      lastSessionStatus: 'fake session available',
      lastLinkingStatus: 'manual link required',
      lastEmergencyStatus: 'emergency local available',
      testOnlyCandidate: true,
    }));

    for (const expected of [
      'Auth candidate safety check',
      'Provider candidate',
      'supabase-auth-candidate',
      'fake session available',
      'manual link required',
      'emergency local available',
      'not cloud sync',
      'not multi-device sync',
      'localStorage remains available',
      'Login candidate will not automatically upload local training data',
      'Logout candidate will not delete emergency backup',
      'Backend-primary remains explicit opt-in and reversible',
      'Fake provider state is candidate/test-only',
    ]) {
      expect(markup).toContain(expected);
    }
  });

  it('disables controls when provider is not configured', () => {
    const markup = renderToStaticMarkup(createElement(AuthCandidatePanel, {
      visible: true,
      state: 'provider_not_configured',
      controlsEnabled: true,
    }));

    expect(markup).toContain('Provider is not configured for a real flow; controls are disabled.');
    expect(markup).toContain('aria-disabled="true"');
  });

  it('does not integrate with App runtime provider SDKs network or local mutation', () => {
    const source = readSource('src/cloudProduction/AuthCandidatePanel.tsx');
    const app = readSource('src/App.tsx');

    for (const forbidden of [
      '@supabase',
      '@clerk',
      'next-auth',
      'firebase',
      'auth0',
      'fetch(',
      'XMLHttpRequest',
      'process.env',
      '/auth',
      '/login',
      '/signup',
      'OAuth',
      'password',
      'token storage',
      'document.cookie',
      'localStorage.setItem',
      'localStorage.removeItem',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(app).not.toContain('AuthCandidatePanel');
  });

  it('documents candidate UI boundaries and next task', () => {
    const doc = readSource('docs/LOGIN_LOGOUT_CANDIDATE_UI.md');

    for (const expected of [
      'Task 11.6 Login / Logout Candidate UI V1',
      'Do not place it in the primary training workflow.',
      'This is not cloud sync.',
      'This is not multi-device sync.',
      'login will not automatically upload local training data',
      'logout will not delete emergency backup',
      'Recommended next task: Task 11.7 Local Account Linking Dry Run V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
