// 训练周期 Gap 自动重入状态机 V1
//
// 背景：mesocyclePlan.weeks[i].phase 是 *计划内* 的阶段（基础/构建/过载/减量周），
// 由 startDate 线性推算当前周。该字段不会随用户实际停训而调整 —— 用户停训 14+ 天
// 后回来，UI 与推荐引擎仍然把"减量周"当作 active 状态执行/展示，是不正确的。
//
// 设计原则（automation-first）：
//   - 系统直接计算并应用 activePhase，UI 只显示结果，不显示"原计划阶段 vs 当前建议"
//   - 没有手动 apply 按钮、没有长说明文字、没有 advisory 卡片
//   - persistedPhase 字段保留供数据完整性 / 调试 / 文档使用，但 normal UI 不消费
//   - 所有 surface（Today/Plan/Training/Focus/support plan/exercise prescription/
//     weekly recommendation）一律消费 activePhase + effectiveWeek
//
// 实现策略：
//   - 不修改 mesocyclePlan / AppData / localStorage / cloud sync（持久层零侵入）
//   - 不扩展 CyclePhase 联合类型（避免破坏几十处 phase === 'deload' 判定）
//   - 返回一个合成 MesocycleWeek 对象，让推荐引擎按更保守参数自动运行
//   - phaseForCompatibility 用于必须落到 4-phase CyclePhase 的下游字段
//
// Gap 规则：
//   0–3 天   → activePhase = persisted（continue）
//   4–7 天   → activePhase = persisted（continue，内部 mild caution）
//   8–13 天  → 原 phase ∈ {overload, deload} 时 activePhase = reentry；
//              否则保持原 phase（reentry caution，不强制覆盖）
//   14–27 天 → activePhase = reentry（强制覆盖原 active deload）
//   28+ 天   → activePhase = restart（保守恢复，不显示长 advisory）
//   无历史    → 保持原 phase（safe default）

import type { CyclePhase, IntensityBias, MesocyclePlan, MesocycleWeek, TrainingSession } from '../models/training-model';
import { getCurrentMesocycleWeek } from './mesocycleEngine';
import { todayKey } from './engineUtils';

export type EffectivePhaseKind = CyclePhase | 'reentry' | 'restart';
export type EffectivePhaseMode = 'continue' | 'reentry' | 'restart';
export type EffectivePhaseSeverity = 'none' | 'mild' | 'reentry' | 'restart';

export interface EffectiveTrainingPhase {
  /** 计划内的原始阶段（来自 mesocyclePlan.weeks[i].phase）。保留供数据完整性 / 文档使用。 */
  persistedPhase: CyclePhase;
  /** 计划内的原始周对象（不可变 view）。normal UI 不应直接渲染。 */
  persistedWeek: MesocycleWeek;
  /** 运行时派生阶段标识：含 'reentry' / 'restart' */
  effectivePhase: EffectivePhaseKind;
  /** UI / 推荐链路应消费的"当前实际生效阶段"，等价于 effectivePhase。 */
  activePhase: EffectivePhaseKind;
  /**
   * 兼容字段：必须落到 4-phase CyclePhase 的下游（如 ExercisePrescription.mesocyclePhase）
   * 使用此字段。reentry/restart 时降级为 'base'，确保 type-safe 的同时下游进入更保守路径。
   */
  phaseForCompatibility: CyclePhase;
  /**
   * 运行时合成 MesocycleWeek（phase 字段仍是 CyclePhase，
   * 以保持类型兼容；reentry/restart 时 phase 降为 'base'，
   * 推荐引擎据此自动进入更保守的训练参数）。
   */
  effectiveWeek: MesocycleWeek;
  /** 距上次训练完成的天数（取 latest analytics session） */
  gapDays: number;
  /** 是否覆盖了原 phase（true 表示 activePhase !== persistedPhase 且语义不同） */
  overridden: boolean;
  /** 是否存在训练历史 */
  hasHistory: boolean;
  /**
   * 内部用于推荐链路的处理模式：continue / reentry / restart。
   * UI 不应直接展示给用户，仅供分支判断与调试 / 测试断言。
   */
  mode: EffectivePhaseMode;
  /** 内部 severity：none / mild / reentry / restart */
  severity: EffectivePhaseSeverity;
  /**
   * 紧凑标签（不超过 4 字）。允许的可见值：基础周 / 构建周 / 过载周 / 减量周 / 回归周 / 重新开始。
   * UI 直接渲染此字段。
   */
  compactLabel: string;
}

export interface GetEffectiveTrainingPhaseInput {
  mesocyclePlan?: MesocyclePlan | null;
  history?: TrainingSession[];
  referenceDate?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const COMPACT_LABEL: Record<EffectivePhaseKind, string> = {
  base: '基础周',
  build: '构建周',
  overload: '过载周',
  deload: '减量周',
  reentry: '回归周',
  restart: '重新开始',
};

const parseDateMillis = (value?: string): number | null => {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  const iso = direct ? `${direct[0]}T12:00:00.000Z` : value;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const isAnalyticsSession = (session: TrainingSession) =>
  session.completed !== false && session.dataFlag !== 'test' && session.dataFlag !== 'excluded';

const sessionTimestamp = (session: TrainingSession): number | null =>
  parseDateMillis(session.finishedAt) ?? parseDateMillis(session.startedAt) ?? parseDateMillis(session.date);

/**
 * 计算 history 中最近一次"被纳入分析"的 session 与 referenceDate 的天数差。
 *
 * - 若没有 analytics session，返回 null（调用方按 fresh / 无历史处理）。
 * - 若 referenceDate 早于 latest session（罕见，时区/手动改日期），返回 0。
 */
export const getDaysSinceLastTraining = (
  history: TrainingSession[] = [],
  referenceDate: string = todayKey(),
): { days: number; lastSessionDate: string } | null => {
  const reference = parseDateMillis(referenceDate);
  if (reference === null) return null;
  let latest: { session: TrainingSession; timestamp: number } | null = null;
  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = sessionTimestamp(session);
    if (ts === null) continue;
    if (!latest || ts > latest.timestamp) latest = { session, timestamp: ts };
  }
  if (!latest) return null;
  const diffDays = Math.max(0, Math.round((reference - latest.timestamp) / MS_PER_DAY));
  return { days: diffDays, lastSessionDate: latest.session.date };
};

interface DerivationDecision {
  kind: EffectivePhaseKind;
  mode: EffectivePhaseMode;
  severity: EffectivePhaseSeverity;
  overridden: boolean;
  weekOverride: Pick<MesocycleWeek, 'phase' | 'volumeMultiplier' | 'intensityBias'> | null;
}

const deriveDecision = (
  persistedPhase: CyclePhase,
  gap: { days: number; lastSessionDate: string } | null,
): DerivationDecision => {
  if (!gap) {
    return { kind: persistedPhase, mode: 'continue', severity: 'none', overridden: false, weekOverride: null };
  }

  const days = gap.days;

  if (days >= 28) {
    return {
      kind: 'restart',
      mode: 'restart',
      severity: 'restart',
      overridden: true,
      weekOverride: { phase: 'base', volumeMultiplier: 0.5, intensityBias: 'conservative' },
    };
  }

  if (days >= 14) {
    return {
      kind: 'reentry',
      mode: 'reentry',
      severity: 'reentry',
      overridden: true,
      weekOverride: { phase: 'base', volumeMultiplier: 0.65, intensityBias: 'conservative' },
    };
  }

  if (days >= 8) {
    if (persistedPhase === 'overload' || persistedPhase === 'deload') {
      return {
        kind: 'reentry',
        mode: 'reentry',
        severity: 'reentry',
        overridden: true,
        weekOverride: { phase: 'base', volumeMultiplier: 0.75, intensityBias: 'conservative' },
      };
    }
    return { kind: persistedPhase, mode: 'continue', severity: 'reentry', overridden: false, weekOverride: null };
  }

  if (days >= 4) {
    return { kind: persistedPhase, mode: 'continue', severity: 'mild', overridden: false, weekOverride: null };
  }

  return { kind: persistedPhase, mode: 'continue', severity: 'none', overridden: false, weekOverride: null };
};

/**
 * 主入口：运行时派生 effectiveTrainingPhase。
 *
 * 关键不变量：
 *   - 不修改 mesocyclePlan / history / AppData
 *   - 当无 gap 或 gap 较短时，effectiveWeek === persistedWeek（语义保持）
 *   - 推荐引擎 / UI 把消费 `getCurrentMesocycleWeek(plan)` 的位置改为消费 `effectiveWeek` + `activePhase`
 *   - UI 不应渲染 persistedPhase / persistedWeek 的 phase 文案，必须使用 compactLabel
 */
export const getEffectiveTrainingPhase = (
  input: GetEffectiveTrainingPhaseInput = {},
): EffectiveTrainingPhase => {
  const referenceDate = input.referenceDate ?? todayKey();
  const persistedWeek = getCurrentMesocycleWeek(input.mesocyclePlan ?? undefined, referenceDate);
  const persistedPhase = persistedWeek.phase;
  const gap = getDaysSinceLastTraining(input.history ?? [], referenceDate);
  const hasHistory = gap !== null;
  const decision = deriveDecision(persistedPhase, gap);

  const effectiveWeek: MesocycleWeek = decision.weekOverride
    ? {
        ...persistedWeek,
        phase: decision.weekOverride.phase,
        volumeMultiplier: decision.weekOverride.volumeMultiplier,
        intensityBias: decision.weekOverride.intensityBias as IntensityBias,
      }
    : persistedWeek;

  return {
    persistedPhase,
    persistedWeek,
    effectivePhase: decision.kind,
    activePhase: decision.kind,
    phaseForCompatibility: effectiveWeek.phase,
    effectiveWeek,
    gapDays: gap?.days ?? 0,
    overridden: decision.overridden,
    hasHistory,
    mode: decision.mode,
    severity: decision.severity,
    compactLabel: COMPACT_LABEL[decision.kind],
  };
};

export const EFFECTIVE_PHASE_COMPACT_LABELS: Record<EffectivePhaseKind, string> = COMPACT_LABEL;
