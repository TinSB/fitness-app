import React, { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { classNames } from '../../engines/engineUtils';
import type { SettingsSafetySummaryResult } from '../../engines/settingsSafetySummary';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';

export type SettingsNavigationTone = 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';

export type SettingsNavigationItem = {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  tone?: SettingsNavigationTone;
  icon: ReactNode;
  content: ReactNode;
};

export type SettingsNavigationGroup = {
  id: string;
  title: string;
  items: SettingsNavigationItem[];
};

export type SettingsNavigationStackProps = {
  summary: SettingsSafetySummaryResult;
  groups: SettingsNavigationGroup[];
  initialSectionId?: string | null;
};

const stateTone: Record<SettingsSafetySummaryResult['overallSafetyState'], UiOsBadgeState> = {
  safe: 'safe',
  review_recommended: 'info',
  caution: 'warning',
  stop: 'danger',
  emergency: 'manual-required',
  incomplete: 'disabled',
};

const stateLabel: Record<SettingsSafetySummaryResult['overallSafetyState'], string> = {
  safe: '本地优先',
  review_recommended: '建议复查',
  caution: '谨慎处理',
  stop: '先暂停',
  emergency: '恢复本地',
  incomplete: '待补全',
};

const toneClassName: Record<SettingsNavigationTone, string> = {
  slate: 'bg-white/8 text-white/72',
  emerald: 'bg-emerald-400/14 text-emerald-200',
  amber: 'bg-amber-400/14 text-amber-200',
  rose: 'bg-rose-400/14 text-rose-200',
  sky: 'bg-sky-400/14 text-sky-200',
  violet: 'bg-violet-400/14 text-violet-200',
};

function flattenGroups(groups: SettingsNavigationGroup[]) {
  return groups.flatMap((group) => group.items);
}

export function SettingsNavigationStack({ summary, groups, initialSectionId = null }: SettingsNavigationStackProps) {
  const items = React.useMemo(() => flattenGroups(groups), [groups]);
  const initialItem = initialSectionId ? items.find((item) => item.id === initialSectionId) : null;
  const [activeId, setActiveId] = React.useState<string | null>(initialItem?.id ?? null);

  React.useEffect(() => {
    if (!initialSectionId) return;
    if (items.some((item) => item.id === initialSectionId)) {
      setActiveId(initialSectionId);
    }
  }, [initialSectionId, items]);

  const activeItem = activeId ? items.find((item) => item.id === activeId) ?? null : null;
  const defaultDetailItem = items.find((item) => item.id === 'diagnostics') ?? items[0] ?? null;
  const detailItem = activeItem ?? defaultDetailItem;

  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]"
      data-settings-navigation-stack
      data-settings-active-section={detailItem?.id ?? 'overview'}
    >
      <div
        className={classNames('min-w-0 space-y-4', activeItem ? 'hidden lg:block' : 'block')}
        data-settings-navigation-list
      >
        <section className="rounded-lg border border-white/10 bg-white/[0.055] p-4 text-white shadow-[0_18px_52px_rgba(0,0,0,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/50">IronPath</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-white">{summary.summaryTitle}</h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/58">{summary.summaryExplanation}</p>
            </div>
            <StatusBadge state={stateTone[summary.overallSafetyState]}>{stateLabel[summary.overallSafetyState]}</StatusBadge>
          </div>

          {summary.highRiskWarnings.length ? (
            <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-100">
              {summary.highRiskWarnings.join(' ')}
            </div>
          ) : null}
        </section>

        {groups.map((group) => (
          <section key={group.id} className="space-y-2" data-settings-ios-group={group.id}>
            <h3 className="px-1 text-xs font-semibold uppercase tracking-normal text-white/38">{group.title}</h3>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.055]">
              {group.items.map((item, index) => {
                const selected = activeItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={classNames(
                      'flex min-h-[68px] w-full items-center gap-3 px-3 py-3 text-left transition active:scale-[0.995]',
                      index > 0 && 'border-t border-white/8',
                      selected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.045]',
                    )}
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => setActiveId(item.id)}
                    data-settings-row={item.id}
                  >
                    <span
                      className={classNames(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                        toneClassName[item.tone || 'slate'],
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-white">{item.title}</span>
                      {item.subtitle ? (
                        <span className="mt-0.5 block line-clamp-2 text-sm leading-5 text-white/45">{item.subtitle}</span>
                      ) : null}
                    </span>
                    {item.value ? <span className="max-w-[7rem] truncate text-sm font-medium text-white/38">{item.value}</span> : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section
        className={classNames('min-w-0 space-y-4', activeItem ? 'block' : 'hidden lg:block')}
        data-settings-navigation-detail
      >
        {detailItem ? (
          <>
            <div className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-3 text-white">
              {activeItem ? (
                <button
                  type="button"
                  className="mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-white/68 transition hover:bg-white/[0.06] lg:hidden"
                  onClick={() => setActiveId(null)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  设置
                </button>
              ) : null}
              <p className="text-sm font-semibold text-white/42">设置</p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-2xl font-semibold tracking-normal text-white">{detailItem.title}</h2>
                {detailItem.value ? <span className="text-sm font-semibold text-white/42">{detailItem.value}</span> : null}
              </div>
              {detailItem.subtitle ? <p className="mt-1 text-sm leading-6 text-white/52">{detailItem.subtitle}</p> : null}
            </div>

            <div className="min-w-0" data-settings-detail-content={detailItem.id}>
              {detailItem.content}
            </div>
          </>
        ) : (
          <section className="rounded-lg border border-white/10 bg-white/[0.055] p-4 text-white" data-settings-detail-empty>
            <p className="text-sm font-semibold text-white/42">设置详情</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-white">本地数据仍会保留</h2>
            <p className="mt-2 text-sm leading-6 text-white/58">
              {summary.safeNextActions[0] || '开启前先备份，云端同步只在你确认后执行。'}
            </p>
          </section>
        )}
      </section>
    </div>
  );
}
