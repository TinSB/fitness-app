import type { MuscleGroup, TechniqueStandard, TrainingMode } from '../models/training-model';

export const STORAGE_KEY = 'ironpath_personal_strength_os_v3';
export const STORAGE_VERSION = 8;
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
  healthMetricSamples: 'ironpath_health_metric_samples',
  importedWorkoutSamples: 'ironpath_imported_workout_samples',
  healthImportBatches: 'ironpath_health_import_batches',
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
    label: '综合模式',
    shortLabel: '综合',
    description: '主动作保留力量推进，辅助动作服务肌肥大和动作质量，适合长期自用。',
    weeklyTargets: { 胸: 10, 背: 12, 腿: 12, 肩: 8, 手臂: 8 },
  },
  strength: {
    id: 'strength',
    label: '力量优先',
    shortLabel: '力量',
    description: '复合动作使用较重负荷、较长休息和更严格技术标准，辅助训练不抢恢复容量。',
    weeklyTargets: { 胸: 8, 背: 10, 腿: 10, 肩: 6, 手臂: 6 },
  },
  hypertrophy: {
    id: 'hypertrophy',
    label: '肌肥大优先',
    shortLabel: '肌肥大',
    description: '优先保证每周有效训练组数，复合动作稳步推进，孤立动作通过次数和总量积累刺激。',
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
  rom: '完整可控幅度',
  tempo: '2-0-1',
  stopRule: '动作明显变形、速度明显下降或出现不适时停止该组',
};

export const PRESCRIPTION_SOURCES = [
  '渐进超负荷：连续稳定达标后再小幅加重。',
  '训练频率：大肌群每周至少安排 2 次有效刺激更利于长期执行。',
  '肌肥大主线：用每周有效组数、RIR 和动作质量共同决定是否推进。',
] as const;
