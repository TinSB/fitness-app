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
    expect(source).toContain('AboutDataSafetyPanel');
    expect(source).toContain('SettingsControlCenter');
  });

  it('derives the 账号与同步 row label from the persisted cloud-sync receipt', () => {
    // The V1 regression: the row value was a hardcoded literal "未开启"
    // that never reflected reality. Lock in that the row now wires
    // through the useCloudSyncListRowEnabled hook so localStorage state
    // is the source of truth.
    expect(source).toContain("import {\n  CLOUD_SYNC_LIST_ROW_LABEL_ENABLED,\n  CLOUD_SYNC_LIST_ROW_LABEL_NOT_ENABLED,\n  useCloudSyncListRowEnabled,\n}");
    expect(source).toContain('useCloudSyncListRowEnabled()');
    expect(source).toContain('value: cloudSyncListRowLabel');
    // Make sure the dead literal is gone — any future copy/paste that
    // restores it would re-introduce the original V1 bug.
    expect(source).not.toMatch(/value:\s*'未开启'/);
  });
});
