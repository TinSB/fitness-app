import type { MesocyclePlan, MuscleGroup, ProgramTemplate, ScreeningProfile, TodayStatus, UserProfile } from '../models/training-model';
import { INITIAL_TEMPLATES } from './defaultTemplates';

const unique = <T,>(values: T[]) => [...new Set(values)];

const focusMusclesForTemplate = (template: (typeof INITIAL_TEMPLATES)[number]) =>
  unique(template.exercises.map((exercise) => exercise.muscle).filter(Boolean)) as MuscleGroup[];

const defaultCorrectionBlocks = (templateId: string) => {
  if (templateId.includes('push') || templateId.includes('upper')) return ['corr_upper_crossed_01', 'corr_scapular_control_01'];
  if (templateId.includes('pull')) return ['corr_scapular_control_01', 'corr_thoracic_rotation_01'];
  if (templateId.includes('leg') || templateId.includes('lower')) return ['corr_ankle_mobility_01', 'corr_core_control_01'];
  return [];
};

const defaultFunctionalBlocks = (templateId: string) => {
  if (templateId.includes('push') || templateId.includes('upper')) return ['func_overhead_stability_01'];
  if (templateId.includes('pull')) return ['func_core_anti_rotation_01'];
  if (templateId.includes('leg') || templateId.includes('lower')) return ['func_single_leg_01'];
  return ['func_carry_capacity_01'];
};

export const DEFAULT_STATUS: TodayStatus = {
  sleep: '一般',
  energy: '中',
  soreness: ['无'],
  time: '60',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'local-user',
  name: '我',
  sex: 'other',
  age: 30,
  heightCm: 175,
  weightKg: 70,
  trainingLevel: 'intermediate',
  primaryGoal: 'hypertrophy',
  secondaryPreferences: ['posture', 'functional'],
  weeklyTrainingDays: 4,
  sessionDurationMin: 70,
  equipmentAccess: ['barbell', 'dumbbell', 'machine', 'cables', 'bands', 'bodyweight'],
  injuryFlags: [],
  painNotes: [],
};

export const DEFAULT_SCREENING_PROFILE: ScreeningProfile = {
  userId: 'local-user',
  postureFlags: {
    forwardHead: 'mild',
    roundedShoulders: 'moderate',
    thoracicKyphosis: 'mild',
    anteriorPelvicTilt: 'none',
    dynamicKneeValgus: 'none',
  },
  movementFlags: {
    overheadMobility: 'limited',
    squatPattern: 'good',
    hingePattern: 'good',
    singleLegStability: 'limited',
    scapularControl: 'limited',
    trunkStability: 'limited',
    ankleMobility: 'limited',
    thoracicRotation: 'limited',
    hipFlexorLength: 'limited',
    lumbarControl: 'good',
    ribCagePosition: 'limited',
    verticalPressTolerance: 'limited',
  },
  painTriggers: [],
  restrictedExercises: [],
  correctionPriority: ['upper_crossed', 'scapular_control', 'core_control'],
  adaptiveState: {
    issueScores: {},
    painByExercise: {},
    performanceDrops: [],
    improvingIssues: [],
    moduleDose: {},
    lastUpdated: '',
  },
};

export const DEFAULT_PROGRAM_TEMPLATE: ProgramTemplate = {
  id: 'program-hypertrophy-support',
  userId: 'local-user',
  primaryGoal: 'hypertrophy',
  splitType: 'upper_lower',
  daysPerWeek: 4,
  correctionStrategy: 'moderate',
  functionalStrategy: 'standard',
  weeklyMuscleTargets: {
    chest: 12,
    back: 14,
    quads: 10,
    hamstrings: 8,
    glutes: 8,
    shoulders: 10,
    biceps: 8,
    triceps: 8,
    calves: 6,
    abs: 6,
  },
  dayTemplates: INITIAL_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    focusMuscles: focusMusclesForTemplate(template),
    correctionBlockIds: defaultCorrectionBlocks(template.id),
    mainExerciseIds: template.exercises.map((exercise) => exercise.id),
    functionalBlockIds: defaultFunctionalBlocks(template.id),
    estimatedDurationMin: template.duration,
  })),
};

export const DEFAULT_MESOCYCLE_PLAN: MesocyclePlan = {
  id: 'meso-default-4',
  startDate: new Date().toISOString().slice(0, 10),
  lengthWeeks: 4,
  currentWeekIndex: 0,
  primaryGoal: 'hypertrophy',
  weeks: [
    { weekIndex: 0, phase: 'base', volumeMultiplier: 0.9, intensityBias: 'normal', notes: '重新建立节奏和可执行性。' },
    { weekIndex: 1, phase: 'build', volumeMultiplier: 1, intensityBias: 'normal', notes: '回到标准训练剂量。' },
    { weekIndex: 2, phase: 'overload', volumeMultiplier: 1.1, intensityBias: 'aggressive', notes: '在恢复允许时小幅提高训练压力。' },
    { weekIndex: 3, phase: 'deload', volumeMultiplier: 0.6, intensityBias: 'conservative', notes: '主动下修训练量，优先恢复和动作质量。' },
  ],
};
