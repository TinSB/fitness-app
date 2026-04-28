import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('profile assessment entry', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const profileSource = readFileSync(resolve(process.cwd(), 'src/features/ProfileView.tsx'), 'utf8');
  const assessmentSource = readFileSync(resolve(process.cwd(), 'src/features/AssessmentView.tsx'), 'utf8');

  it('routes assessment through ProfileView instead of primary navigation', () => {
    expect(profileSource).toContain('onOpenAssessment');
    expect(appSource).toContain("setProfileSection('assessment')");
    expect(appSource).toContain("profileSection === 'assessment'");
    expect(appSource).not.toContain("id: 'assessment'");
  });

  it('keeps AssessmentView on the shared visual surface', () => {
    expect(assessmentSource).toContain("from '../ui/PageHeader'");
    expect(assessmentSource).toContain("from '../ui/ActionButton'");
    const commonImport =
      assessmentSource
        .split('\n')
        .find((line) => line.includes("from '../ui/common'")) || '';
    expect(commonImport).not.toMatch(/\bPage\b/);
  });
});
