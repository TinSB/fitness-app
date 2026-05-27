import React from 'react';
import {
  buildCloudSyncDiagnosticSnapshot,
  formatCloudSyncDiagnosticSnapshot,
  type CloudSyncDiagnosticInputs,
  type CloudSyncDiagnosticSnapshot,
} from '../../diagnostics/cloudSyncDiagnostic';
import {
  readPersistedCloudSyncEnabledReceipt,
  subscribeToCloudSyncFlowStateChanges,
} from '../../storage/localStorageAdapter';

// Subscribe to the cloud-sync-flow envelope so the diagnostic re-renders
// when localStorage flips beneath us (e.g. user just hit 开启同步 in the
// panel, or a cross-tab write fired a storage event). Without this the
// diagnostic memo would be frozen on the inputs from props alone and miss
// receipt-write notifications, defeating the whole point of having a
// readback surface on the iPhone PWA.
const getCloudSyncReceiptSnapshot = (): string | null => readPersistedCloudSyncEnabledReceipt();
const getServerSnapshot = getCloudSyncReceiptSnapshot;

// Collapsible "Account & Sync diagnostic" pane mounted at the bottom of
// CloudSyncPolishSettingsPanel. Default-collapsed so it never gets in the
// way of normal users, but always present so a real-iPhone PWA user can
// expand it, screenshot the values, and tell us exactly which condition
// failed. The values it renders are all safe — short hashes, booleans,
// labels — never tokens, env values, or raw IDs.

export interface CloudSyncDiagnosticPanelProps {
  inputs: CloudSyncDiagnosticInputs;
}

type PaneRowKind = 'boolean' | 'string';

type PaneRow = {
  label: string;
  kind: PaneRowKind;
  value: boolean | string | null;
  tone?: 'ok' | 'warn' | 'bad' | 'info';
};

const ROW_TONE_CLASS: Record<NonNullable<PaneRow['tone']>, string> = {
  ok: 'text-emerald-200',
  warn: 'text-amber-200',
  bad: 'text-rose-200',
  info: 'text-white/72',
};

const formatBoolean = (value: boolean | null): string =>
  value === null ? '—' : value ? '是' : '否';

const formatString = (value: string | null): string => (value === null ? '—' : value);

const renderRow = (row: PaneRow) => {
  const className = ROW_TONE_CLASS[row.tone ?? 'info'];
  const displayValue =
    row.kind === 'boolean' ? formatBoolean(row.value as boolean | null) : formatString(row.value as string | null);
  return (
    <div key={row.label} className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-white/55">{row.label}</span>
      <code className={`text-xs font-mono ${className}`}>{displayValue}</code>
    </div>
  );
};

const toneForReceiptOwnerMatch = (snapshot: CloudSyncDiagnosticSnapshot): PaneRow['tone'] => {
  if (!snapshot.receiptPresent) return 'info';
  if (!snapshot.receiptOwnerPresent) return 'warn';
  return snapshot.receiptOwnerMatches ? 'ok' : 'bad';
};

const toneForUiState = (snapshot: CloudSyncDiagnosticSnapshot): PaneRow['tone'] => {
  switch (snapshot.uiState) {
    case 'enabled':
      return 'ok';
    case 'checking':
      return 'info';
    case 'recovery':
      return 'warn';
    case 'not-enabled':
    default:
      return 'info';
  }
};

const toneForCloudReadOk = (snapshot: CloudSyncDiagnosticSnapshot): PaneRow['tone'] => {
  if (snapshot.cloudReadOk === null) return 'info';
  return snapshot.cloudReadOk ? 'ok' : 'bad';
};

export function CloudSyncDiagnosticPanel({ inputs }: CloudSyncDiagnosticPanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  // Subscribing here re-renders the diagnostic on every receipt write/clear
  // without bypassing the localStorageAdapter boundary. The snapshot itself
  // is rebuilt from the inputs + a fresh localStorage read each render.
  const receiptHash = React.useSyncExternalStore(
    subscribeToCloudSyncFlowStateChanges,
    getCloudSyncReceiptSnapshot,
    getServerSnapshot,
  );
  const snapshot = React.useMemo(
    () => buildCloudSyncDiagnosticSnapshot(inputs),
    // receiptHash participates in the dep list so the memo busts when
    // localStorage flips — the builder reads localStorage internally.
    [inputs, receiptHash],
  );
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = React.useCallback(() => {
    const text = formatCloudSyncDiagnosticSnapshot(snapshot);
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyState('failed');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyState('copied');
        // Brief acknowledgment, then reset so subsequent copies show feedback.
        const handle = window.setTimeout(() => setCopyState('idle'), 1500);
        return () => window.clearTimeout(handle);
      })
      .catch(() => {
        setCopyState('failed');
      });
  }, [snapshot]);

  // We expose the build identifier and uiState on the COLLAPSED row too so
  // the user can confirm "is the PWA on the latest build" without expanding.
  // (Screenshot-friendly: short, one line.)
  return (
    <section
      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
      data-testid="ironpath-cloud-sync-diagnostic"
      data-cloud-sync-diagnostic-ui-state={snapshot.uiState}
      data-cloud-sync-diagnostic-build-sha={snapshot.buildSha}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        data-testid="ironpath-cloud-sync-diagnostic-toggle"
      >
        <span className="flex flex-col">
          <span className="text-xs font-semibold text-white/72">同步诊断</span>
          <span className="text-[11px] text-white/45">
            build={snapshot.buildSha} · state={snapshot.uiState}
          </span>
        </span>
        <span className="text-xs text-white/45">{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-0.5 border-t border-white/8 pt-2">
          {[
            { label: '构建 SHA', kind: 'string', value: snapshot.buildSha, tone: 'info' } satisfies PaneRow,
            { label: '构建时间', kind: 'string', value: snapshot.buildIso || '—', tone: 'info' } satisfies PaneRow,
            { label: '页面来源', kind: 'string', value: snapshot.appUrl, tone: 'info' } satisfies PaneRow,
            { label: '独立 PWA', kind: 'boolean', value: snapshot.isStandalonePwa, tone: 'info' } satisfies PaneRow,
            { label: '已登录', kind: 'boolean', value: snapshot.signedIn, tone: snapshot.signedIn ? 'ok' : 'info' } satisfies PaneRow,
            { label: '鉴权就绪', kind: 'boolean', value: snapshot.authReady, tone: snapshot.authReady ? 'ok' : 'warn' } satisfies PaneRow,
            { label: '当前账号 hash', kind: 'string', value: snapshot.currentUserIdShortHash, tone: 'info' } satisfies PaneRow,
            { label: '本地凭据', kind: 'boolean', value: snapshot.receiptPresent, tone: snapshot.receiptPresent ? 'ok' : 'warn' } satisfies PaneRow,
            { label: '凭据 hash', kind: 'string', value: snapshot.receiptHashShort, tone: 'info' } satisfies PaneRow,
            { label: '凭据账号 hash', kind: 'string', value: snapshot.receiptOwnerShortHash, tone: 'info' } satisfies PaneRow,
            {
              label: '账号一致',
              kind: 'boolean',
              value: snapshot.receiptOwnerMatches,
              tone: toneForReceiptOwnerMatch(snapshot),
            } satisfies PaneRow,
            { label: 'UI 状态', kind: 'string', value: snapshot.uiState, tone: toneForUiState(snapshot) } satisfies PaneRow,
            { label: '列表标签', kind: 'string', value: snapshot.uiRowLabel, tone: toneForUiState(snapshot) } satisfies PaneRow,
            { label: '云端读检', kind: 'boolean', value: snapshot.cloudReadAttempted, tone: 'info' } satisfies PaneRow,
            { label: '云端读检 OK', kind: 'boolean', value: snapshot.cloudReadOk, tone: toneForCloudReadOk(snapshot) } satisfies PaneRow,
            {
              label: '上次状态',
              kind: 'string',
              value: snapshot.lastSyncStatus,
              tone:
                snapshot.lastSyncStatus === 'accepted'
                  ? 'ok'
                  : snapshot.lastSyncStatus === 'conflict_review_required'
                    ? 'warn'
                    : snapshot.lastSyncStatus
                      ? 'bad'
                      : 'info',
            } satisfies PaneRow,
            {
              label: '覆盖按钮',
              kind: 'boolean',
              value: snapshot.overrideButtonShown,
              tone: snapshot.overrideButtonShown ? 'warn' : 'info',
            } satisfies PaneRow,
            {
              label: '拒绝原因',
              kind: 'string',
              value: snapshot.rejectReason,
              tone: snapshot.rejectReason ? 'warn' : 'info',
            } satisfies PaneRow,
          ].map(renderRow)}
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] font-semibold text-white/72 transition hover:bg-white/[0.09]"
            data-testid="ironpath-cloud-sync-diagnostic-copy"
          >
            {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制不可用' : '复制诊断'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
