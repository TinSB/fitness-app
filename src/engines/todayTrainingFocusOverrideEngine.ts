import { makeExercise } from '../data/exerciseLibrary';
import { formatTemplateName } from '../i18n/formatters';
import type { ReadinessResult, TodayStatus, TrainingSession, TrainingTemplate } from '../models/training-model';
import { getPrimaryMuscles, getSecondaryMuscles, number, todayKey } from './engineUtils';
import { buildTemplateRecoveryConflict, type RecoveryConflictLevel } from './recoveryAwareScheduler';

export const TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS = [
  'system',
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'recovery_mobility',
] as const;

export type TodayTrainingFocusOverrideOption = (typeof TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS)[number];

export type TodayTrainingFocusOverrideWarning = {
  id: string;
  message: string;
};

export type TodayTrainingFocusSelection = {
  override: TodayTrainingFocusOverrideOption;
  overrideActive: boolean;
  selectedTemplate: TrainingTemplate;
  selectedTemplateId: string;
  selectedTemplateName: string;
  selectedFocusLabel: string;
  systemTemplate: TrainingTemplate;
  systemTemplateId: string;
  systemTemplateName: string;
  warnings: TodayTrainingFocusOverrideWarning[];
  generatedTemplate: boolean;
};

export type BuildTodayTrainingFocusSelectionInput = {
  systemTemplate: TrainingTemplate;
  templates: TrainingTemplate[];
  override?: TodayTrainingFocusOverrideOption | string | null;
  todayStatus?: TodayStatus;
  readinessResult?: ReadinessResult | null;
  history?: TrainingSession[];
  painAreas?: string[];
  today?: string;
};

const optionSet = new Set<string>(TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS);

export const TODAY_TRAINING_FOCUS_OVERRIDE_LABELS: Record<TodayTrainingFocusOverrideOption, string> = {
  system: '系统推荐',
  chest: '胸',
  back: '背',
  legs: '腿',
  shoulders: '肩',
  arms: '手臂',
  core: '核心',
  full_body: '全身',
  recovery_mobility: '恢复 / 活动度',
};

const focusMuscles: Partial<Record<TodayTrainingFocusOverrideOption, string[]>> = {
  chest: ['胸'],
  back: ['背'],
  legs: ['腿'],
  shoulders: ['肩'],
  arms: ['手臂'],
  core: ['核心'],
  full_body: ['胸', '背', '腿', '肩'],
};

const preferredTemplateIds: Partial<Record<TodayTrainingFocusOverrideOption, string[]>> = {
  chest: ['push-a', 'upper', 'crowded-gym'],
  back: ['pull-a', 'upper', 'crowded-gym'],
  legs: ['legs-a', 'lower', 'quick-30'],
  shoulders: ['upper', 'arms', 'push-a'],
  arms: ['arms', 'pull-a', 'push-a'],
  full_body: ['quick-30', 'crowded-gym', 'upper'],
};

const normalizeOverride = (override: BuildTodayTrainingFocusSelectionInput['override']): TodayTrainingFocusOverrideOption => {
  const value = String(override || 'system');
  return optionSet.has(value) ? (value as TodayTrainingFocusOverrideOption) : 'system';
};

const templateText = (template: TrainingTemplate) => `${template.id} ${template.name} ${template.focus}`.toLowerCase();

const includesMuscle = (items: string[], muscle: string) => items.some((item) => item === muscle || item.includes(muscle));

const exerciseMuscleScore = (template: TrainingTemplate, muscles: string[]) =>
  (template.exercises || []).reduce((score, exercise) => {
    const primary = getPrimaryMuscles(exercise);
    const secondary = getSecondaryMuscles(exercise);
    const primaryScore = muscles.some((muscle) => includesMuscle(primary, muscle)) ? 6 : 0;
    const secondaryScore = muscles.some((muscle) => includesMuscle(secondary, muscle)) ? 2 : 0;
    const directScore = muscles.some((muscle) => String(exercise.muscle || '').includes(muscle)) ? 4 : 0;
    return score + primaryScore + secondaryScore + directScore;
  }, 0);

const fullBodyScore = (template: TrainingTemplate) => {
  const covered = new Set<string>();
  (template.exercises || []).forEach((exercise) => {
    ['胸', '背', '腿', '肩'].forEach((muscle) => {
      if (
        String(exercise.muscle || '').includes(muscle) ||
        includesMuscle(getPrimaryMuscles(exercise), muscle) ||
        includesMuscle(getSecondaryMuscles(exercise), muscle)
      ) {
        covered.add(muscle);
      }
    });
  });
  return covered.size * 12 + Math.min(8, template.exercises.length);
};

const preferenceScore = (template: TrainingTemplate, override: TodayTrainingFocusOverrideOption) => {
  const ids = preferredTemplateIds[override] || [];
  const index = ids.indexOf(template.id);
  return index >= 0 ? (ids.length - index) * 30 : 0;
};

const scoreTemplateForFocus = (template: TrainingTemplate, override: TodayTrainingFocusOverrideOption) => {
  if (override === 'full_body') return preferenceScore(template, override) + fullBodyScore(template);
  const muscles = focusMuscles[override] || [];
  const label = TODAY_TRAINING_FOCUS_OVERRIDE_LABELS[override];
  const exactFocusScore = templateText(template).includes(label.toLowerCase()) ? 16 : 0;
  return preferenceScore(template, override) + exactFocusScore + exerciseMuscleScore(template, muscles);
};

const pickTemplateForFocus = (
  override: TodayTrainingFocusOverrideOption,
  templates: TrainingTemplate[],
  fallback: TrainingTemplate,
) => {
  const scored = [...templates]
    .map((template) => ({ template, score: scoreTemplateForFocus(template, override) }))
    .sort((left, right) => right.score - left.score || number(left.template.duration) - number(right.template.duration));
  return scored[0]?.score > 0 ? scored[0].template : fallback;
};

const coreTemplate = (): TrainingTemplate => ({
  id: 'today-focus-core',
  name: '核心稳定',
  focus: '核心',
  duration: 35,
  note: '今日手动选择核心稳定，只影响本次训练。',
  exercises: [
    makeExercise('dead_bug', '死虫', '死虫', '核心', 'isolation', 2, 8, 10, 45, 0),
    makeExercise('side_plank', '侧桥', '侧桥', '核心', 'isolation', 2, 20, 30, 45, 0),
    makeExercise('pallof_press', '帕洛夫抗旋推', '抗旋推', '核心', 'isolation', 3, 10, 12, 45, 10),
    makeExercise('single_arm_carry', '单臂农夫走', '单臂农夫走', '核心', 'compound', 3, 20, 20, 45, 16),
  ],
});

const recoveryMobilityTemplate = (): TrainingTemplate => ({
  id: 'today-focus-recovery-mobility',
  name: '恢复 / 活动度',
  focus: '恢复',
  duration: 25,
  note: '今日手动选择恢复与活动度，只影响本次训练。',
  exercises: [
    makeExercise('breathing_90_90', '90/90 呼吸', '呼吸', '核心', 'isolation', 2, 5, 6, 30, 0),
    makeExercise('thoracic_extension_foam', '泡沫轴胸椎伸展', '胸椎伸展', '背', 'isolation', 2, 8, 10, 30, 0),
    makeExercise('hip_90_90_switch', '90/90 髋转换', '髋转换', '腿', 'isolation', 2, 6, 8, 30, 0),
    makeExercise('quadruped_thoracic_rotation', '四点跪胸椎旋转', '胸椎旋转', '背', 'isolation', 2, 6, 8, 30, 0),
  ],
});

const templateForOverride = (
  override: TodayTrainingFocusOverrideOption,
  templates: TrainingTemplate[],
  systemTemplate: TrainingTemplate,
) => {
  if (override === 'core') return { template: coreTemplate(), generated: true };
  if (override === 'recovery_mobility') return { template: recoveryMobilityTemplate(), generated: true };
  return { template: pickTemplateForFocus(override, templates, systemTemplate), generated: false };
};

const daysBetween = (left: string, right: string) => {
  const leftMs = new Date(`${left.slice(0, 10)}T00:00:00`).getTime();
  const rightMs = new Date(`${right.slice(0, 10)}T00:00:00`).getTime();
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return Number.POSITIVE_INFINITY;
  return Math.round((leftMs - rightMs) / 86400000);
};

const sessionMuscles = (session: TrainingSession) => {
  const muscles = new Set<string>();
  (session.exercises || []).forEach((exercise) => {
    getPrimaryMuscles(exercise).forEach((muscle) => muscles.add(muscle));
    if (exercise.muscle) muscles.add(exercise.muscle);
  });
  if (session.focus) muscles.add(session.focus);
  return muscles;
};

const recentLoadWarning = (
  selectedTemplate: TrainingTemplate,
  history: TrainingSession[],
  today: string,
): TodayTrainingFocusOverrideWarning | null => {
  const selectedMuscles = new Set<string>();
  (selectedTemplate.exercises || []).forEach((exercise) => {
    getPrimaryMuscles(exercise).forEach((muscle) => selectedMuscles.add(muscle));
    if (exercise.muscle) selectedMuscles.add(exercise.muscle);
  });

  const recent = [...history]
    .filter((session) => session.completed !== false)
    .filter((session) => daysBetween(today, session.finishedAt || session.startedAt || session.date || '') >= 0)
    .filter((session) => daysBetween(today, session.finishedAt || session.startedAt || session.date || '') <= 2)
    .find((session) => [...sessionMuscles(session)].some((muscle) => [...selectedMuscles].some((selected) => selected === muscle || selected.includes(muscle) || muscle.includes(selected))));

  if (!recent) return null;
  return {
    id: 'recent-load',
    message: `最近 2 天已经训练过相近部位，今天选择 ${formatTemplateName(selectedTemplate)} 时建议降低强度或减少总量。`,
  };
};

const readinessWarning = (readinessResult?: ReadinessResult | null): TodayTrainingFocusOverrideWarning | null => {
  if (!readinessResult) return null;
  if (readinessResult.trainingAdjustment !== 'recovery' && readinessResult.score >= 50) return null;
  return {
    id: 'readiness',
    message: '今天准备度偏低，手动选择训练目标时建议保留更多余力，不要强行加重量或加组。',
  };
};

const conflictWarning = (
  selectedTemplate: TrainingTemplate,
  todayStatus?: TodayStatus,
  painAreas: string[] = [],
  readinessResult?: ReadinessResult | null,
): TodayTrainingFocusOverrideWarning | null => {
  const conflict = buildTemplateRecoveryConflict({
    template: selectedTemplate,
    sorenessAreas: todayStatus?.soreness || [],
    painAreas,
    readinessResult,
  });
  const actionableLevels: RecoveryConflictLevel[] = ['moderate', 'high'];
  if (!actionableLevels.includes(conflict.conflictLevel)) return null;
  return {
    id: 'recovery-conflict',
    message: `${conflict.templateName} 与今天的酸痛、疲劳或恢复信号有冲突。你仍可开始，但建议按保守版本执行。`,
  };
};

const buildWarnings = ({
  selectedTemplate,
  todayStatus,
  readinessResult,
  history = [],
  painAreas = [],
  today,
}: Pick<BuildTodayTrainingFocusSelectionInput, 'todayStatus' | 'readinessResult' | 'history' | 'painAreas' | 'today'> & {
  selectedTemplate: TrainingTemplate;
}) =>
  [
    conflictWarning(selectedTemplate, todayStatus, painAreas, readinessResult),
    readinessWarning(readinessResult),
    recentLoadWarning(selectedTemplate, history, today || todayStatus?.date || todayKey()),
  ].filter((warning): warning is TodayTrainingFocusOverrideWarning => Boolean(warning));

export const buildTodayTrainingFocusSelection = ({
  systemTemplate,
  templates,
  override,
  todayStatus,
  readinessResult,
  history = [],
  painAreas = [],
  today,
}: BuildTodayTrainingFocusSelectionInput): TodayTrainingFocusSelection => {
  const normalizedOverride = normalizeOverride(override);
  const overrideActive = normalizedOverride !== 'system';
  const resolved = overrideActive ? templateForOverride(normalizedOverride, templates, systemTemplate) : { template: systemTemplate, generated: false };
  const selectedTemplateName = formatTemplateName(resolved.template);
  const systemTemplateName = formatTemplateName(systemTemplate);

  return {
    override: normalizedOverride,
    overrideActive,
    selectedTemplate: resolved.template,
    selectedTemplateId: resolved.template.id,
    selectedTemplateName,
    selectedFocusLabel: TODAY_TRAINING_FOCUS_OVERRIDE_LABELS[normalizedOverride],
    systemTemplate,
    systemTemplateId: systemTemplate.id,
    systemTemplateName,
    warnings: overrideActive
      ? buildWarnings({
          selectedTemplate: resolved.template,
          todayStatus,
          readinessResult,
          history,
          painAreas,
          today,
        })
      : [],
    generatedTemplate: resolved.generated,
  };
};

export const buildTodayFocusOverrideSessionMetadata = (
  selection: TodayTrainingFocusSelection,
  appliedAt: string,
): TrainingSession['todayFocusOverride'] | undefined => {
  if (!selection.overrideActive) return undefined;
  return {
    source: 'user',
    selectedFocus: selection.override,
    selectedFocusLabel: selection.selectedFocusLabel,
    selectedTemplateId: selection.selectedTemplateId,
    selectedTemplateName: selection.selectedTemplateName,
    systemTemplateId: selection.systemTemplateId,
    systemTemplateName: selection.systemTemplateName,
    appliedAt,
  };
};
