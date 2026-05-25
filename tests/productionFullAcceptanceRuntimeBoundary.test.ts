import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('Phase 21I production full acceptance boundary', () => {
  it('keeps the production upload explicit and scoped to the owner cloud snapshot table', () => {
    const source = readSource('src/cloudProduction/productionFullAcceptanceRuntime.ts');

    for (const expected of [
      'runProductionFullAcceptanceSync',
      'buildCloudWriteShadowCandidate',
      'buildCloudReadMirrorVerification',
      'buildFirstUploadExplicitApply',
      'buildCloudParityCheck',
      'cloud_appdata_snapshots',
      'manualConfirmation: true',
      "userMessage: '同步完成'",
      "userMessage: '发现冲突'",
      "userMessage: '恢复本地模式'",
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'localStorageDeleted: false',
      'sourceOfTruthChanged: false',
    ]) {
      expect(source).toContain(expected);
    }

    expect(source).toContain(".eq('owner_user_id', owner.ownerId)");
    expect(source).toContain(".eq('account_id', owner.accountId ?? owner.ownerId)");
  });

  it('does not add destructive local storage, background, service-role, or cloud-primary behavior', () => {
    const source = [
      readSource('src/cloudProduction/productionFullAcceptanceRuntime.ts'),
      readSource('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx'),
    ].join('\n');

    for (const forbidden of [
      'SUPABASE_SERVICE_ROLE',
      'service_role',
      'localStorage.setItem',
      'localStorage.removeItem',
      'localStorage.clear',
      'document.cookie',
      'setInterval',
      'serviceWorker',
      'backgroundSync',
      'cloudPrimaryEnabled: true',
      'defaultSyncEnabled: true',
      'backgroundWorkEnabled: true',
      'sourceOfTruthChanged: true',
      'localStorageDeleted: true',
      'deleteTrainingSession',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'billing',
      'subscription',
      'admin',
      'team',
      'social',
    ]) {
      expect(source, `21I production path should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('documents production acceptance and keeps pnpm-lock absent', () => {
    const doc = readSource('docs/PRODUCTION_FULL_ACCEPTANCE.md');

    for (const expected of [
      'Phase 21I - Production Full Acceptance V1',
      '`开启同步`',
      '`同步完成`',
      '`发现冲突`',
      '`恢复本地模式`',
      'https://fitness-app-wheat-phi.vercel.app',
      'does not make cloud data primary',
      'does not start background sync',
      'does not delete localStorage',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(false);
  });

  it('documents the required non-destructive authenticated production grants', () => {
    const doc = readSource('docs/PRODUCTION_FULL_ACCEPTANCE.md');

    for (const expected of [
      'usage on schema `public`',
      '`select` and `insert`',
      '`public.cloud_appdata_snapshots`',
      '`public.cloud_sync_operations`',
      '`public.cloud_devices`',
      '`public.cloud_conflicts`',
      '`public.cloud_export_delete_requests`',
      "notify pgrst, 'reload schema'",
    ]) {
      expect(doc).toContain(expected);
    }

    for (const forbidden of [
      'service_role',
      'drop table',
      'truncate table',
      'delete from',
      'update public.',
    ]) {
      expect(doc.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
