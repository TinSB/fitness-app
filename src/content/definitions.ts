export const DEFINITIONS = {
  readinessScore: {
    title: '准备度评分',
    body: '把睡眠、精力、酸痛、不适和可训练时间合并成 0-100 分，用来判断今天更适合推进、维持还是保守训练。',
  },
  rir: {
    title: 'RIR（剩余可完成次数）',
    body: 'RIR 表示一组结束时大约还剩余几次能完成。多数工作组控制在 RIR 1-3，可兼顾训练刺激和动作质量。',
  },
  RIR: {
    title: 'RIR（剩余可完成次数）',
    body: 'RIR 表示一组结束时大约还剩余几次能完成。多数工作组控制在 RIR 1-3，可兼顾训练刺激和动作质量。',
  },
  rpe: {
    title: 'RPE（主观用力程度）',
    body: 'RPE 是 1-10 分的主观用力评分。分数越高，表示越接近力竭。',
  },
  RPE: {
    title: 'RPE（主观用力程度）',
    body: 'RPE 是 1-10 分的主观用力评分。分数越高，表示越接近力竭。',
  },
  oneRm: {
    title: '1RM（理论单次最大重量）',
    body: '1RM 是理论上只能完成 1 次的最大重量。本系统优先用高质量工作组估算 e1RM；历史数据不足时不会输出精确公斤数。',
  },
  oneRmPercent: {
    title: '1RM 百分比',
    body: '1RM 百分比只用于估算负荷区间。实际训练仍以目标次数、RIR、动作质量和不适记录为准。',
  },
  rom: {
    title: 'ROM（动作幅度）',
    body: 'ROM 指关节和动作完成的有效幅度。同样重量下，完整、稳定的幅度比更重但变形的动作更有参考价值。',
  },
  ROM: {
    title: 'ROM（动作幅度）',
    body: 'ROM 指关节和动作完成的有效幅度。同样重量下，完整、稳定的幅度比更重但变形的动作更有参考价值。',
  },
  techniqueQuality: {
    title: '动作质量',
    body: '动作质量综合幅度、节奏、稳定性和代偿情况。质量较差时，即使次数达标，也不建议贸然加重。',
  },
  effectiveSet: {
    title: '有效组',
    body: '有效组指接近目标努力程度、动作质量可接受、没有明显不适的工作组。热身组、明显太轻的组或质量较差的组不会完整计入肌肥大剂量。',
  },
  weightedEffectiveSet: {
    title: '加权有效组',
    body: '加权有效组按动作对不同肌群的主要和辅助贡献估算训练量。例如卧推主要计入胸部，也会按较低权重计入三头和前三角。它是训练量估算，不是精确生理测量。',
  },
  weeklyVolume: {
    title: '每周训练量',
    body: '以肌群为单位统计每周完成组数和有效组数，用来判断该补量、维持还是下修训练量。',
  },
  deload: {
    title: '减量周',
    body: '减量周会降低训练量或强度，让疲劳回落，同时保留基本动作模式和训练节奏。',
  },
  deloadWeek: {
    title: '减量周',
    body: '减量周会降低训练量或强度，让疲劳回落，同时保留基本动作模式和训练节奏。',
  },
  painPattern: {
    title: '不适模式',
    body: '当同一部位或同一动作反复出现不适，系统会提示保守处理、替代动作或降低训练压力。它不是医疗诊断。',
  },
  correctionBlock: {
    title: '纠偏模块',
    body: '纠偏模块用于改善体态、活动度或动作控制问题，通常放在热身、组间或收尾，不抢主训练容量。',
  },
  functionalBlock: {
    title: '功能补丁',
    body: '功能补丁用于补足单腿稳定、抗旋转、搬运和核心稳定等能力短板，默认作为辅助层使用。',
  },
  medicalBoundary: {
    title: '训练建议边界',
    body: 'IronPath 用于训练安排和记录，不提供医疗诊断。明显疼痛、麻木、放射痛或持续恶化时，请停止相关动作并咨询专业人士。',
  },
} as const;

export type DefinitionKey = keyof typeof DEFINITIONS;

export const getDefinition = (key: DefinitionKey) => DEFINITIONS[key];
