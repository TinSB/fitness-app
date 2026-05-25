import { describe, expect, it } from 'vitest';
import {
  buildDataHealthDiagnosticsClarity,
  buildDiagnosticRedactionReminder,
  type DataHealthDiagnosticsCategory,
} from '../src/personalProduction/dataHealthDiagnosticsClarity';
import { readSource } from './runtimeBoundaryTestHelpers';

const categories: DataHealthDiagnosticsCategory[] = [
  'no_issue',
  'informational',
  'review_recommended',
  'backup_recommended',
  'owner_review_required',
  'schema_review_required',
  'recovery_recommended',
  'emergency_local_recommended',
  'cloud_candidate_paused',
  'diagnostics_insufficient',
  'repair_blocked',
];

describe('data health diagnostics clarity helper', () => {
  it('returns owner-friendly labels for every category with repair blocked', () => {
    for (const category of categories) {
      const result = buildDataHealthDiagnosticsClarity({ category });
      expect(result.statusLabel).toMatch(/[\u4e00-\u9fff]/);
      expect(result.explanation).toMatch(/[\u4e00-\u9fff]/);
      expect(result.redactionRequired).toBe(true);
      expect(result.repairActionAllowed).toBe(false);
      expect(result.sourceOfTruthChanged).toBe(false);
    }
  });

  it('keeps no issue local-first and reviewable', () => {
    const result = buildDataHealthDiagnosticsClarity({ category: 'no_issue' });

    expect(result.safeNextAction).toBe('continue_localStorage_primary');
    expect(result.canContinueLocal).toBe(true);
    expect(result.shouldPauseCloudCandidate).toBe(false);
  });

  it('prioritizes owner schema backup and diagnostic clarity inputs', () => {
    expect(buildDataHealthDiagnosticsClarity({ ownerScopeClear: false }).safeNextAction).toBe('inspect_owner_scope');
    expect(buildDataHealthDiagnosticsClarity({ schemaValidationClear: false }).safeNextAction).toBe('inspect_schema_validation');
    expect(buildDataHealthDiagnosticsClarity({ backupRecoveryClear: false }).safeNextAction).toBe('create_manual_backup');
    expect(buildDataHealthDiagnosticsClarity({ diagnosticsClear: false }).safeNextAction).toBe('record_redacted_incident_note');
  });

  it('pauses cloud candidate for unsafe categories and recommends emergency local when needed', () => {
    const owner = buildDataHealthDiagnosticsClarity({ ownerScopeClear: false, cloudCandidateEnabled: true });
    const emergency = buildDataHealthDiagnosticsClarity({ category: 'emergency_local_recommended' });
    const repair = buildDataHealthDiagnosticsClarity({ category: 'repair_blocked' });

    expect(owner.shouldPauseCloudCandidate).toBe(true);
    expect(owner.checklist).toEqual(expect.arrayContaining(['pause_cloud_candidate', 'do_not_repair_apply']));
    expect(emergency.shouldUseEmergencyLocal).toBe(true);
    expect(emergency.checklist).toContain('use_emergency_local_mode');
    expect(repair.safeNextAction).toBe('do_not_repair_apply');
    expect(repair.repairActionAllowed).toBe(false);
  });

  it('requires redaction and avoids full data or secret wording', () => {
    const reminder = buildDiagnosticRedactionReminder();

    expect(reminder).toContain('敏感凭证');
    expect(reminder).toContain('完整 AppData');
  });

  it('does not include side-effectful route network storage or Supabase access', () => {
    const source = readSource('src/personalProduction/dataHealthDiagnosticsClarity.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase',
      'window.localStorage',
      '.localStorage',
      'sessionStorage',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'setItem(',
      'removeItem(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
