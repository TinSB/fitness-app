import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const productionUiFiles = [
  'src/uiOs/settings/BackupRecoverySettingsPanel.tsx',
  'src/uiOs/settings/CloudCandidateSettingsPanel.tsx',
  'src/uiOs/settings/EmergencyLocalSettingsPanel.tsx',
  'src/uiOs/settings/EquipmentProfileSettingsPanel.tsx',
  'src/uiOs/settings/AboutDataSafetyPanel.tsx',
  'src/uiOs/settings/SettingsControlCenter.tsx',
  'src/uiOs/settings/ThemeSettingsPanel.tsx',
  'src/features/ProfileView.tsx',
  'src/ui/EquipmentProfileEditor.tsx',
  'src/ui/EquipmentAwareRecommendationWeight.tsx',
  'src/ui/EquipmentAwareLoadDisplay.tsx',
  'src/engines/equipmentAwareRecommendationDisplay.ts',
  'src/engines/settingsSafetySummary.ts',
];

describe('UI-OS R8.3 docs and boundaries', () => {
  it('documents R8.3 acceptance fix and R9 postponement', () => {
    const path = 'docs/UI_OS_R8_3_TRAINING_DENSITY_CONTRAST_CHINESE_COPY_FIX.md';
    expect(existsSync(resolve(root, path))).toBe(true);
    const doc = read(path);

    expect(doc).toContain('UI-OS R8.3');
    expect(doc).toContain('Training Density / Contrast / Chinese Copy Acceptance Fix');
    expect(doc).toContain('R8.2 completed');
    expect(doc).toContain('repeated the same load recommendation');
    expect(doc).toContain('heading contrast tokens');
    expect(doc).toContain('Chinese-first');
    expect(doc).toContain('No training algorithm change');
    expect(doc).toContain('UI-OS R9 is not started by R8.3');
  });

  it('keeps production UI free of forbidden developer and English copy', () => {
    const forbidden = [
      'Backup / Recovery',
      'Emergency Local Mode',
      'Equipment Profiles',
      'Olympic barbell',
      'Smith machine',
      'Selectorized machine',
      'Plate-loaded',
      'base weight not included',
      'localStorage remains',
      'cloud operation implied',
      'source-of-truth',
      'mutation route',
      'HTTP route',
      'service role',
      'backend-primary',
      'api-primary-dev',
      'POST /data-health/repair/apply',
      'Owner-only control center',
      'About / Data Safety',
      'Cloud Candidate',
      'Health Data Import',
      'Profile / Screening',
      'Coach Automation',
      'cleaned data',
      'personal-only',
    ];
    const combined = productionUiFiles.map((file) => read(file)).join('\n');

    for (const phrase of forbidden) {
      expect(combined).not.toContain(phrase);
    }
    expect(combined).toContain('JSON');
    expect(combined).toContain('CSV');
  });

  it('keeps route, cloud, prototype, and package boundaries locked', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toHaveLength(7);
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).not.toContain('/data-health/repair/apply');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
    const uiEntrypoints = [
      'src/features/TodayView.tsx',
      'src/features/TrainingFocusView.tsx',
      'src/features/TrainingView.tsx',
      'src/features/RecordView.tsx',
      'src/features/ProfileView.tsx',
    ].map((file) => read(file)).join('\n');
    expect(uiEntrypoints).not.toContain('@supabase');
    expect(read('src/main.tsx')).not.toContain('src/prototype/IronPathOS2');
  });
});
