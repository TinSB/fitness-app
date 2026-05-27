// Diagnostic snapshot for the Account & Sync persistence flow.
//
// The V2 root-cause investigation needed a way to inspect on a REAL iPhone
// PWA (Chrome smoke + jsdom-free vitest cannot reproduce the failure)
// exactly which boolean / hash differs from expectation. This module
// produces a structured snapshot that:
//
//   - encodes only SAFE values (no tokens, no env, no service-role keys,
//     no raw AppData, no full Supabase userId — at most the first 8 hex
//     chars of a non-secret content hash).
//   - is render-time pure: no localStorage writes, no network calls, no
//     React state changes. Safe to call from `useMemo` inside the panel.
//   - keys ALL fields by short, human-readable names so a screenshot of
//     the diagnostic communicates everything a developer needs without
//     scrolling.
//
// The snapshot is consumed by `CloudSyncDiagnosticPanel` (a collapsible
// section at the bottom of CloudSyncPolishSettingsPanel). It is also
// callable from tests so the V2 doc and regression suite can lock the
// exact diagnostic shape.

import {
  loadCloudSyncFlowState,
  readPersistedCloudSyncEnabledReceipt,
} from '../storage/localStorageAdapter';

export type CloudSyncDiagnosticRejectReason =
  | 'auth-loading'
  | 'auth-signed-out'
  | 'account-mismatch'
  | 'no-receipt'
  | 'last-sync-failed'
  | null;

export type CloudSyncDiagnosticUiState =
  | 'enabled'
  | 'checking'
  | 'not-enabled'
  | 'recovery';

// Whitelist of safe Phase21i status strings. Anything not in this set is
// dropped to null on its way into the diagnostic — the snapshot must never
// echo a free-form server response that could carry PII or tokens.
export type CloudSyncDiagnosticLastSyncStatus =
  | 'disabled'
  | 'preflight_not_ready'
  | 'backup_dry_run_not_ready'
  | 'shadow_candidate_blocked'
  | 'cloud_read_blocked'
  | 'conflict_review_required'
  | 'upload_blocked'
  | 'upload_failed'
  | 'parity_failed'
  | 'accepted';

const CLOUD_SYNC_DIAGNOSTIC_LAST_SYNC_STATUS_VALUES: ReadonlySet<CloudSyncDiagnosticLastSyncStatus> =
  new Set<CloudSyncDiagnosticLastSyncStatus>([
    'disabled',
    'preflight_not_ready',
    'backup_dry_run_not_ready',
    'shadow_candidate_blocked',
    'cloud_read_blocked',
    'conflict_review_required',
    'upload_blocked',
    'upload_failed',
    'parity_failed',
    'accepted',
  ]);

const sanitizeLastSyncStatus = (
  value: unknown,
): CloudSyncDiagnosticLastSyncStatus | null => {
  if (typeof value !== 'string') return null;
  return CLOUD_SYNC_DIAGNOSTIC_LAST_SYNC_STATUS_VALUES.has(
    value as CloudSyncDiagnosticLastSyncStatus,
  )
    ? (value as CloudSyncDiagnosticLastSyncStatus)
    : null;
};

export interface CloudSyncDiagnosticInputs {
  // Auth (booleans only — never propagate the userId itself).
  signedIn: boolean;
  authReady: boolean;
  authenticatedUserIdPresent: boolean;
  // The first 8 chars of the SHA-stable Supabase userId hash. Optional —
  // pass null when authRuntime is null. Never pass the raw userId.
  currentUserIdShortHash: string | null;
  // Last-attempt result from runProductionFullAcceptanceSync, if any.
  lastSyncAttemptOk: boolean | null;
  // Cloud read-back reachability from the most recent sync attempt this
  // mount. Optional — null when no attempt has been made yet.
  cloudReadAttempted: boolean;
  cloudReadOk: boolean | null;
  // The Phase21i status string returned by the most recent sync attempt.
  // Only the whitelisted union values above survive into the snapshot —
  // arbitrary strings (or PII-shaped values) are dropped to null. This is
  // the field the V3 iPhone readback uses to distinguish conflict from
  // parity_failed / upload_blocked / etc., which the V2 diagnostic could
  // not tell apart (cloudReadOk=否 conflates them all).
  lastSyncStatus?: CloudSyncDiagnosticLastSyncStatus | null;
  // True iff the user has already seen the "云端有冲突" notice in this
  // session, i.e. the panel exposed the dedicated override button. Lets
  // the next iPhone readback prove whether V3's banner actually surfaced.
  overrideButtonShown?: boolean;
}

export interface CloudSyncDiagnosticSnapshot {
  // ── build identity ──
  buildSha: string;
  buildIso: string;
  appUrl: string | null;
  isStandalonePwa: boolean;
  // ── auth ──
  signedIn: boolean;
  authReady: boolean;
  hasUserId: boolean;
  currentUserIdShortHash: string | null;
  // ── localStorage receipt ──
  receiptPresent: boolean;
  receiptHashPresent: boolean;
  receiptOwnerPresent: boolean;
  receiptHashShort: string | null;
  receiptOwnerShortHash: string | null;
  receiptOwnerMatches: boolean;
  // ── UI computed state ──
  uiState: CloudSyncDiagnosticUiState;
  uiRowLabel: string;
  // ── cloud reachability ──
  cloudReadAttempted: boolean;
  cloudReadOk: boolean | null;
  // The Phase21i status string from the most recent attempt — sanitized
  // to a whitelist so the snapshot never echoes a free-form server value.
  lastSyncStatus: CloudSyncDiagnosticLastSyncStatus | null;
  // True iff the panel surfaced the V3 "用本地覆盖云端" override prompt
  // for this attempt. Mirrors the user-visible affordance.
  overrideButtonShown: boolean;
  // ── reason annotation ──
  rejectReason: CloudSyncDiagnosticRejectReason;
}

// Short, NON-CRYPTOGRAPHIC hash. Used only to fingerprint a userId so two
// devices can compare "do you see the same hash as me" without ever
// exchanging the actual userId. 32-bit FNV-1a, identical to the algorithm
// used by buildAppDataSnapshotHash so the output shape is consistent.
const shortHashFromText = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const fingerprintUserId = (userId: string | null | undefined): string | null => {
  if (typeof userId !== 'string' || userId.length === 0) return null;
  return shortHashFromText(userId);
};

const isStandalonePwaEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  // iOS standalone PWA: navigator.standalone is the canonical signal.
  // Other browsers (incl. Android Chrome) use display-mode media query.
  const iosStandalone =
    typeof (navigator as unknown as { standalone?: boolean }).standalone === 'boolean'
      ? Boolean((navigator as unknown as { standalone?: boolean }).standalone)
      : false;
  let displayModeStandalone = false;
  try {
    displayModeStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    displayModeStandalone = false;
  }
  return iosStandalone || displayModeStandalone;
};

const safeAppUrl = (): string | null => {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return null;
  // location.origin alone is safe — no query params, no auth tokens.
  return window.location.origin;
};

const buildSha = (): string => {
  try {
    if (typeof __IRONPATH_BUILD_SHA__ === 'string') return __IRONPATH_BUILD_SHA__;
  } catch {
    // __IRONPATH_BUILD_SHA__ is only defined at build time; tests run
    // unbundled so it may be undeclared — fall through.
  }
  return 'dev';
};

const buildIso = (): string => {
  try {
    if (typeof __IRONPATH_BUILD_ISO__ === 'string') return __IRONPATH_BUILD_ISO__;
  } catch {
    /* see buildSha() */
  }
  return '';
};

export const buildCloudSyncDiagnosticSnapshot = (
  inputs: CloudSyncDiagnosticInputs,
): CloudSyncDiagnosticSnapshot => {
  const persisted = loadCloudSyncFlowState({});
  const receiptHash = readPersistedCloudSyncEnabledReceipt();
  const receiptOwner = persisted.syncedOwnerUserId;
  const receiptHashShort = typeof receiptHash === 'string' ? receiptHash.slice(0, 16) : null;
  const receiptOwnerShortHash = fingerprintUserId(receiptOwner);
  // Per-account match: pass if EITHER side is null (auth-loading, legacy
  // envelope) OR both present and equal.
  const receiptOwnerMatches =
    receiptOwner === null || !inputs.authenticatedUserIdPresent
      ? true
      : receiptOwnerShortHash === inputs.currentUserIdShortHash;

  let uiState: CloudSyncDiagnosticUiState;
  let rejectReason: CloudSyncDiagnosticRejectReason = null;
  if (inputs.lastSyncAttemptOk === false) {
    uiState = 'recovery';
    rejectReason = 'last-sync-failed';
  } else if (!receiptHash) {
    // No receipt at all → distinguish auth-loading (show "checking") from
    // genuinely-not-enabled.
    if (!inputs.authReady) {
      uiState = 'checking';
      rejectReason = 'auth-loading';
    } else {
      uiState = 'not-enabled';
      rejectReason = 'no-receipt';
    }
  } else if (!receiptOwnerMatches) {
    uiState = 'recovery';
    rejectReason = 'account-mismatch';
  } else if (!inputs.authReady) {
    // We have a receipt but auth is still resolving. Keep "checking" instead
    // of flashing 已开启 then potentially flipping to 未开启 if auth fails.
    uiState = 'checking';
    rejectReason = 'auth-loading';
  } else {
    uiState = 'enabled';
  }

  const uiRowLabel =
    uiState === 'enabled'
      ? '已开启'
      : uiState === 'checking'
        ? '检查中'
        : uiState === 'recovery'
          ? '需恢复'
          : '未开启';

  return {
    buildSha: buildSha(),
    buildIso: buildIso(),
    appUrl: safeAppUrl(),
    isStandalonePwa: isStandalonePwaEnvironment(),
    signedIn: inputs.signedIn,
    authReady: inputs.authReady,
    hasUserId: inputs.authenticatedUserIdPresent,
    currentUserIdShortHash: inputs.currentUserIdShortHash,
    receiptPresent: receiptHash !== null,
    receiptHashPresent: receiptHash !== null,
    receiptOwnerPresent: receiptOwner !== null,
    receiptHashShort,
    receiptOwnerShortHash,
    receiptOwnerMatches,
    uiState,
    uiRowLabel,
    cloudReadAttempted: inputs.cloudReadAttempted,
    cloudReadOk: inputs.cloudReadOk,
    lastSyncStatus: sanitizeLastSyncStatus(inputs.lastSyncStatus ?? null),
    overrideButtonShown: inputs.overrideButtonShown === true,
    rejectReason,
  };
};

// Public helper for copy-to-clipboard. Renders the snapshot as a single
// line of `key=value` pairs so a user can screenshot or paste into chat.
export const formatCloudSyncDiagnosticSnapshot = (
  snapshot: CloudSyncDiagnosticSnapshot,
): string => {
  const pairs: [string, string | number | boolean | null][] = [
    ['build', snapshot.buildSha],
    ['url', snapshot.appUrl ?? '(unknown)'],
    ['pwa', snapshot.isStandalonePwa],
    ['signedIn', snapshot.signedIn],
    ['authReady', snapshot.authReady],
    ['userId?', snapshot.hasUserId],
    ['userIdHash', snapshot.currentUserIdShortHash ?? '(none)'],
    ['receipt?', snapshot.receiptPresent],
    ['receiptHash', snapshot.receiptHashShort ?? '(none)'],
    ['ownerHash', snapshot.receiptOwnerShortHash ?? '(none)'],
    ['ownerMatch', snapshot.receiptOwnerMatches],
    ['ui', snapshot.uiState],
    ['row', snapshot.uiRowLabel],
    ['cloudRead?', snapshot.cloudReadAttempted],
    ['cloudReadOk', snapshot.cloudReadOk === null ? '(n/a)' : snapshot.cloudReadOk],
    ['lastStatus', snapshot.lastSyncStatus ?? '(none)'],
    ['overrideShown', snapshot.overrideButtonShown],
    ['reject', snapshot.rejectReason ?? '(none)'],
  ];
  return pairs.map(([k, v]) => `${k}=${String(v)}`).join(' ');
};
