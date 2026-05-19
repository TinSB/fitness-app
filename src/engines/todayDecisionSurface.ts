export type TodayDecisionState =
  | 'train_recommended'
  | 'train_conservative'
  | 'recovery_recommended'
  | 'continue_unfinished'
  | 'blocked_by_severe_risk'
  | 'source_unclear'
  | 'no_plan_available';

export type TodayReadinessState = 'normal' | 'conservative' | 'recovery' | 'unknown';
export type TodayFatigueState = 'normal' | 'elevated' | 'high' | 'unknown';

export type TodaySevereNoticeInput = {
  title?: string;
  message?: string;
};

export type TodayDecisionSurfaceInput = {
  recommendedFocus?: string;
  selectedFocusOverride?: string;
  activeSessionState?: 'none' | 'active' | 'unfinished' | 'completed';
  hasUnfinishedSession?: boolean;
  hasCompletedSession?: boolean;
  readinessState?: TodayReadinessState | string;
  fatigueState?: TodayFatigueState | string;
  recentTrainingFrequency?: string;
  severeDataHealthBlocker?: boolean | TodaySevereNoticeInput;
  backupStatus?: string;
  sourceOfTruthClear?: boolean;
  canStartTraining?: boolean;
  canContinueTraining?: boolean;
  canRecoverTraining?: boolean;
  currentDate?: string;
  noPlanAvailable?: boolean;
  existingPrimaryActionLabel?: string;
  existingDecisionText?: string;
};

export type TodayDecisionSurfaceResult = {
  decisionState: TodayDecisionState;
  heroLabel: string;
  heroTitle: string;
  heroExplanation: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  focusLabel: string;
  readinessLabel: string;
  safetyLabel: string;
  severeNotice?: {
    title: string;
    message: string;
  };
  showFocusOverride: boolean;
  showDataHealthSummary: boolean;
  showFullDiagnostics: false;
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
};

const clean = (value?: string) => String(value || '').replace(/\s+/g, ' ').trim();

const severeNoticeFrom = (notice?: boolean | TodaySevereNoticeInput) => {
  if (!notice) return undefined;
  if (typeof notice === 'boolean') {
    return {
      title: '发现严重数据风险',
      message: '先查看严重问题，再决定是否继续训练。',
    };
  }
  return {
    title: clean(notice.title) || '发现严重数据风险',
    message: clean(notice.message) || '先查看严重问题，再决定是否继续训练。',
  };
};

const conservativeReadiness = (readinessState?: string, fatigueState?: string) =>
  readinessState === 'conservative' ||
  readinessState === 'low' ||
  readinessState === 'red' ||
  readinessState === 'yellow' ||
  fatigueState === 'elevated' ||
  fatigueState === 'high';

const recoveryReadiness = (readinessState?: string) =>
  readinessState === 'recovery' || readinessState === 'rest' || readinessState === 'active_recovery' || readinessState === 'mobility_only';

const baseResult = (input: TodayDecisionSurfaceInput): Pick<
  TodayDecisionSurfaceResult,
  'focusLabel' | 'safetyLabel' | 'showFullDiagnostics' | 'sourceOfTruthChanged' | 'trainingAlgorithmChanged'
> => ({
  focusLabel: clean(input.recommendedFocus) || '暂无训练安排',
  safetyLabel: input.sourceOfTruthClear === false ? '数据来源待确认' : '当前使用本地数据',
  showFullDiagnostics: false,
  sourceOfTruthChanged: false,
  trainingAlgorithmChanged: false,
});

export const buildTodayDecisionSurface = (input: TodayDecisionSurfaceInput): TodayDecisionSurfaceResult => {
  const base = baseResult(input);
  const focusLabel = base.focusLabel;

  if (input.sourceOfTruthClear === false) {
    return {
      ...base,
      decisionState: 'source_unclear',
      heroLabel: '今日结论',
      heroTitle: '先确认本地数据来源',
      heroExplanation: '先回到清晰的本地数据状态。',
      primaryActionLabel: '回到本地模式',
      readinessLabel: '数据来源待确认',
      showFocusOverride: false,
      showDataHealthSummary: false,
    };
  }

  const severeNotice = severeNoticeFrom(input.severeDataHealthBlocker);
  if (severeNotice) {
    return {
      ...base,
      decisionState: 'blocked_by_severe_risk',
      heroLabel: '今日结论',
      heroTitle: '先处理严重风险',
      heroExplanation: '先查看严重问题，再决定是否训练。',
      primaryActionLabel: '查看严重问题',
      secondaryActionLabel: input.canContinueTraining ? '继续训练' : undefined,
      readinessLabel: '存在严重风险',
      severeNotice,
      showFocusOverride: false,
      showDataHealthSummary: true,
    };
  }

  if (input.hasUnfinishedSession || input.activeSessionState === 'active' || input.activeSessionState === 'unfinished') {
    return {
      ...base,
      decisionState: 'continue_unfinished',
      heroLabel: '今日结论',
      heroTitle: `继续 ${focusLabel}`,
      heroExplanation: '当前有未完成训练，先继续记录。',
      primaryActionLabel: '继续训练',
      secondaryActionLabel: input.canStartTraining ? '查看今日建议' : undefined,
      readinessLabel: '训练进行中',
      showFocusOverride: false,
      showDataHealthSummary: false,
    };
  }

  if (input.noPlanAvailable || !clean(input.recommendedFocus)) {
    return {
      ...base,
      decisionState: 'no_plan_available',
      heroLabel: '今日结论',
      heroTitle: '暂无可执行训练安排',
      heroExplanation: '先检查训练计划，再开始训练。',
      primaryActionLabel: '查看计划',
      readinessLabel: '缺少训练安排',
      showFocusOverride: false,
      showDataHealthSummary: false,
    };
  }

  if (input.hasCompletedSession || input.activeSessionState === 'completed') {
    return {
      ...base,
      decisionState: 'recovery_recommended',
      heroLabel: '今日结论',
      heroTitle: '今日训练已完成',
      heroExplanation: '今天已完成训练，下次建议仅供参考。',
      primaryActionLabel: input.existingPrimaryActionLabel || '查看本次训练',
      secondaryActionLabel: '再练一场',
      readinessLabel: '建议恢复',
      showFocusOverride: false,
      showDataHealthSummary: false,
    };
  }

  if (recoveryReadiness(input.readinessState)) {
    return {
      ...base,
      decisionState: 'recovery_recommended',
      heroLabel: '今日结论',
      heroTitle: `今天建议 ${focusLabel}`,
      heroExplanation: '恢复优先，不强制训练。',
      primaryActionLabel: input.existingPrimaryActionLabel || (input.canRecoverTraining ? '开始恢复训练' : '查看恢复建议'),
      secondaryActionLabel: input.canStartTraining ? '仍要训练' : undefined,
      readinessLabel: '建议恢复',
      showFocusOverride: true,
      showDataHealthSummary: false,
    };
  }

  if (conservativeReadiness(input.readinessState, input.fatigueState)) {
    return {
      ...base,
      decisionState: 'train_conservative',
      heroLabel: '今日结论',
      heroTitle: `保守训练：${focusLabel}`,
      heroExplanation: '建议保守训练，保持重量。',
      primaryActionLabel: input.existingPrimaryActionLabel || '开始训练',
      secondaryActionLabel: '查看动作安排',
      readinessLabel: '建议保守',
      showFocusOverride: true,
      showDataHealthSummary: false,
    };
  }

  return {
    ...base,
    decisionState: 'train_recommended',
    heroLabel: '今日结论',
    heroTitle: `今天建议：${focusLabel}`,
    heroExplanation: '状态正常，按计划执行。',
    primaryActionLabel: input.existingPrimaryActionLabel === '开始训练' ? '开始今天训练' : input.existingPrimaryActionLabel || '开始今天训练',
    secondaryActionLabel: '查看动作安排',
    readinessLabel: '状态正常',
    showFocusOverride: true,
    showDataHealthSummary: false,
  };
};
