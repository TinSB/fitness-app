export const TERMS = {
  readinessScore: '准备度评分',
  base: '基础周',
  build: '构建周',
  overload: '过载周',
  deload: '减量周',
  mainTraining: '主训练',
  correctionBlock: '纠偏模块',
  functionalBlock: '功能补丁',
  progressionSuggestion: '进阶建议',
  regressionExercise: '回退动作',
  progressionExercise: '进阶动作',
  techniqueQuality: '动作质量',
  painPattern: '不适模式',
  adherence: '完成度',
  weeklyCoachReview: '每周训练总结',
  mesocycle: '训练周期',
  supportLayer: '辅助层',
  weeklyBudget: '周剂量预算',
  topSet: '顶组',
  backoffSet: '回退组',
  RIR: 'RIR',
  RPE: 'RPE',
  oneRm: '1RM',
  ROM: 'ROM',
} as const;

export const PHASE_LABELS = {
  base: '基础周',
  build: '构建周',
  overload: '过载周',
  deload: '减量周',
} as const;

export const INTENSITY_BIAS_LABELS = {
  conservative: '保守',
  normal: '标准',
  aggressive: '积极',
} as const;

export const TECHNIQUE_QUALITY_LABELS = {
  good: '良好',
  acceptable: '可接受',
  poor: '较差',
} as const;

export const SUPPORT_BLOCK_LABELS = {
  correction: '纠偏模块',
  functional: '功能补丁',
} as const;

export const SKIP_REASON_LABELS = {
  time: '时间不足',
  pain: '出现不适',
  equipment: '器械受限',
  forgot: '漏记',
  too_tired: '疲劳过高',
  not_needed: '本次不需要',
  other: '其他原因',
} as const;

export const DELOAD_LEVEL_LABELS = {
  none: '正常推进',
  watch: '观察',
  yellow: '减量观察',
  red: '恢复优先',
} as const;

export const DELOAD_STRATEGY_LABELS = {
  none: '按原计划推进',
  reduce_volume: '下修训练量',
  reduce_accessories: '减少辅助动作',
  recovery_template: '切换到恢复优先安排',
} as const;

export const READINESS_ADJUSTMENT_LABELS = {
  recovery: '恢复优先',
  conservative: '保守训练',
  normal: '正常推进',
  push: '积极推进',
} as const;

export const MUSCLE_LABELS = {
  chest: '胸',
  back: '背',
  legs: '腿',
  shoulders: '肩',
  arms: '手臂',
} as const;

export const term = (key: keyof typeof TERMS) => TERMS[key];
