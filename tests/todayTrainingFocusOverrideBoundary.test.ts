import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTodayTrainingFocusSelection } from '../src/engines/todayTrainingFocusOverrideEngine';
import { getTemplate, makeStatus, templates } from './fixtures';

describe('today training focus override boundaries', () => {
  it('does not mutate templates or program structure when resolving an override', () => {
    const beforeTemplates = JSON.stringify(templates);
    const beforeSystemTemplate = JSON.stringify(getTemplate('legs-a'));

    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });

    expect(selection.selectedTemplateId).toBe('push-a');
    expect(JSON.stringify(templates)).toBe(beforeTemplates);
    expect(JSON.stringify(getTemplate('legs-a'))).toBe(beforeSystemTemplate);
  });

  it('keeps generated core and recovery templates session-local', () => {
    const core = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'core',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });
    const recovery = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'recovery_mobility',
      todayStatus: makeStatus({ date: '2026-05-12' }),
    });

    expect(core.generatedTemplate).toBe(true);
    expect(recovery.generatedTemplate).toBe(true);
    expect(templates.some((template) => template.id === core.selectedTemplateId)).toBe(false);
    expect(templates.some((template) => template.id === recovery.selectedTemplateId)).toBe(false);
  });

  it('does not add backend, auth, sync, deployment, or localStorage source changes', () => {
    const engineSource = readFileSync('src/engines/todayTrainingFocusOverrideEngine.ts', 'utf8');
    const appSource = readFileSync('src/App.tsx', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string>; scripts?: Record<string, string> };

    expect(engineSource).not.toMatch(/fetch\(|localStorage|indexedDB|sqlite|auth|sync|deploy|\/sessions\//i);
    expect(appSource).toContain("useState<TodayTrainingFocusOverrideOption>('system')");
    expect(appSource).toContain('preservePlanSelection: todayFocusSelection.overrideActive');
    expect(packageJson.dependencies).not.toHaveProperty('@supabase/supabase-js');
    expect(packageJson.dependencies).not.toHaveProperty('firebase');
    expect(packageJson.scripts).not.toHaveProperty('today-focus-override');
  });
});
