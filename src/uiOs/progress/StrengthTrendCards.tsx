import type { ProgressStrengthTrendItem } from '../../engines/progressClaritySummary';
import { classNames } from '../../engines/engineUtils';
import { GlassCard } from '../primitives/GlassCard';
import { StatusBadge, type UiOsBadgeState } from '../primitives/StatusBadge';

type StrengthTrendCardsProps = {
  items: ProgressStrengthTrendItem[];
  onSelectItem?: (id: string) => void;
};

const trendLabel: Record<ProgressStrengthTrendItem['trend'], string> = {
  improving: '趋势上升',
  stable: '稳定',
  declining: '趋势下降',
  mixed: '信号混合',
  unknown: '数据不足',
};

const trendState: Record<ProgressStrengthTrendItem['trend'], UiOsBadgeState> = {
  improving: 'safe',
  stable: 'info',
  declining: 'warning',
  mixed: 'warning',
  unknown: 'disabled',
};

export function StrengthTrendCards({ items, onSelectItem }: StrengthTrendCardsProps) {
  return (
    <section aria-label="Strength trend PR e1RM cards" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white" data-theme-text="sectionTitle" data-heading-contrast="high">力量趋势 / PR / e1RM</p>
          <h3 className="text-lg font-bold text-white" data-theme-text="sectionTitle" data-heading-contrast="high">主要动作快速判断</h3>
        </div>
        <span className="text-xs font-semibold text-white/35">只读现有计算</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.length ? (
          items.map((item) => (
            <GlassCard
              key={item.id}
              as="article"
              padding="md"
              className={classNames('text-white', onSelectItem ? 'cursor-pointer' : '')}
              onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
              ariaLabel={`${item.label} strength trend`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white/45">{item.label}</p>
                  <p className="mt-2 text-xl font-bold text-white">{item.currentLabel}</p>
                </div>
                <StatusBadge state={trendState[item.trend]}>{trendLabel[item.trend]}</StatusBadge>
              </div>
              {item.bestLabel ? <p className="mt-2 text-xs text-white/45">历史参考：{item.bestLabel}</p> : null}
              <p className="mt-3 text-sm leading-6 text-white/62">{item.explanation}</p>
            </GlassCard>
          ))
        ) : (
          <GlassCard as="article" padding="md" className="text-white md:col-span-2 xl:col-span-4" ariaLabel="Strength trend empty">
            <p className="text-sm font-semibold text-white/70">主要动作数据不足</p>
            <p className="mt-2 text-sm leading-6 text-white/50">完成正式训练后，这里会显示 PR / e1RM 快速入口。</p>
          </GlassCard>
        )}
      </div>
    </section>
  );
}
