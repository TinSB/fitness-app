import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCloudSyncDiagnosticSnapshot,
  fingerprintUserId,
  formatCloudSyncDiagnosticSnapshot,
} from '../src/diagnostics/cloudSyncDiagnostic';
import {
  CLOUD_SYNC_FLOW_STORAGE_KEY,
  clearCloudSyncFlowState,
  saveCloudSyncFlowState,
} from '../src/storage/localStorageAdapter';

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

// The diagnostic is the cross-device debugging surface we shipped for the
// Real iPhone PWA root cause investigation. These tests lock down its
// safety contract (no tokens, no env, no raw IDs), its accuracy contract
// (correctly classifies enabled / checking / recovery / not-enabled), and
// the exact wording surfaced on screen so a screenshot from a real iPhone
// can be cross-checked against this file.

describe('cloudSyncDiagnostic snapshot builder', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('fingerprintUserId returns a stable 8-char hex hash and never the raw id', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const a = fingerprintUserId(userId);
    const b = fingerprintUserId(userId);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(a).not.toContain(userId);
    expect(fingerprintUserId(null)).toBeNull();
    expect(fingerprintUserId('')).toBeNull();
  });

  it('classifies as "not-enabled" with reason "no-receipt" when localStorage is empty and auth is ready', () => {
    clearCloudSyncFlowState();
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: '11111111',
      lastSyncAttemptOk: null,
      cloudReadAttempted: false,
      cloudReadOk: null,
    });
    expect(snapshot.uiState).toBe('not-enabled');
    expect(snapshot.uiRowLabel).toBe('未开启');
    expect(snapshot.rejectReason).toBe('no-receipt');
    expect(snapshot.receiptPresent).toBe(false);
    expect(snapshot.lastSyncStatus).toBeNull();
    expect(snapshot.overrideButtonShown).toBe(false);
  });

  it('exposes the Phase21i conflict_review_required status verbatim so the iPhone readback can distinguish conflict from parity_failed', () => {
    clearCloudSyncFlowState();
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: '6b8b4e13',
      lastSyncAttemptOk: false,
      cloudReadAttempted: true,
      cloudReadOk: false,
      lastSyncStatus: 'conflict_review_required',
      overrideButtonShown: true,
    });
    expect(snapshot.lastSyncStatus).toBe('conflict_review_required');
    expect(snapshot.overrideButtonShown).toBe(true);
    const line = formatCloudSyncDiagnosticSnapshot(snapshot);
    expect(line).toContain('lastStatus=conflict_review_required');
    expect(line).toContain('overrideShown=true');
  });

  it('drops a free-form lastSyncStatus value to null so the snapshot never echoes server-side strings', () => {
    clearCloudSyncFlowState();
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: '11111111',
      lastSyncAttemptOk: false,
      cloudReadAttempted: true,
      cloudReadOk: false,
      // Cast through unknown — we are intentionally feeding the diagnostic a
      // value outside the Phase21i union to lock the sanitizer.
      lastSyncStatus: 'TOKEN-SHAPED-LEAK' as unknown as 'accepted',
    });
    expect(snapshot.lastSyncStatus).toBeNull();
    const line = formatCloudSyncDiagnosticSnapshot(snapshot);
    expect(line).toContain('lastStatus=(none)');
    expect(line).not.toContain('TOKEN-SHAPED-LEAK');
  });

  it('classifies as "checking" when auth is loading even with no receipt — never falsely shows 未开启', () => {
    clearCloudSyncFlowState();
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: false,
      authReady: false,
      authenticatedUserIdPresent: false,
      currentUserIdShortHash: null,
      lastSyncAttemptOk: null,
      cloudReadAttempted: false,
      cloudReadOk: null,
    });
    expect(snapshot.uiState).toBe('checking');
    expect(snapshot.uiRowLabel).toBe('检查中');
    expect(snapshot.rejectReason).toBe('auth-loading');
  });

  it('classifies as "enabled" when receipt is present and matches the current user', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt-aa',
        syncedOwnerUserId: 'user-1',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('user-1'),
      lastSyncAttemptOk: true,
      cloudReadAttempted: true,
      cloudReadOk: true,
    });
    expect(snapshot.uiState).toBe('enabled');
    expect(snapshot.uiRowLabel).toBe('已开启');
    expect(snapshot.rejectReason).toBeNull();
    expect(snapshot.receiptPresent).toBe(true);
    expect(snapshot.receiptOwnerMatches).toBe(true);
    expect(snapshot.receiptHashShort).toBe('phase19b-receipt');
  });

  it('classifies as "enabled" when receipt is present but auth is still loading — does not flicker 未开启', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt-aa',
        syncedOwnerUserId: 'user-1',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: false,
      authReady: false,
      authenticatedUserIdPresent: false,
      currentUserIdShortHash: null,
      lastSyncAttemptOk: null,
      cloudReadAttempted: false,
      cloudReadOk: null,
    });
    // Auth is still loading AND receipt is present → use a non-final state
    // ("checking") so the UI does not flash 未开启 before resolving.
    expect(snapshot.uiState).toBe('checking');
    expect(snapshot.uiRowLabel).toBe('检查中');
    expect(snapshot.rejectReason).toBe('auth-loading');
  });

  it('classifies as "recovery" with reason "account-mismatch" when receipt belongs to a different user', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt-aa',
        syncedOwnerUserId: 'user-a',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('user-b'),
      lastSyncAttemptOk: null,
      cloudReadAttempted: false,
      cloudReadOk: null,
    });
    expect(snapshot.uiState).toBe('recovery');
    expect(snapshot.uiRowLabel).toBe('需恢复');
    expect(snapshot.rejectReason).toBe('account-mismatch');
    expect(snapshot.receiptOwnerMatches).toBe(false);
  });

  it('classifies as "recovery" with reason "last-sync-failed" when the panel reports an unsuccessful sync result', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt-aa',
        syncedOwnerUserId: 'user-1',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('user-1'),
      lastSyncAttemptOk: false,
      cloudReadAttempted: true,
      cloudReadOk: false,
    });
    expect(snapshot.uiState).toBe('recovery');
    expect(snapshot.rejectReason).toBe('last-sync-failed');
  });

  it('treats legacy envelopes without syncedOwnerUserId as belonging to the current user', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt-aa',
        syncedOwnerUserId: null,
        syncedAt: null,
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('user-1'),
      lastSyncAttemptOk: null,
      cloudReadAttempted: false,
      cloudReadOk: null,
    });
    expect(snapshot.uiState).toBe('enabled');
    expect(snapshot.receiptOwnerMatches).toBe(true);
    expect(snapshot.receiptOwnerPresent).toBe(false);
  });

  it('format() produces a single line of key=value pairs and never leaks the raw userId or receipt hash', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-very-long-receipt-1234567890abcdef',
        syncedOwnerUserId: '550e8400-e29b-41d4-a716-446655440000',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('550e8400-e29b-41d4-a716-446655440000'),
      lastSyncAttemptOk: true,
      cloudReadAttempted: true,
      cloudReadOk: true,
    });
    const line = formatCloudSyncDiagnosticSnapshot(snapshot);
    expect(line).not.toContain('\n');
    expect(line).toContain('build=');
    expect(line).toContain('signedIn=');
    expect(line).toContain('receiptHash=');
    expect(line).toContain('ownerHash=');
    // Raw values must not leak.
    expect(line).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(line).not.toContain('phase19b-very-long-receipt-1234567890abcdef');
    // Short hash IS allowed (max 16 chars of the receipt, 8 hex of userId).
    expect(line).toContain('phase19b-very-lo');
  });

  it('snapshot exposes only safe primitives — never tokens, env values, AppData, or whole IDs', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: '{"history":[{"id":"sess-1"}]}',
        syncedAppDataHash: 'phase19b-aaaaaaaa-1234',
        syncedOwnerUserId: 'TOKEN-SHAPED-VALUE-aaaaaaaaaaaaaaaaaaaa',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('TOKEN-SHAPED-VALUE-aaaaaaaaaaaaaaaaaaaa'),
      lastSyncAttemptOk: true,
      cloudReadAttempted: true,
      cloudReadOk: true,
    });
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('TOKEN-SHAPED-VALUE-aaaaaaaaaaaaaaaaaaaa');
    expect(json).not.toContain('"history"');
    expect(json).not.toContain('sess-1');
    expect(json).not.toContain('phase19b-aaaaaaaa-1234');
    // Allowed: the first 16 chars of the receipt hash (not the full one).
    // 'phase19b' is 8 chars, dash is 1, leaving 7 chars of the body.
    expect(json).toContain('phase19b-aaaaaaa');
    expect(json).not.toContain('phase19b-aaaaaaaa');
  });

  it('cloudReadAttempted=false and cloudReadOk=null are surfaced as separate signals', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );
    const snapshot = buildCloudSyncDiagnosticSnapshot({
      signedIn: true,
      authReady: true,
      authenticatedUserIdPresent: true,
      currentUserIdShortHash: fingerprintUserId('user-1'),
      lastSyncAttemptOk: null,
      cloudReadAttempted: false,
      cloudReadOk: null,
    });
    expect(snapshot.cloudReadAttempted).toBe(false);
    expect(snapshot.cloudReadOk).toBeNull();
    const line = formatCloudSyncDiagnosticSnapshot(snapshot);
    expect(line).toContain('cloudReadOk=(n/a)');
  });
});

describe('cloudSyncDiagnostic — receipt envelope key is the same one the panel reads', () => {
  beforeEach(() => { installMemoryStorage(); });
  afterEach(() => { uninstallStorage(); });

  it('reads the canonical storage key (locks the contract — never invent a second key)', () => {
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    expect(CLOUD_SYNC_FLOW_STORAGE_KEY).toBe('ironpath_cloud_sync_flow_state_v1');
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).toBeNull();
  });
});
