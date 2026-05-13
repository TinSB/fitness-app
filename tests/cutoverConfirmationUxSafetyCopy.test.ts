import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CutoverConfirmationPanel,
  cutoverStateLabel,
} from '../src/productionCutover/CutoverConfirmationPanel';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cutover confirmation UX safety copy', () => {
  it('renders nothing unless explicitly visible', () => {
    expect(renderToStaticMarkup(createElement(CutoverConfirmationPanel, {
      state: 'localStorage-primary',
    }))).toBe('');
  });

  it('renders every safe source state label', () => {
    expect(cutoverStateLabel('localStorage-primary')).toBe('localStorage primary');
    expect(cutoverStateLabel('backend-read-candidate')).toBe('Backend read candidate');
    expect(cutoverStateLabel('backend-primary-candidate')).toBe('Backend primary candidate');
    expect(cutoverStateLabel('fallback-localStorage')).toBe('Fallback localStorage');
    expect(cutoverStateLabel('emergency-localStorage')).toBe('Emergency localStorage');
    expect(cutoverStateLabel('disabled')).toBe('Disabled');
  });

  it('states cutover safety boundaries and latest statuses', () => {
    const markup = renderToStaticMarkup(createElement(CutoverConfirmationPanel, {
      visible: true,
      state: 'backend-primary-candidate',
      lastBackendReadStatus: 'read candidate matched',
      lastBackendWriteStatus: 'write candidate accepted',
      lastFallbackStatus: 'fallback not needed',
    }));

    for (const expected of [
      'Backend-primary candidate safety check',
      'Current data source state',
      'Backend primary candidate',
      'read candidate matched',
      'write candidate accepted',
      'fallback not needed',
      'not cloud sync',
      'not multi-device account sync',
      'not a SaaS backend',
      'localStorage emergency backup remains preserved',
      'return the app to localStorage primary',
      'does not perform cutover without the separate runtime switch guard',
      'Explicit confirmation is required',
    ]) {
      expect(markup).toContain(expected);
    }
  });

  it('keeps component standalone and free of backend/runtime activation', () => {
    const source = readSource('src/productionCutover/CutoverConfirmationPanel.tsx');
    const app = readSource('src/App.tsx');

    for (const forbidden of [
      'fetch(',
      'localStorage.setItem',
      'apps/api/src/node',
      'node:sqlite',
      'POST /sessions/start',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(app).not.toContain('CutoverConfirmationPanel');
  });

  it('documents Task 9.9 boundaries and next task', () => {
    const doc = readSource('docs/CUTOVER_CONFIRMATION_UX_SAFETY_COPY.md');

    for (const expected of [
      'Task 9.9 Cutover Confirmation UX & Safety Copy V1',
      'not integrated into primary training UI',
      'not cloud sync, not multi-device account sync, and not a SaaS backend',
      'localStorage emergency backup remains preserved',
      'does not perform cutover without the separate runtime switch guard',
      'Recommended next task: Task 9.10 Source-of-Truth Cutover Manual Acceptance V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
