import type { ExerciseEquivalenceChain, ExerciseReplacementPriority, ExerciseTemplate } from '../models/training-model';

export type ExerciseName = {
  zh: string;
  en?: string;
  aliases?: string[];
};

export const EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  'bench-press': '平板卧推',
  'db-bench-press': '哑铃卧推',
  'incline-db-press': '上斜哑铃卧推',
  'machine-chest-press': '器械推胸',
  'cable-fly': '绳索夹胸',
  'lateral-raise': '哑铃侧平举',
  'triceps-pushdown': '绳索下压',
  'close-grip-bench': '窄握卧推',
  'lat-pulldown': '高位下拉',
  'seated-row': '坐姿划船',
  'barbell-row': '杠铃划船',
  'one-arm-db-row': '单臂哑铃划船',
  'face-pull': '面拉',
  'db-curl': '哑铃弯举',
  'hammer-curl': '锤式弯举',
  'preacher-curl': '牧师凳弯举',
  squat: '深蹲',
  'hack-squat': '哈克深蹲',
  'goblet-squat': '杯式深蹲',
  'leg-press': '腿举',
  'romanian-deadlift': '罗马尼亚硬拉',
  'db-rdl': '哑铃罗马尼亚硬拉',
  'leg-curl': '腿弯举',
  'calf-raise': '提踵',
  'shoulder-press': '哑铃肩推',
  'machine-shoulder-press': '器械肩推',
  'push-up': '俯卧撑',
  'pull-up': '引体向上',
  'assisted-pull-up': '辅助引体向上',
  deadlift: '硬拉',
  'hip-thrust': '臀推',
  'leg-extension': '腿屈伸',
  'landmine-press': '地雷管推举',
  thoracic_extension_foam: '泡沫轴胸椎伸展',
  wall_slide: '墙滑',
  serratus_wall_slide: '前锯肌墙滑',
  face_pull: '面拉',
  chin_tuck: '收下巴',
  band_pull_apart: '弹力带拉开',
  scap_pushup: '肩胛俯卧撑',
  dead_bug: '死虫',
  dead_bug_exhale: '呼气死虫',
  breathing_90_90: '90/90 呼吸',
  side_plank: '侧桥',
  mini_band_walk: '弹力带侧走',
  monster_walk: '怪兽走',
  single_leg_glute_bridge: '单腿臀桥',
  hip_90_90_switch: '90/90 髋转换',
  couch_stretch: '沙发拉伸',
  side_lying_hip_abduction: '侧卧髋外展',
  knee_to_wall: '膝触墙',
  soleus_raise: '屈膝提踵',
  deep_squat_hold: '深蹲底部停留',
  goblet_squat_pattern: '杯式深蹲模式重建',
  open_book: '开书式',
  quadruped_thoracic_rotation: '四点跪胸椎旋转',
  pallof_press: '帕洛夫抗旋推',
  single_arm_carry: '单臂农夫走',
  single_leg_rdl: '单腿 RDL',
  split_squat_iso: '分腿蹲等长停留',
  farmer_carry: '农夫走',
  bottom_up_press: '倒置壶铃推举',
  landmine_press: '地雷管推举',
  waiter_carry: '服务员行走',
};

export const EXERCISE_ENGLISH_NAMES: Record<string, string> = {
  'bench-press': 'Barbell Bench Press',
  'db-bench-press': 'Dumbbell Bench Press',
  'incline-db-press': 'Incline Dumbbell Press',
  'machine-chest-press': 'Machine Chest Press',
  'cable-fly': 'Cable Fly',
  'lateral-raise': 'Dumbbell Lateral Raise',
  'triceps-pushdown': 'Triceps Pushdown',
  'close-grip-bench': 'Close-Grip Bench Press',
  'lat-pulldown': 'Lat Pulldown',
  'seated-row': 'Seated Row',
  'barbell-row': 'Barbell Row',
  'one-arm-db-row': 'One-Arm Dumbbell Row',
  'face-pull': 'Face Pull',
  'db-curl': 'Dumbbell Curl',
  'hammer-curl': 'Hammer Curl',
  'preacher-curl': 'Preacher Curl',
  squat: 'Back Squat',
  'hack-squat': 'Hack Squat',
  'goblet-squat': 'Goblet Squat',
  'leg-press': 'Leg Press',
  'romanian-deadlift': 'Romanian Deadlift',
  'db-rdl': 'Dumbbell Romanian Deadlift',
  'leg-curl': 'Leg Curl',
  'calf-raise': 'Calf Raise',
  'shoulder-press': 'Dumbbell Shoulder Press',
  'machine-shoulder-press': 'Machine Shoulder Press',
  'push-up': 'Push-Up',
  'pull-up': 'Pull-Up',
  'assisted-pull-up': 'Assisted Pull-Up',
  deadlift: 'Deadlift',
  'hip-thrust': 'Hip Thrust',
  'leg-extension': 'Leg Extension',
  'landmine-press': 'Landmine Press',
};

export const EXERCISE_ALIASES: Record<string, string[]> = {
  'bench-press': ['卧推', '平板杠铃卧推', 'Barbell Bench Press'],
  'db-bench-press': ['平板哑铃卧推', 'Dumbbell Bench Press'],
  'machine-chest-press': ['胸推机', '坐姿胸推机', 'Machine Chest Press'],
  'incline-db-press': ['上斜哑铃推胸', 'Incline Dumbbell Press'],
  'cable-fly': ['夹胸', '蝴蝶机夹胸', 'Cable Fly'],
  'lateral-raise': ['侧平举', '绳索侧平举', 'Dumbbell Lateral Raise'],
  'triceps-pushdown': ['三头下压', '下压', '绳索过顶臂屈伸', 'Triceps Pushdown'],
  'close-grip-bench': ['窄握卧推', 'Close-Grip Bench Press'],
  'lat-pulldown': ['下拉', '高位下拉', 'Lat Pulldown'],
  'pull-up': ['引体向上', 'Pull-Up'],
  'assisted-pull-up': ['辅助引体向上', 'Assisted Pull-Up'],
  'seated-row': ['划船机', '坐姿划船', 'Seated Row'],
  'barbell-row': ['杠铃划船', 'Barbell Row'],
  'one-arm-db-row': ['单臂哑铃划船', '单臂划船', 'One-Arm Dumbbell Row'],
  'face-pull': ['面拉', '反向飞鸟', 'Face Pull'],
  'db-curl': ['二头弯举', '弯举', '哑铃弯举', 'Dumbbell Curl'],
  'hammer-curl': ['锤式弯举', '绳索锤式弯举', 'Hammer Curl'],
  'preacher-curl': ['牧师凳弯举', 'Preacher Curl'],
  squat: ['深蹲', 'Back Squat'],
  'hack-squat': ['哈克深蹲', 'Hack Squat'],
  'goblet-squat': ['杯式深蹲', 'Goblet Squat'],
  'leg-press': ['腿举', '高脚位腿举', 'Leg Press'],
  'romanian-deadlift': ['RDL', '罗马尼亚硬拉', 'Romanian Deadlift'],
  'db-rdl': ['哑铃 RDL', '哑铃罗马尼亚硬拉', 'Dumbbell Romanian Deadlift'],
  'leg-curl': ['腿弯举', '北欧腿弯举', 'Leg Curl'],
  'calf-raise': ['提踵', '坐姿提踵', 'Calf Raise'],
  'shoulder-press': ['肩推', '哑铃肩推', 'Dumbbell Shoulder Press'],
  'machine-shoulder-press': ['器械肩推', 'Machine Shoulder Press'],
  'landmine-press': ['地雷管推举', 'Landmine Press'],
};

const hasChineseText = (value: unknown): value is string => typeof value === 'string' && /[\u3400-\u9fff]/.test(value);

const warnMissingChineseName = (id: string) => {
  if (typeof console !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn(`[IronPath] 动作缺少中文名称：${id}`);
  }
};

export const getExerciseNameEntry = (id: string): ExerciseName => ({
  zh: EXERCISE_DISPLAY_NAMES[id] || '',
  en: EXERCISE_ENGLISH_NAMES[id],
  aliases: EXERCISE_ALIASES[id],
});

export const formatExerciseDisplayName = (
  value: unknown,
  options: { bilingual?: boolean; fallback?: string } = {}
): string => {
  const fallback = options.fallback || '未命名动作';
  if (typeof value === 'string' && hasChineseText(value)) return value;
  const id =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String(
            (value as { actualExerciseId?: unknown }).actualExerciseId ||
              (value as { replacementExerciseId?: unknown }).replacementExerciseId ||
              (value as { canonicalExerciseId?: unknown }).canonicalExerciseId ||
              (value as { id?: unknown }).id ||
              ''
          )
        : '';

  if (id) {
    const entry = getExerciseNameEntry(id);
    if (entry.zh) return options.bilingual && entry.en ? `${entry.zh}（${entry.en}）` : entry.zh;
  }

  if (value && typeof value === 'object') {
    const rawNameObject = (value as { name?: unknown }).name;
    const nameZh =
      typeof (value as { nameZh?: unknown }).nameZh === 'string'
        ? (value as { nameZh: string }).nameZh
        : rawNameObject && typeof rawNameObject === 'object' && typeof (rawNameObject as { zh?: unknown }).zh === 'string'
          ? (rawNameObject as { zh: string }).zh
          : '';
    const alias = (value as { alias?: unknown }).alias;
    const name = typeof rawNameObject === 'string' ? rawNameObject : '';
    const zh = nameZh || (hasChineseText(alias) ? alias : '') || (hasChineseText(name) ? name : '');
    const en =
      typeof (value as { nameEn?: unknown }).nameEn === 'string'
        ? (value as { nameEn: string }).nameEn
        : rawNameObject && typeof rawNameObject === 'object' && typeof (rawNameObject as { en?: unknown }).en === 'string'
          ? (rawNameObject as { en: string }).en
          : !hasChineseText(name)
            ? name
            : undefined;
    if (zh) return options.bilingual && en && en !== zh ? `${zh}（${en}）` : zh;
    if (en) warnMissingChineseName(id || en);
  }

  if (id) warnMissingChineseName(id);
  return fallback;
};

const normalizeExerciseReference = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[\s_\-·,，。:：;；/\\|]+/g, '');

export const resolveExerciseReferenceToId = (value: unknown): string | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (EXERCISE_DISPLAY_NAMES[raw] || EXERCISE_ENGLISH_NAMES[raw] || EXERCISE_KNOWLEDGE_OVERRIDES[raw]) return raw;
  const normalized = normalizeExerciseReference(raw);
  for (const [id, label] of Object.entries(EXERCISE_DISPLAY_NAMES)) {
    if (normalizeExerciseReference(id) === normalized || normalizeExerciseReference(label) === normalized) return id;
  }
  for (const [id, label] of Object.entries(EXERCISE_ENGLISH_NAMES)) {
    if (normalizeExerciseReference(label) === normalized) return id;
  }
  for (const [id, aliases] of Object.entries(EXERCISE_ALIASES)) {
    if (aliases.some((alias) => normalizeExerciseReference(alias) === normalized)) return id;
  }
  return undefined;
};

export const mapLegacyAlternativeLabelsToIds = (alternatives: string[] = []) => {
  const warnings: string[] = [];
  const ids: string[] = [];
  alternatives.forEach((label) => {
    const id = resolveExerciseReferenceToId(label);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
      return;
    }
    warnings.push(`替代动作「${label}」无法映射到动作库 ID，已从可选替代列表跳过。`);
  });
  return { ids, warnings };
};

const chain = (id: string, label: string, primaryMuscle: string, pattern: string, members: string[]): ExerciseEquivalenceChain => ({
  id,
  label,
  primaryMuscle,
  pattern,
  members,
});

export const EXERCISE_EQUIVALENCE_CHAINS: Record<string, ExerciseEquivalenceChain> = {
  'bench-press': chain('horizontal-press', '水平推链', '胸', '水平推', ['bench-press', 'machine-chest-press', 'db-bench-press', 'push-up']),
  'machine-chest-press': chain('horizontal-press', '水平推链', '胸', '水平推', ['bench-press', 'machine-chest-press', 'db-bench-press', 'push-up']),
  'db-bench-press': chain('horizontal-press', '水平推链', '胸', '水平推', ['bench-press', 'machine-chest-press', 'db-bench-press', 'push-up']),
  'push-up': chain('horizontal-press', '水平推链', '胸', '水平推', ['bench-press', 'machine-chest-press', 'db-bench-press', 'push-up']),
  squat: chain('squat-pattern', '深蹲链', '腿', '深蹲', ['squat', 'hack-squat', 'goblet-squat', 'leg-press']),
  'hack-squat': chain('squat-pattern', '深蹲链', '腿', '深蹲', ['squat', 'hack-squat', 'goblet-squat', 'leg-press']),
  'leg-press': chain('squat-pattern', '深蹲链', '腿', '腿举', ['squat', 'hack-squat', 'goblet-squat', 'leg-press']),
  'goblet-squat': chain('squat-pattern', '深蹲链', '腿', '深蹲', ['squat', 'hack-squat', 'goblet-squat', 'leg-press']),
  'romanian-deadlift': chain('hinge-pattern', '髋铰链链', '腿', '髋铰链', ['romanian-deadlift', 'db-rdl', 'deadlift', 'hip-thrust']),
  'db-rdl': chain('hinge-pattern', '髋铰链链', '腿', '髋铰链', ['romanian-deadlift', 'db-rdl', 'deadlift', 'hip-thrust']),
  deadlift: chain('hinge-pattern', '髋铰链链', '腿', '髋铰链', ['romanian-deadlift', 'db-rdl', 'deadlift', 'hip-thrust']),
  'hip-thrust': chain('hinge-pattern', '髋铰链链', '腿', '髋伸', ['romanian-deadlift', 'db-rdl', 'deadlift', 'hip-thrust']),
  'lat-pulldown': chain('vertical-pull', '垂直拉链', '背', '垂直拉', ['lat-pulldown', 'pull-up', 'assisted-pull-up']),
  'pull-up': chain('vertical-pull', '垂直拉链', '背', '垂直拉', ['lat-pulldown', 'pull-up', 'assisted-pull-up']),
  'assisted-pull-up': chain('vertical-pull', '垂直拉链', '背', '垂直拉', ['lat-pulldown', 'pull-up', 'assisted-pull-up']),
  'seated-row': chain('horizontal-pull', '水平拉链', '背', '水平拉', ['seated-row', 'barbell-row', 'one-arm-db-row']),
  'barbell-row': chain('horizontal-pull', '水平拉链', '背', '水平拉', ['seated-row', 'barbell-row', 'one-arm-db-row']),
  'one-arm-db-row': chain('horizontal-pull', '水平拉链', '背', '单侧水平拉', ['seated-row', 'barbell-row', 'one-arm-db-row']),
  'shoulder-press': chain('vertical-press', '垂直推链', '肩', '垂直推', ['shoulder-press', 'machine-shoulder-press', 'landmine-press']),
  'machine-shoulder-press': chain('vertical-press', '垂直推链', '肩', '垂直推', ['shoulder-press', 'machine-shoulder-press', 'landmine-press']),
  'landmine-press': chain('vertical-press', '垂直推链', '肩', '斜向推', ['shoulder-press', 'machine-shoulder-press', 'landmine-press']),
};

// muscleContribution 用于训练量估算：主目标肌群通常为 1.0，明显辅助肌群通常为 0.3-0.6。
// 它帮助周剂量仪表盘更接近真实训练分配，但不代表精确生理刺激测量。
export const EXERCISE_KNOWLEDGE_OVERRIDES: Record<string, Record<string, unknown>> = {
  'bench-press': {
    movementPattern: '水平推',
    primaryMuscles: ['胸'],
    secondaryMuscles: ['肩', '手臂'],
    muscleContribution: { 胸: 1, 手臂: 0.5, 肩: 0.4 },
    fatigueCost: 'high',
    skillDemand: 'high',
    orderPriority: 1,
    goalBias: ['力量', '肌肥大'],
    romPriority: 'high',
    equivalenceChainId: 'horizontal-press',
    alternativeIds: ['db-bench-press', 'machine-chest-press', 'push-up', 'incline-db-press'],
    alternativePriorities: {
      'db-bench-press': 'priority',
      'machine-chest-press': 'priority',
      'push-up': 'optional',
      'incline-db-press': 'angle',
      'cable-fly': 'not_recommended',
      'triceps-pushdown': 'not_recommended',
      'shoulder-press': 'not_recommended',
      'machine-shoulder-press': 'not_recommended',
    },
    regressionIds: ['machine-chest-press', 'db-bench-press'],
    progressionIds: ['close-grip-bench'],
    contraindications: ['upper_crossed', 'scapular_control', 'breathing_ribcage'],
  },
  'incline-db-press': {
    movementPattern: '上斜推',
    primaryMuscles: ['胸'],
    secondaryMuscles: ['肩', '手臂'],
    muscleContribution: { 胸: 1, 肩: 0.5, 手臂: 0.4 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    alternativeIds: ['machine-chest-press', 'db-bench-press'],
    alternativePriorities: {
      'machine-chest-press': 'priority',
      'db-bench-press': 'angle',
    },
    progressionIds: ['bench-press'],
    contraindications: ['upper_crossed', 'scapular_control'],
  },
  'machine-chest-press': {
    movementPattern: '水平推',
    primaryMuscles: ['胸'],
    secondaryMuscles: ['肩', '手臂'],
    muscleContribution: { 胸: 1, 肩: 0.4, 手臂: 0.4 },
    fatigueCost: 'medium',
    skillDemand: 'low',
    orderPriority: 3,
    equivalenceChainId: 'horizontal-press',
    alternativeIds: ['db-bench-press', 'bench-press', 'push-up'],
    alternativePriorities: {
      'db-bench-press': 'priority',
      'bench-press': 'optional',
      'push-up': 'optional',
    },
    progressionIds: ['db-bench-press', 'bench-press'],
    contraindications: ['upper_crossed', 'scapular_control'],
  },
  'cable-fly': {
    movementPattern: '飞鸟',
    primaryMuscles: ['胸'],
    secondaryMuscles: [],
    muscleContribution: { 胸: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 6,
    goalBias: ['肌肥大'],
  },
  'lateral-raise': {
    movementPattern: '肩外展',
    primaryMuscles: ['肩'],
    secondaryMuscles: [],
    muscleContribution: { 肩: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 7,
    goalBias: ['肌肥大'],
    recommendedLoadRange: '约 40%-65% 1RM',
  },
  'triceps-pushdown': {
    movementPattern: '肘伸',
    primaryMuscles: ['手臂'],
    secondaryMuscles: [],
    muscleContribution: { 手臂: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 7,
    goalBias: ['肌肥大'],
  },
  'lat-pulldown': {
    movementPattern: '垂直拉',
    primaryMuscles: ['背'],
    secondaryMuscles: ['手臂'],
    muscleContribution: { 背: 1, 手臂: 0.4 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    equivalenceChainId: 'vertical-pull',
    contraindications: ['scapular_control', 'thoracic_rotation'],
  },
  'seated-row': {
    movementPattern: '水平拉',
    primaryMuscles: ['背'],
    secondaryMuscles: ['手臂', '肩'],
    muscleContribution: { 背: 1, 手臂: 0.4, 肩: 0.3 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    equivalenceChainId: 'horizontal-pull',
    regressionIds: ['one-arm-db-row'],
    progressionIds: ['barbell-row'],
    contraindications: ['thoracic_rotation', 'scapular_control'],
  },
  'barbell-row': {
    movementPattern: '水平拉',
    primaryMuscles: ['背'],
    secondaryMuscles: ['腿', '手臂'],
    muscleContribution: { 背: 1, 手臂: 0.4, 腿: 0.2 },
    fatigueCost: 'high',
    skillDemand: 'high',
    orderPriority: 1,
    goalBias: ['力量', '肌肥大'],
    equivalenceChainId: 'horizontal-pull',
    regressionIds: ['seated-row', 'one-arm-db-row'],
    contraindications: ['lumbar_compensation', 'thoracic_rotation'],
  },
  'face-pull': {
    movementPattern: '肩胛控制',
    primaryMuscles: ['肩'],
    secondaryMuscles: ['背'],
    muscleContribution: { 肩: 0.8, 背: 0.5 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 8,
    goalBias: ['肌肥大', '体态'],
  },
  'db-curl': {
    movementPattern: '肘屈',
    primaryMuscles: ['手臂'],
    secondaryMuscles: [],
    muscleContribution: { 手臂: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 7,
    goalBias: ['肌肥大'],
  },
  'hammer-curl': {
    movementPattern: '肘屈',
    primaryMuscles: ['手臂'],
    secondaryMuscles: [],
    muscleContribution: { 手臂: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 7,
    goalBias: ['肌肥大'],
  },
  squat: {
    movementPattern: '深蹲',
    primaryMuscles: ['腿'],
    secondaryMuscles: ['背'],
    muscleContribution: { 腿: 1, 背: 0.4 },
    fatigueCost: 'high',
    skillDemand: 'high',
    orderPriority: 1,
    goalBias: ['力量', '肌肥大'],
    equivalenceChainId: 'squat-pattern',
    regressionIds: ['hack-squat', 'goblet-squat', 'leg-press'],
    contraindications: ['ankle_mobility', 'squat_lean_forward', 'hip_stability', 'core_control'],
  },
  'hack-squat': {
    movementPattern: '深蹲',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 1 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    equivalenceChainId: 'squat-pattern',
    regressionIds: ['leg-press', 'goblet-squat'],
    progressionIds: ['squat'],
    contraindications: ['ankle_mobility', 'squat_lean_forward'],
  },
  'leg-press': {
    movementPattern: '腿举',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 1 },
    fatigueCost: 'medium',
    skillDemand: 'low',
    orderPriority: 3,
    equivalenceChainId: 'squat-pattern',
    progressionIds: ['hack-squat', 'squat'],
    contraindications: ['hip_stability'],
  },
  'romanian-deadlift': {
    movementPattern: '髋铰链',
    primaryMuscles: ['腿'],
    secondaryMuscles: ['背'],
    muscleContribution: { 腿: 1, 背: 0.5 },
    fatigueCost: 'high',
    skillDemand: 'high',
    orderPriority: 2,
    goalBias: ['力量', '肌肥大'],
    equivalenceChainId: 'hinge-pattern',
    regressionIds: ['db-rdl'],
    contraindications: ['lumbar_compensation', 'core_control', 'hip_flexor_tightness'],
  },
  'db-rdl': {
    movementPattern: '髋铰链',
    primaryMuscles: ['腿'],
    secondaryMuscles: ['背'],
    muscleContribution: { 腿: 1, 背: 0.4 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 3,
    equivalenceChainId: 'hinge-pattern',
    progressionIds: ['romanian-deadlift'],
    contraindications: ['lumbar_compensation', 'core_control'],
  },
  'leg-curl': {
    movementPattern: '膝屈',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 5,
    goalBias: ['肌肥大'],
  },
  'calf-raise': {
    movementPattern: '跖屈',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 0.8 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 8,
    goalBias: ['肌肥大', '耐力'],
  },
  'shoulder-press': {
    movementPattern: '垂直推',
    primaryMuscles: ['肩'],
    secondaryMuscles: ['手臂', '胸'],
    muscleContribution: { 肩: 1, 手臂: 0.5, 胸: 0.2 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    goalBias: ['力量', '肌肥大'],
    equivalenceChainId: 'vertical-press',
    regressionIds: ['machine-shoulder-press'],
    contraindications: ['overhead_press_restriction', 'scapular_control', 'breathing_ribcage'],
  },
  'machine-shoulder-press': {
    movementPattern: '垂直推',
    primaryMuscles: ['肩'],
    secondaryMuscles: ['手臂'],
    muscleContribution: { 肩: 1, 手臂: 0.4 },
    fatigueCost: 'medium',
    skillDemand: 'low',
    orderPriority: 3,
    equivalenceChainId: 'vertical-press',
    progressionIds: ['shoulder-press'],
    contraindications: ['overhead_press_restriction'],
  },
  'close-grip-bench': {
    movementPattern: '水平推',
    primaryMuscles: ['手臂'],
    secondaryMuscles: ['胸', '肩'],
    muscleContribution: { 手臂: 1, 胸: 0.6, 肩: 0.3 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    equivalenceChainId: 'horizontal-press',
    contraindications: ['upper_crossed', 'scapular_control'],
  },
  'preacher-curl': {
    movementPattern: '肘屈',
    primaryMuscles: ['手臂'],
    secondaryMuscles: [],
    muscleContribution: { 手臂: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 7,
    goalBias: ['肌肥大'],
  },
  'db-bench-press': {
    movementPattern: '水平推',
    primaryMuscles: ['胸'],
    secondaryMuscles: ['肩', '手臂'],
    muscleContribution: { 胸: 1, 肩: 0.4, 手臂: 0.5 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    equivalenceChainId: 'horizontal-press',
    alternativeIds: ['machine-chest-press', 'bench-press', 'push-up', 'incline-db-press'],
    alternativePriorities: {
      'machine-chest-press': 'priority',
      'bench-press': 'optional',
      'push-up': 'optional',
      'incline-db-press': 'angle',
    },
    regressionIds: ['machine-chest-press'],
    progressionIds: ['bench-press'],
    contraindications: ['upper_crossed', 'scapular_control'],
  },
  'one-arm-db-row': {
    movementPattern: '单侧水平拉',
    primaryMuscles: ['背'],
    secondaryMuscles: ['手臂'],
    muscleContribution: { 背: 1, 手臂: 0.4 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 3,
    equivalenceChainId: 'horizontal-pull',
    progressionIds: ['seated-row', 'barbell-row'],
    contraindications: ['thoracic_rotation'],
  },
  'goblet-squat': {
    movementPattern: '深蹲',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 1 },
    fatigueCost: 'medium',
    skillDemand: 'low',
    orderPriority: 3,
    equivalenceChainId: 'squat-pattern',
    progressionIds: ['hack-squat', 'squat'],
    contraindications: ['ankle_mobility', 'hip_stability'],
  },
  'push-up': {
    movementPattern: '水平推',
    primaryMuscles: ['胸'],
    secondaryMuscles: ['肩', '手臂'],
    muscleContribution: { 胸: 1, 肩: 0.35, 手臂: 0.45 },
    fatigueCost: 'medium',
    skillDemand: 'low',
    orderPriority: 4,
    equivalenceChainId: 'horizontal-press',
    progressionIds: ['db-bench-press', 'bench-press'],
    contraindications: ['upper_crossed', 'scapular_control'],
  },
  'pull-up': {
    movementPattern: '垂直拉',
    primaryMuscles: ['背'],
    secondaryMuscles: ['手臂'],
    muscleContribution: { 背: 1, 手臂: 0.5 },
    fatigueCost: 'high',
    skillDemand: 'high',
    orderPriority: 1,
    equivalenceChainId: 'vertical-pull',
    regressionIds: ['lat-pulldown', 'assisted-pull-up'],
    contraindications: ['scapular_control'],
  },
  'assisted-pull-up': {
    movementPattern: '垂直拉',
    primaryMuscles: ['背'],
    secondaryMuscles: ['手臂'],
    muscleContribution: { 背: 1, 手臂: 0.45 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 2,
    equivalenceChainId: 'vertical-pull',
    progressionIds: ['pull-up'],
    contraindications: ['scapular_control'],
  },
  deadlift: {
    movementPattern: '髋铰链',
    primaryMuscles: ['腿'],
    secondaryMuscles: ['背'],
    muscleContribution: { 腿: 1, 背: 0.6 },
    fatigueCost: 'high',
    skillDemand: 'high',
    orderPriority: 1,
    equivalenceChainId: 'hinge-pattern',
    regressionIds: ['romanian-deadlift', 'db-rdl'],
    contraindications: ['lumbar_compensation', 'core_control'],
  },
  'hip-thrust': {
    movementPattern: '髋伸',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 1 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 3,
    contraindications: ['hip_flexor_tightness'],
  },
  'leg-extension': {
    movementPattern: '膝伸',
    primaryMuscles: ['腿'],
    secondaryMuscles: [],
    muscleContribution: { 腿: 1 },
    fatigueCost: 'low',
    skillDemand: 'low',
    orderPriority: 6,
    goalBias: ['肌肥大'],
  },
  'landmine-press': {
    movementPattern: '斜向推',
    primaryMuscles: ['肩'],
    secondaryMuscles: ['胸', '手臂'],
    muscleContribution: { 肩: 1, 胸: 0.35, 手臂: 0.35 },
    fatigueCost: 'medium',
    skillDemand: 'medium',
    orderPriority: 3,
    equivalenceChainId: 'vertical-press',
    progressionIds: ['shoulder-press'],
    contraindications: ['overhead_press_restriction'],
  },
};

export function makeExercise(
  id: string,
  name: string,
  alias: string,
  muscle: string,
  kind: string,
  sets: number,
  repMin: number,
  repMax: number,
  rest: number,
  startWeight: number,
  alternatives: string[] = []
): ExerciseTemplate {
  const override = EXERCISE_KNOWLEDGE_OVERRIDES[id] || {};
  const legacyAlternativeIds = mapLegacyAlternativeLabelsToIds(alternatives).ids;
  const overrideAlternativeIds = Array.isArray(override.alternativeIds) ? (override.alternativeIds as string[]) : [];
  const alternativeIds = Array.from(new Set([...overrideAlternativeIds, ...legacyAlternativeIds])).filter((candidateId) => candidateId !== id);
  const alternativePriorities = override.alternativePriorities as Record<string, ExerciseReplacementPriority | string> | undefined;
  return {
    id,
    name,
    alias,
    muscle,
    kind,
    sets,
    repMin,
    repMax,
    rest,
    startWeight,
    alternatives,
    alternativeIds,
    alternativePriorities,
  };
}
