import { AccountSettings } from './AccountSettings';
import { CloudAuthCard } from './CloudAuthCard';
import { ConflictReview, type ConflictItem } from './ConflictReview';
import { FirstSyncFlow } from './FirstSyncFlow';
import { OfflineRecovery } from './OfflineRecovery';
import { SyncStatusCenter } from './SyncStatusCenter';
import type { AccountSettingsProps } from './AccountSettings';
import type { CloudAuthCardProps } from './CloudAuthCard';
import type { ConflictReviewProps } from './ConflictReview';
import type { FirstSyncFlowProps } from './FirstSyncFlow';
import type { OfflineRecoveryProps } from './OfflineRecovery';
import type { SyncStatusCenterProps } from './SyncStatusCenter';

const previewConflictItems: ConflictItem[] = [
  {
    id: 'preview-conflict-training-log',
    field: '训练记录',
    localValue: '本地',
    cloudValue: '云端',
  },
];

export interface CloudSyncSettingsSectionProps {
  authCard?: CloudAuthCardProps;
  syncStatus?: SyncStatusCenterProps;
  accountSettings?: AccountSettingsProps;
  firstSyncFlow?: FirstSyncFlowProps;
  conflictReview?: ConflictReviewProps;
  offlineRecovery?: OfflineRecoveryProps;
  syncPreflight?: {
    visible: boolean;
    title: string;
    summary: string;
    primaryLabel: string;
    secondaryLabels: string[];
    statusLabel: string;
  };
  eyebrow?: string;
  title?: string;
  description?: string;
  detailSummaryLabel?: string;
}

const defaultPreviewProps = (): Required<CloudSyncSettingsSectionProps> => ({
  eyebrow: '账号同步',
  title: '云端同步',
  description: '预览账号与同步状态；本地数据仍会保留，本地训练记录不会被覆盖。冲突需查看后再决定，可保留本地或使用云端。',
  detailSummaryLabel: '查看同步流程预览',
  authCard: { authStatus: 'signed_out' },
  syncStatus: {
    syncRuntimeEnabled: false,
    readinessStatus: 'not_enabled',
    warnings: ['开启前先备份'],
  },
  accountSettings: {
    accountEmail: null,
    syncOptIn: false,
    localBackupAvailable: false,
  },
  firstSyncFlow: {
    backupReady: false,
    dryRunReady: false,
    explicitOptIn: false,
    canVerify: false,
  },
  conflictReview: {
    conflictCount: 1,
    conflictItems: previewConflictItems,
    selectedResolution: 'review_required',
  },
  offlineRecovery: {
    offlineAvailable: true,
    cloudUnavailable: true,
    rollbackAvailable: false,
    emergencyLocalAvailable: true,
  },
  syncPreflight: {
    visible: false,
    title: '同步预检',
    summary: '本地数据仍会保留',
    primaryLabel: '检查本地数据',
    secondaryLabels: ['开启前先备份', '查看将同步的内容'],
    statusLabel: '准备中',
  },
});

export function CloudSyncSettingsSection(props: CloudSyncSettingsSectionProps = {}) {
  const preview = defaultPreviewProps();
  const authCard = props.authCard ?? preview.authCard;
  const syncStatus = props.syncStatus ?? preview.syncStatus;
  const accountSettings = props.accountSettings ?? preview.accountSettings;
  const firstSyncFlow = props.firstSyncFlow ?? preview.firstSyncFlow;
  const conflictReview = props.conflictReview ?? preview.conflictReview;
  const offlineRecovery = props.offlineRecovery ?? preview.offlineRecovery;
  const syncPreflight = props.syncPreflight ?? preview.syncPreflight;

  return (
    <section className="space-y-4" data-testid="ironpath-cloud-sync-settings-section">
      <div>
        <p className="text-sm font-semibold text-slate-500" data-theme-text="mutedText">
          {props.eyebrow ?? preview.eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-950" data-theme-text="cardTitle">
          {props.title ?? preview.title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600" data-theme-text="secondaryText">
          {props.description ?? preview.description}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CloudAuthCard {...authCard} />
        <SyncStatusCenter {...syncStatus} />
        <AccountSettings {...accountSettings} />

        {syncPreflight.visible ? (
          <div
            className="rounded-lg border border-white/10 bg-white/[0.04] p-4 xl:col-span-2"
            data-testid="ironpath-explicit-sync-preflight"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-white/90">{syncPreflight.title}</h4>
                <p className="mt-1 text-sm leading-6 text-white/60">{syncPreflight.summary}</p>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                {syncPreflight.statusLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-400/12 px-3 py-1.5 text-sm font-semibold text-emerald-200">
                {syncPreflight.primaryLabel}
              </span>
              {syncPreflight.secondaryLabels.map((label) => (
                <span key={label} className="rounded-full bg-white/8 px-3 py-1.5 text-sm font-medium text-white/65">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <details className="rounded-lg border border-white/10 bg-white/[0.04] p-3 xl:col-span-2">
          <summary className="cursor-pointer text-sm font-semibold text-white/80">
            {props.detailSummaryLabel ?? preview.detailSummaryLabel}
          </summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <FirstSyncFlow {...firstSyncFlow} />
            <ConflictReview {...conflictReview} />
            <OfflineRecovery {...offlineRecovery} />
          </div>
        </details>
      </div>
    </section>
  );
}
