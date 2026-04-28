import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ProfileView secondary entry points', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/ProfileView.tsx'), 'utf8');

  it('contains the screening entry moved out of primary navigation', () => {
    expect(source).toContain('onOpenAssessment');
    expect(source).toContain('ShieldCheck');
  });

  it('contains unit settings and data management', () => {
    expect(source).toContain('onUpdateUnitSettings');
    expect(source).toContain('downloadBackup');
    expect(source).toContain('downloadCsv');
    expect(source).toContain('handleImportFile');
  });

  it('contains health data and local PWA guidance', () => {
    expect(source).toContain('HealthDataPanel');
    expect(source).toContain('onUpdateHealthData');
    expect(source).toContain('Smartphone');
  });
});
