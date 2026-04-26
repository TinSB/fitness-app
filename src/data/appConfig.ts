import type { MuscleGroup, TechniqueStandard, TrainingMode } from '../models/training-model';

export const STORAGE_KEY = 'ironpath_personal_strength_os_v3';
export const STORAGE_VERSION = 6;
export const STORAGE_KEYS = {
  version: 'ironpath_version',
  templates: 'ironpath_templates',
  history: 'ironpath_history',
  activeSession: 'ironpath_active_session',
  todayStatus: 'ironpath_today_status',
  bodyWeights: 'ironpath_body_weights',
  userProfile: 'ironpath_user_profile',
  screeningProfile: 'ironpath_screening_profile',
  programTemplate: 'ironpath_program_template',
  mesocyclePlan: 'ironpath_mesocycle_plan',
  settings: 'ironpath_settings',
} as const;

export const TRAINING_MODE_META: Record<
  TrainingMode,
  {
    id: TrainingMode;
    label: string;
    shortLabel: string;
    description: string;
    weeklyTargets: Record<MuscleGroup, number>;
  }
> = {
  hybrid: {
    id: 'hybrid',
    label: '混合模式',
    shortLabel: '混合',
    description: '主动作偏力量，辅动作偏增肌。优先兼顾长期推进和每周总训练量。',
    weeklyTargets: { 胸: 10, 背: 12, 腿: 12, 肩: 8, 手臂: 8 },
  },
  strength: {
    id: 'strength',
    label: '力量优先',
    shortLabel: '力量',
    description: '主复合动作偏重负荷、较长休息，强调完整动作范围和高质量顶组。',
    weeklyTargets: { 胸: 8, 背: 10, 腿: 10, 肩: 6, 手臂: 6 },
  },
  hypertrophy: {
    id: 'hypertrophy',
    label: '增肌优先',
    shortLabel: '增肌',
    description: '优先保证肌群周总有效组。复合动作中等偏重，孤立动作用更高次数积累训练量。',
    weeklyTargets: { 胸: 12, 背: 14, 腿: 14, 肩: 10, 手臂: 10 },
  },
};

export const MODE_ORDER: TrainingMode[] = ['hybrid', 'strength', 'hypertrophy'];
export const MUSCLE_ORDER: MuscleGroup[] = ['胸', '背', '腿', '肩', '手臂'];
export const SORENESS_OPTIONS = ['无', ...MUSCLE_ORDER] as const;
export const MUSCLE_RECOVERY_CAPACITY: Record<MuscleGroup, number> = {
  胸: 14,
  背: 16,
  腿: 16,
  肩: 12,
  手臂: 12,
};

export const DEFAULT_TECHNIQUE_STANDARD: TechniqueStandard = {
  rom: '全程',
  tempo: '2-0-1',
  stopRule: '动作变形或速度明显下降即停',
};

export const PRESCRIPTION_SOURCES = [
  'ACSM 2009：达到目标次数上限后按 2-10% 逐步加重。',
  'ACSM 2026：力量更依赖较重负荷、完整动作幅度、每个动作 2-3 组、每周至少 2 次刺激。',
  '现代系统综述：增肌更依赖周总有效组，默认不要求每组都练到力竭。',
] as const;
