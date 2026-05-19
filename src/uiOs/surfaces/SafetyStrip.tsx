import type { CSSProperties } from 'react';

export type SafetyState = 'local-ok' | 'backup-suggested' | 'cloud-paused' | 'emergency-ready' | 'source-unclear';

type SafetyConfig = {
  text: string;
  marker: string;
  color: string;
  bg: string;
};

const safetyConfigs: Record<SafetyState, SafetyConfig> = {
  'local-ok': {
    marker: 'local',
    text: '当前使用本地数据',
    color: 'text-emerald-400',
    bg: 'rgba(52, 199, 89, 0.08)',
  },
  'backup-suggested': {
    marker: 'backup',
    text: '建议备份本地数据',
    color: 'text-amber-400',
    bg: 'rgba(255, 159, 10, 0.08)',
  },
  'cloud-paused': {
    marker: 'manual',
    text: '云端候选已暂停，需手动确认',
    color: 'text-orange-400',
    bg: 'rgba(255, 149, 0, 0.08)',
  },
  'emergency-ready': {
    marker: 'emergency',
    text: '紧急本地模式可用',
    color: 'text-blue-400',
    bg: 'rgba(10, 132, 255, 0.08)',
  },
  'source-unclear': {
    marker: 'review',
    text: '数据来源待确认',
    color: 'text-white/40',
    bg: 'rgba(255, 255, 255, 0.04)',
  },
};

export type SafetyStripProps = {
  state?: SafetyState;
  includeSecondaryCopy?: boolean;
};

export function SafetyStrip({ state = 'local-ok', includeSecondaryCopy = false }: SafetyStripProps) {
  const config = safetyConfigs[state];
  const style: CSSProperties = { background: config.bg };

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl" style={style}>
      <span className={`text-[10px] uppercase tracking-widest ${config.color}`}>{config.marker}</span>
      <span className="text-sm text-white/60">{config.text}</span>
      {includeSecondaryCopy ? (
        <>
          <span className="text-white/25">/</span>
          <span className="text-sm text-white/45">云端候选不会自动同步</span>
          <span className="text-white/25">/</span>
          <span className="text-sm text-white/45">本地训练记录仍可继续</span>
        </>
      ) : null}
    </div>
  );
}
