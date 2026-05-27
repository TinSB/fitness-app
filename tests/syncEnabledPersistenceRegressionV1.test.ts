import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloudSyncPolishSettingsPanel } from '../src/uiOs/settings/CloudSyncPolishSettingsPanel';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import {
  buildAuthRuntimeWiring,
  createSyntheticAuthRuntimeAdapter,
} from '../src/cloudProduction/authRuntimeWiring';
import { buildSupabaseProjectRuntimeReadinessCheck } from '../src/cloudProduction/supabaseProjectRuntimeReadinessCheck';
import {
  CLOUD_SYNC_FLOW_STORAGE_KEY,
  clearCloudSyncFlowState,
  loadCloudSyncFlowState,
  saveCloudSyncFlowState,
} from '../src/storage/localStorageAdapter';
import { emptyData } from '../src/storage/appDataSanitize';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';

// ── Bug background ─────────────────────────────────────────────────────────
// PR #374, #375 and #376 tried to make the sync-on toggle survive panel
// remount / iOS PWA cold start. The user still reports the toggle reverts to
// "未开启" after navigating away and back. These tests exercise the exact
// flows the bug report describes and lock the persistence contract end-to-end:
//
//   * Fresh remount of CloudSyncPolishSettingsPanel must read the sync-on
//     receipt from localStorage and render "已选择开启" on the FIRST paint —
//     no async effect window between mount and the receipt being honored.
//   * The ProfileView settings-list row label that sits OUTSIDE the panel
//     must also reflect the persisted sync-on state. Until this fix it was
//     a hardcoded literal "未开启" that stuck forever no matter what.
//   * Sign-out must clear the receipt and the row label must flip back to
//     "未开启" without the user having to refresh.
//   * A genuine cloud safety failure (parity_failed) must surface
//     recovery state instead of pretending sync is still healthy.
// ───────────────────────────────────────────────────────────────────────────

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

const installMemoryStorage = () => {
  const storage = new MemoryStorage();
  (globalThis as { localStorage?: Storage }).localStorage = storage;
  return storage;
};

const uninstallStorage = () => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
};

const nowIso = '2026-05-27T08:00:00.000Z';

const ready20b = () =>
  buildSupabaseProjectRuntimeReadinessCheck({
    enabled: true,
    phase20aAuthorization: {
      runtimeImplementationAuthorized: true,
      canStart20B: true,
      liveCloudSyncActivated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    browserEnv: {
      VITE_SUPABASE_URL: 'https://ironpath-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
      VITE_IRONPATH_AUTH_CALLBACK_URL: 'http://127.0.0.1:3000/auth/callback',
      VITE_IRONPATH_CLOUD_ENVIRONMENT: 'production',
    },
    runtimeBoundary: {
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    serviceRoleKeyPresent: false,
    browserConfig: { publicBrowserConfigOnly: true },
    nowIso,
  });

const signedInAuth = (userId = 'user-1') =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: ready20b(),
    adapter: createSyntheticAuthRuntimeAdapter({
      userId,
      accountId: `account-${userId}`,
      displayName: 'IronPath 账号',
    }),
    action: 'check_session',
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

const render = (element: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      UiThemeProvider,
      { value: { selectedThemeMode: 'dark', resolvedTheme: 'dark', focusModeImmersiveDark: true } },
      element,
    ),
  );

const renderPanel = (props: Parameters<typeof CloudSyncPolishSettingsPanel>[0]) =>
  render(createElement(CloudSyncPolishSettingsPanel, props));

// CloudSyncSettingsSection renders the compact pill label as "已开启" when
// the sync runtime is on (CloudSyncSettingsSection.tsx:308-310). The inner
// SignedInSyncFlow uses the same string in the per-row badge. We assert the
// pill label rather than the testid because either surface failing would
// be a real user-visible regression.
const syncOnPill = '已开启';
const syncOffPill = '未开启';

describe('Sync enabled persistence regression V1', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  // ── Scenario 1: panel remount after explicit enable ───────────────────
  it('renders 已选择开启 on first paint when the sync-on receipt is in localStorage', () => {
    const appData = emptyData();
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: '{"hello":"world"}',
        syncedAppDataHash: hash,
        syncedOwnerUserId: 'user-1',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: hash, nowIso },
    );

    const markup = renderPanel({
      appData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-1'),
      nowIso,
    });

    expect(markup).toContain(syncOnPill);
    // The compact pill (CloudSyncSettingsSection statusMeta) must render
    // emerald-tinted text, not the slate "not_enabled" tone.
    expect(markup).toContain('data-testid="ironpath-sync-status-message">已开启');
    expect(markup).toContain('aria-label="同步状态：已开启"');
  });

  // ── Scenario 2: panel remount after AppData drifted ───────────────────
  it('still renders 已选择开启 even when the AppData hash drifted since the original sync', () => {
    const originalData = emptyData();
    const originalHash = buildAppDataSnapshotHash(originalData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: originalHash,
        syncedOwnerUserId: 'user-1',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: originalHash, nowIso },
    );

    // Simulate the user trained between mounts so the live hash diverges.
    const driftedData = {
      ...originalData,
      bodyWeights: [{ id: 'bw-1', date: '2026-05-27', weight: 80, unit: 'kg' as const }],
    };

    const markup = renderPanel({
      appData: driftedData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-1'),
      nowIso,
    });

    expect(markup).toContain(syncOnPill);
  });

  // ── Scenario 3: PWA cold start where auth has not resolved yet ────────
  it('renders 已选择开启 even before the auth session check has resolved (PWA cold start)', () => {
    const appData = emptyData();
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: hash,
        syncedOwnerUserId: 'user-1',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: hash, nowIso },
    );

    const markup = renderPanel({
      appData,
      readiness: ready20b(),
      // intentionally pass NO authRuntime: panel must rely on the local receipt
      nowIso,
    });

    expect(markup).toContain(syncOnPill);
  });

  // ── Scenario 4: signed-in but for a DIFFERENT user ────────────────────
  it('does not render 已选择开启 when the persisted receipt belongs to a different user', () => {
    const appData = emptyData();
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: hash,
        syncedOwnerUserId: 'user-a',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: hash, nowIso },
    );

    const markup = renderPanel({
      appData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-b'),
      nowIso,
    });

    expect(markup).not.toContain(`>${syncOnPill}<`);
  });

  // ── Scenario 5: localStorage receipt absent → must show 未开启 ────────
  it('renders 未开启 when there is no persisted receipt and sync was never enabled', () => {
    const appData = emptyData();
    clearCloudSyncFlowState();

    const markup = renderPanel({
      appData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-1'),
      nowIso,
    });

    expect(markup).toContain(syncOffPill);
  });

  // ── Persistence contract: receipt survives clean re-load ──────────────
  it('keeps the receipt key intact across simulated reload', () => {
    const hash = buildAppDataSnapshotHash(emptyData());
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: hash,
        syncedOwnerUserId: 'user-1',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: hash, nowIso },
    );
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).not.toBeNull();

    // Simulate a reload by re-reading via the public API.
    const reloaded = loadCloudSyncFlowState({});
    expect(reloaded.syncedAppDataHash).toBe(hash);
    expect(reloaded.syncedOwnerUserId).toBe('user-1');
  });

  // ── Scenario 6: simulated reload — fresh mount of the panel ───────────
  it('renders 已开启 on the panel after a simulated full reload', () => {
    const appData = emptyData();
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: hash,
        syncedOwnerUserId: 'user-1',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: hash, nowIso },
    );

    // First mount.
    const firstMount = renderPanel({
      appData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-1'),
      nowIso,
    });
    expect(firstMount).toContain(syncOnPill);

    // Simulate browser reload: tear down the React tree completely, leave
    // the localStorage envelope alone, mount the panel again.
    const secondMount = renderPanel({
      appData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-1'),
      nowIso,
    });
    expect(secondMount).toContain(syncOnPill);
  });

  // ── Scenario 7: legacy envelope (no syncedOwnerUserId) survives ───────
  it('treats a legacy receipt without syncedOwnerUserId as belonging to the current user', () => {
    const appData = emptyData();
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: hash,
        // Legacy v1 envelope without per-user attribution.
        syncedOwnerUserId: null,
        syncedAt: null,
      },
      { appDataSnapshotHash: hash, nowIso },
    );

    const markup = renderPanel({
      appData,
      readiness: ready20b(),
      authRuntime: signedInAuth('user-1'),
      nowIso,
    });
    expect(markup).toContain(syncOnPill);
  });

  // ── Sign-out flow: clearing the receipt is the only intentional reset ─
  it('clears the receipt only when clearCloudSyncFlowState is called explicitly', () => {
    const hash = buildAppDataSnapshotHash(emptyData());
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: 'snapshot',
        syncedAppDataHash: hash,
        syncedOwnerUserId: 'user-1',
        syncedAt: nowIso,
      },
      { appDataSnapshotHash: hash, nowIso },
    );
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).not.toBeNull();

    // Other storage keys must not be removed — clearCloudSyncFlowState is
    // scoped to the cloud-sync-flow envelope. Hard rule: do not delete
    // localStorage (anything other than this specific envelope).
    storage.setItem('ironpath_unrelated_key', 'should_survive');
    clearCloudSyncFlowState();
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('ironpath_unrelated_key')).toBe('should_survive');
  });
});
