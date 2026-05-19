import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('main navigation structure', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const navigationSource = readFileSync(resolve(process.cwd(), 'src/uiOs/uiOsNavigation.ts'), 'utf8');

  it('uses the real UI-OS workflow navigation', () => {
    for (const id of ['today', 'train', 'history', 'progress', 'settings']) {
      expect(navigationSource).toContain(`id: '${id}'`);
    }
  });

  it('does not keep assessment record or profile as primary tabs', () => {
    expect(navigationSource).not.toContain("id: 'assessment'");
    expect(navigationSource).not.toContain("id: 'record'");
    expect(navigationSource).not.toContain("id: 'profile'");
  });

  it('routes history progress and settings to their existing page components', () => {
    expect(appSource).toContain("activeTab === 'history'");
    expect(appSource).toContain('<RecordView');
    expect(appSource).toContain("activeTab === 'progress' && progressMode === 'metrics'");
    expect(appSource).toContain("activeTab === 'progress' && progressMode === 'plan'");
    expect(appSource).toContain('<PlanView');
    expect(appSource).toContain("activeTab === 'settings'");
    expect(appSource).toContain('<ProfileView');
    expect(appSource).toContain('<AssessmentView');
  });
});
