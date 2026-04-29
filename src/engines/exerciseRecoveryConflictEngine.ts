import { EXERCISE_DISPLAY_NAMES, EXERCISE_KNOWLEDGE_OVERRIDES } from '../data/exerciseLibrary';
import { formatExerciseName } from '../i18n/formatters';
import type { ExerciseMetadata, ExerciseTemplate } from '../models/training-model';

export type ExerciseRecoveryConflictLevel = 'none' | 'low' | 'moderate' | 'high';

export type ExerciseRecoveryAction = 'keep' | 'reduce_intensity' | 'reduce_volume' | 'substitute' | 'skip';

export type ExerciseRecoveryConflict = {
  exerciseId: string;
  exerciseName: string;
  conflictLevel: ExerciseRecoveryConflictLevel;
  affectedAreas: string[];
  reason: string;
  recommendedAction: ExerciseRecoveryAction;
};

type BodyAreaKey = 'shoulder' | 'chest' | 'back' | 'leg' | 'arm';

type RecoverySource = {
  key: BodyAreaKey;
  label: string;
  stateLabel: '酸痛' | '不适';
  weight: number;
  isPain: boolean;
};

type ExerciseInput = Pick<ExerciseTemplate, 'id'> & Partial<ExerciseTemplate> & ExerciseMetadata;

export type BuildExerciseRecoveryConflictInput = {
  exercise: ExerciseInput;
  sorenessAreas?: string[];
  painAreas?: string[];
};

const areaLabels: Record<BodyAreaKey, string> = {
  shoulder: '肩部',
  chest: '胸部',
  back: '背部',
  leg: '腿部',
  arm: '手臂',
};

const areaMuscleNames: Record<BodyAreaKey, string> = {
  shoulder: '肩',
  chest: '胸',
  back: '背',
  leg: '腿',
  arm: '手臂',
};

const levelLabels: Record<ExerciseRecoveryConflictLevel, string> = {
  none: '无明显',
  low: '轻度',
  moderate: '中等',
  high: '较高',
};

const actionReason: Record<ExerciseRecoveryAction, string> = {
  keep: '可以按计划执行',
  reduce_intensity: '建议降低强度',
  reduce_volume: '建议减少训练量',
  substitute: '建议优先考虑替代动作',
  skip: '建议本次先跳过',
};

const normalize = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const includesAny = (value: string, tokens: Array<string | RegExp>) =>
  tokens.some((token) => (typeof token === 'string' ? value.includes(token.toLowerCase()) : token.test(value)));

const areaKeysFromText = (value: unknown): BodyAreaKey[] => {
  const text = normalize(value);
  if (!text || text === 'none' || text === 'no' || text === '无') return [];
  const keys: BodyAreaKey[] = [];
  if (includesAny(text, [/shoulder/i, /deltoid/i, /肩/])) keys.push('shoulder');
  if (includesAny(text, [/chest/i, /pec/i, /胸/])) keys.push('chest');
  if (includesAny(text, [/back/i, /lat/i, /lats/i, /背/, /腰/, /下背/])) keys.push('back');
  if (includesAny(text, [/leg/i, /quad/i, /hamstring/i, /glute/i, /calf/i, /knee/i, /hip/i, /腿/, /膝/, /髋/, /臀/, /小腿/, /股四/, /腘绳/])) {
    keys.push('leg');
  }
  if (includesAny(text, [/arm/i, /biceps/i, /triceps/i, /elbow/i, /手臂/, /二头/, /三头/, /肘/])) keys.push('arm');
  return [...new Set(keys)];
};

const sourcesFromAreas = (areas: string[] = [], isPain: boolean): RecoverySource[] =>
  areas.flatMap((area) =>
    areaKeysFromText(area).map((key) => ({
      key,
      label: areaLabels[key],
      stateLabel: isPain ? '不适' : '酸痛',
      weight: isPain ? 1.7 : 1,
      isPain,
    })),
  );

const mergeSources = (sources: RecoverySource[]) => {
  const byKey = new Map<BodyAreaKey, RecoverySource>();
  sources.forEach((source) => {
    const existing = byKey.get(source.key);
    if (!existing || source.weight > existing.weight) byKey.set(source.key, source);
  });
  return [...byKey.values()];
};

const toStringArray = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item)) : []);

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeFatigueCost = (value: unknown) => (value === 'high' || value === 'medium' || value === 'low' ? value : 'medium');

const normalizeSkillDemand = (value: unknown) => (value === 'high' || value === 'medium' || value === 'low' ? value : 'medium');

const buildExerciseMeta = (exercise: ExerciseInput) => {
  const id = String(exercise.id || '');
  const override = (EXERCISE_KNOWLEDGE_OVERRIDES[id] || {}) as Partial<ExerciseMetadata>;
  return {
    ...override,
    ...exercise,
    id,
    name: exercise.name || EXERCISE_DISPLAY_NAMES[id] || '未命名动作',
    muscle: exercise.muscle || '',
  };
};

const exerciseAreaKeys = (values: unknown[]) => [...new Set(values.flatMap(areaKeysFromText))];

const isLegPressText = (text: string) => includesAny(text, [/leg-press/, /腿举/]);

const movementScore = (area: BodyAreaKey, meta: ReturnType<typeof buildExerciseMeta>) => {
  const movement = `${normalize(meta.id)} ${normalize(meta.name)} ${normalize(meta.movementPattern)}`;
  if (area === 'shoulder') {
    if (includesAny(movement, [/垂直推/, /肩外展/, /肩胛/, /shoulder-press/, /lateral-raise/, /landmine/])) return 5;
    if (!isLegPressText(movement) && includesAny(movement, [/水平推/, /上斜推/, /斜向推/, /卧推/, /推胸/, /bench/, /chest-press/, /push-up/])) return 4;
    if (includesAny(movement, [/水平拉/, /面拉/, /row/, /face-pull/])) return 1.5;
  }
  if (area === 'chest') {
    if (!isLegPressText(movement) && includesAny(movement, [/水平推/, /上斜推/, /飞鸟/, /卧推/, /推胸/, /夹胸/, /bench/, /chest-press/, /fly/, /push-up/])) return 6;
  }
  if (area === 'back') {
    if (includesAny(movement, [/杠铃划船/, /水平拉/, /垂直拉/, /引体/, /下拉/, /barbell-row/, /row/, /pulldown/, /pull-up/])) return 6;
    if (includesAny(movement, [/髋铰链/, /硬拉/, /deadlift/, /rdl/])) return 4;
    if (includesAny(movement, [/深蹲/, /squat/])) return 2;
  }
  if (area === 'leg') {
    if (includesAny(movement, [/深蹲/, /腿举/, /髋铰链/, /膝屈/, /膝伸/, /跖屈/, /髋伸/, /硬拉/, /squat/, /leg-press/, /leg-curl/, /calf/, /deadlift/, /rdl/, /hip/])) return 6;
  }
  if (area === 'arm') {
    if (includesAny(movement, [/肘屈/, /肘伸/, /弯举/, /下压/, /curl/, /pushdown/, /triceps/, /biceps/])) return 6;
    if (!isLegPressText(movement) && includesAny(movement, [/卧推/, /肩推/, /下拉/, /划船/, /引体/, /bench/, /shoulder-press/, /chest-press/, /pulldown/, /pull-up/, /row/])) return 2;
  }
  return 0;
};

const scoreExerciseForSource = (meta: ReturnType<typeof buildExerciseMeta>, source: RecoverySource) => {
  const primaryAreas = exerciseAreaKeys([...(toStringArray(meta.primaryMuscles)), meta.muscle]);
  const secondaryAreas = exerciseAreaKeys(toStringArray(meta.secondaryMuscles));
  const primaryScore = primaryAreas.includes(source.key) ? 6 : 0;
  const secondaryScore = secondaryAreas.includes(source.key) ? 2 : 0;
  const contribution = toNumber((meta.muscleContribution || {})[areaMuscleNames[source.key]]);
  const contributionScore = contribution > 0 ? Math.min(1.5, contribution * 1.5) : 0;
  const patternScore = movementScore(source.key, meta);
  const baseScore = primaryScore + secondaryScore + contributionScore + patternScore;
  const fatigueCost = normalizeFatigueCost(meta.fatigueCost);
  const skillDemand = normalizeSkillDemand(meta.skillDemand);
  const auxiliaryScore =
    baseScore > 0
      ? (fatigueCost === 'high' ? 0.7 : fatigueCost === 'medium' ? 0.25 : 0) + (skillDemand === 'high' ? 0.5 : skillDemand === 'medium' ? 0.15 : 0)
      : 0;
  const details = [
    primaryScore ? `${source.label}是主要训练部位` : '',
    secondaryScore ? `${source.label}参与稳定或辅助` : '',
    patternScore >= 4 ? '动作模式会明显调用相关部位' : patternScore > 0 ? '动作模式会轻度调用相关部位' : '',
    fatigueCost === 'high' && baseScore > 0 ? '疲劳成本较高' : '',
    skillDemand === 'high' && baseScore > 0 ? '技术要求较高' : '',
  ].filter(Boolean);

  return {
    source,
    score: (baseScore + auxiliaryScore) * source.weight,
    details,
  };
};

const levelForScore = (score: number): ExerciseRecoveryConflictLevel => {
  if (score < 0.75) return 'none';
  if (score < 3.5) return 'low';
  if (score < 7) return 'moderate';
  return 'high';
};

const recommendedActionFor = (level: ExerciseRecoveryConflictLevel, hasPain: boolean, fatigueCost: string): ExerciseRecoveryAction => {
  if (level === 'none') return 'keep';
  if (level === 'low') return hasPain ? 'reduce_intensity' : 'keep';
  if (level === 'moderate') return hasPain ? 'substitute' : 'reduce_intensity';
  if (hasPain) return 'skip';
  return fatigueCost === 'high' ? 'substitute' : 'reduce_volume';
};

export const buildExerciseRecoveryConflict = ({
  exercise,
  sorenessAreas = [],
  painAreas = [],
}: BuildExerciseRecoveryConflictInput): ExerciseRecoveryConflict => {
  const meta = buildExerciseMeta(exercise);
  const exerciseName = formatExerciseName({ id: meta.id, name: meta.name }, '未命名动作');
  const sources = mergeSources([...sourcesFromAreas(sorenessAreas, false), ...sourcesFromAreas(painAreas, true)]);
  const scored = sources.map((source) => scoreExerciseForSource(meta, source)).sort((left, right) => right.score - left.score);
  const best = scored[0];
  const level = levelForScore(best?.score || 0);
  const affectedAreas = scored.filter((item) => item.score >= 0.75).map((item) => item.source.label);
  const recommendedAction = recommendedActionFor(level, Boolean(best?.source.isPain), normalizeFatigueCost(meta.fatigueCost));
  const reason =
    level === 'none'
      ? `${exerciseName}与已标记部位没有明显训练重叠，可以按计划执行。`
      : `${best.source.label}${best.source.stateLabel}与${exerciseName}存在${levelLabels[level]}恢复冲突：${best.details.slice(0, 2).join('，')}，${actionReason[recommendedAction]}。`;

  return {
    exerciseId: meta.id,
    exerciseName,
    conflictLevel: level,
    affectedAreas: [...new Set(affectedAreas)],
    reason,
    recommendedAction,
  };
};
