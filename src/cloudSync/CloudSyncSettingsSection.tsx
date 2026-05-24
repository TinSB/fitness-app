import { AccountSettings } from './AccountSettings';
import { CloudAuthCard } from './CloudAuthCard';
import { ConflictReview, type ConflictItem } from './ConflictReview';
import { FirstSyncFlow } from './FirstSyncFlow';
import { OfflineRecovery } from './OfflineRecovery';
import { SyncStatusCenter } from './SyncStatusCenter';

const previewConflictItems: ConflictItem[] = [
  {
    id: 'preview-conflict-training-log',
    field: '训练记录',
    localValue: '本地',
    cloudValue: '云端',
  },
];

export function CloudSyncSettingsSection() {
  return (
    <section className="space-y-4" data-testid="ironpath-cloud-sync-settings-section">
      <div>
        <p className="text-sm font-semibold text-slate-500" data-theme-text="mutedText">账号同步</p>
        <h3 className="mt-1 text-lg font-bold text-slate-950" data-theme-text="cardTitle">云端同步</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600" data-theme-text="secondaryText">
          预览账号与同步状态；本地数据仍会保留，不会自动覆盖本地训练记录。冲突需查看后再决定，可保留本地或使用云端。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CloudAuthCard authStatus="signed_out" />
        <SyncStatusCenter
          syncRuntimeEnabled={false}
          readinessStatus="not_enabled"
          warnings={['开启前先备份']}
        />
        <AccountSettings
          accountEmail={null}
          syncOptIn={false}
          localBackupAvailable={false}
        />

        <details className="rounded-lg border border-white/10 bg-white/[0.04] p-3 xl:col-span-2">
          <summary className="cursor-pointer text-sm font-semibold text-white/80">查看同步流程预览</summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <FirstSyncFlow
              backupReady={false}
              dryRunReady={false}
              explicitOptIn={false}
              canVerify={false}
            />
            <ConflictReview
              conflictCount={1}
              conflictItems={previewConflictItems}
              selectedResolution="review_required"
            />
            <OfflineRecovery
              offlineAvailable
              cloudUnavailable
              rollbackAvailable={false}
              emergencyLocalAvailable
            />
          </div>
        </details>
      </div>
    </section>
  );
}
