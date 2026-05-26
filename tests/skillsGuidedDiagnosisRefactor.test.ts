import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { UI_THEME_STORAGE_KEY } from '../src/uiOs/theme/uiThemePreferenceStorage';
import { resolveActionableLoadContract } from '../src/engines/actionableLoadContract';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const lbToKg = (lb: number) => lb * 0.45359237;

describe('Skills-Guided Diagnosis & Surgical Refactor V1', () => {
  it('documents inspected issues, fixes, deferrals, and boundaries', () => {
    const docPath = 'docs/SKILLS_GUIDED_DIAGNOSIS_REFACTOR_V1.md';
    expect(existsSync(resolve(root, docPath))).toBe(true);
    const doc = read(docPath);

    for (const required of [
      'Skills-Guided Diagnosis & Surgical Refactor V1',
      '/diagnose',
      '/grill-with-docs',
      '/zoom-out',
      '/to-issues',
      '/tdd',
      'Confirmed safe boundaries',
      'Issues found',
      'Severity classification',
      'legacy AppShell and BottomNav',
      'Fixed in this PR: yes',
      'Fixed in this PR: no',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('keeps current browser mutation and source-of-truth boundaries locked', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).not.toContain('/data-health/repair/apply');

    const storage = read('src/storage/persistence.ts') + read('src/storage/localStorageAdapter.ts');
    expect(storage).toContain('readStoredAppDataFromLocalStorage');
    expect(storage).toContain('writeAppDataToLocalStorage');
    expect(storage).not.toContain('ironpath:ui-theme');
  });

  it('keeps actionable load as display apply and validation baseline', () => {
    const contract = resolveActionableLoadContract({
      exerciseName: 'Bench Press',
      rawTheoreticalLoadKg: lbToKg(27),
      plannedReps: 10,
      setPurpose: 'warmup',
      unitSettings: {
        weightUnit: 'lb',
        defaultIncrementKg: 2.5,
        defaultIncrementLb: 5,
        customIncrementsKg: [],
        customIncrementsLb: [],
      },
      showTheoreticalDetail: true,
    });

    expect(convertKgToDisplayWeight(contract.rawTheoreticalLoadKg, 'lb')).toBe(27);
    expect(convertKgToDisplayWeight(contract.actionableLoadKg, 'lb')).toBe(45);
    expect(contract.validationBaselineKg).toBe(contract.actionableLoadKg);
    expect(contract.rawTheoreticalLoadIsValidationBaseline).toBe(false);
  });

  it('keeps theme preference UI-only and Focus shell intentionally immersive dark', () => {
    expect(UI_THEME_STORAGE_KEY).toBe('ironpath:ui-theme');
    expect(read('src/storage/persistence.ts')).not.toContain('ironpath:ui-theme');
    expect(read('src/App.tsx')).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(read('src/uiOs/MobileAppShell.tsx')).toContain("const resolvedTheme = immersive ? 'dark'");
  });

  it('removes the unused legacy app shell and bottom nav after UI-OS migration', () => {
    expect(existsSync(resolve(root, 'src/ui/AppShell.tsx'))).toBe(false);
    expect(existsSync(resolve(root, 'src/ui/BottomNav.tsx'))).toBe(false);
    expect(read('src/App.tsx')).toContain("import { MobileAppShell } from './uiOs/MobileAppShell'");
    expect(read('src/uiOs/MobileAppShell.tsx')).toContain('<BottomNav');
    expect(read('src/uiOs/navigation/FloatingBottomNav.tsx')).toContain('data-bottom-nav-safe-area="viewport-edge"');
  });
});
