import { EXERCISE_KNOWLEDGE_OVERRIDES } from '../data/exerciseLibrary';
import { formatExerciseName, formatMuscleName, formatTemplateName } from '../i18n/formatters';
import type { ExerciseTemplate, ReadinessResult, TrainingTemplate } from '../models/training-model';
import { number } from './engineUtils';

export type DailyRecommendationKind = 'train' | 'modified_train' | 'rest' | 'active_recovery' | 'mobility_only';

export type RecoveryConflictLevel = 'none' | 'low' | 'moderate' | 'high';

export type RecoveryAwareRecommendation = {
  kind: DailyRecommendationKind;
  templateId?: string;
  templateName?: string;
  title: string;
  summary: string;
  conflictLevel: RecoveryConflictLevel;
  affectedAreas: string[];
  reasons: string[];
  suggestedChanges: Array<{
    type:
      | 'reduce_volume'
      | 'reduce_intensity'
      | 'skip_accessory'
      | 'avoid_movement_pattern'
      | 'choose_alternative_template'
      | 'rest';
    target?: string;
    reason: string;
  }>;
  requiresConfirmationToOverride: boolean;
};

export type TemplateBodyPartConflict = {
  score: number;
  level: RecoveryConflictLevel;
  affectedAreas: string[];
  conflictingExercises: Array<{
    exerciseId: string;
    exerciseName: string;
    reason: string;
  }>;
};

type BodyAreaKey = 'shoulder' | 'chest' | 'back' | 'leg' | 'arm';

type ConflictSource = {
  key: BodyAreaKey;
  label: string;
  weight: number;
  source: 'soreness' | 'pain';
};

type ExerciseMetaInput = Partial<
  Pick<ExerciseTemplate, 'id' | 'name' | 'muscle' | 'movementPattern' | 'primaryMuscles' | 'secondaryMuscles' | 'muscleContribution'>
>;

export type BuildTemplateBodyPartConflictInput = {
  template?: TrainingTemplate | null;
  sorenessAreas?: string[];
  painAreas?: string[];
  exerciseLibrary?: Record<string, ExerciseMetaInput>;
};

export type BuildRecoveryAwareRecommendationInput = BuildTemplateBodyPartConflictInput & {
  preferredTemplate?: TrainingTemplate | null;
  templates?: TrainingTemplate[];
  readinessResult?: ReadinessResult | null;
  availableTimeMin?: number;
};

const areaLabels: Record<BodyAreaKey, string> = {
  shoulder: '肩部',
  chest: '胸部',
  back: '背部',
  leg: '腿部',
  arm: '手臂',
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
  if (includesAny(text, [/back/i, /lat/i, /row/i, /pull/i, /背/])) keys.push('back');
  if (includesAny(text, [/leg/i, /quad/i, /hamstring/i, /glute/i, /calf/i, /knee/i, /hip/i, /腿/, /膝/, /髋/, /臀/, /小腿/])) keys.push('leg');
  if (includesAny(text, [/arm/i, /biceps/i, /triceps/i, /elbow/i, /手臂/, /二头/, /三头/, /肘/])) keys.push('arm');
  return [...new Set(keys)];
};

const bodyAreasFromValues = (values: string[] = [], source: ConflictSource['source']): ConflictSource[] =>
  values.flatMap((value) =>
    areaKeysFromText(value).map((key) => ({
      key,
      label: areaLabels[key],
      weight: source === 'pain' ? 1.7 : 1,
      source,
    })),
  );

const mergeSources = (sources: ConflictSource[]) => {
  const byKey = new Map<BodyAreaKey, ConflictSource>();
  sources.forEach((source) => {
    const existing = byKey.get(source.key);
    if (!existing || source.weight > existing.weight) byKey.set(source.key, source);
  });
  return [...byKey.values()];
};

const metaForExercise = (exercise: ExerciseTemplate, exerciseLibrary?: Record<string, ExerciseMetaInput>) => {
  const override = (EXERCISE_KNOWLEDGE_OVERRIDES[exercise.id] || {}) as ExerciseMetaInput;
  const external = exerciseLibrary?.[exercise.id] || {};
  return {
    ...exercise,
    ...override,
    ...external,
    id: exercise.id,
    name: external.name || exercise.name,
  };
};

const exerciseAreaKeys = (values: unknown[]): BodyAreaKey[] => [...new Set(values.flatMap(areaKeysFromText))];

const movementScore = (area: BodyAreaKey, movementPattern: unknown, exerciseId: string) => {
  const movement = `${normalize(movementPattern)} ${normalize(exerciseId)}`;
  if (area === 'shoulder') {
    if (includesAny(movement, [/垂直推/, /肩外展/, /肩胛/, /shoulder-press/, /lateral-raise/, /landmine/])) return 3;
    if (includesAny(movement, [/水平推/, /上斜推/, /斜向推/, /bench/, /press/])) return 2;
    if (includesAny(movement, [/水平拉/, /面拉/, /row/, /face-pull/])) return 1;
  }
  if (area === 'chest' && includesAny(movement, [/水平推/, /上斜推/, /飞鸟/, /bench/, /press/, /fly/])) return 3;
  if (area === 'back' && includesAny(movement, [/拉/, /划/, /髋铰链/, /硬拉/, /pull/, /row/, /deadlift/, /rdl/])) return 3;
  if (area === 'leg' && includesAny(movement, [/深蹲/, /腿举/, /髋铰链/, /膝/, /跖/, /髋伸/, /squat/, /leg/, /deadlift/, /rdl/, /hip/])) return 3;
  if (area === 'arm' && includesAny(movement, [/肘/, /推/, /拉/, /curl/, /pushdown/, /press/, /pull/, /row/])) return 2;
  return 0;
};

const scoreExerciseForArea = (exercise: ExerciseTemplate, source: ConflictSource, exerciseLibrary?: Record<string, ExerciseMetaInput>) => {
  const meta = metaForExercise(exercise, exerciseLibrary);
  const primary = exerciseAreaKeys([...(meta.primaryMuscles || []), meta.muscle]);
  const secondary = exerciseAreaKeys([...(meta.secondaryMuscles || []), ...Object.keys(meta.muscleContribution || {})]);
  const primaryScore = primary.includes(source.key) ? 3 : 0;
  const secondaryScore = secondary.includes(source.key) ? 1.4 : 0;
  const contributionScore = Math.min(1.5, number((meta.muscleContribution || {})[areaLabels[source.key].replace('部', '')]) * 1.5);
  const patternScore = movementScore(source.key, meta.movementPattern, meta.id || exercise.id);
  const score = (primaryScore + secondaryScore + contributionScore + patternScore) * source.weight;
  return {
    score,
    reason:
      score > 0
        ? `${formatExerciseName({ id: exercise.id, name: exercise.name })} 与${source.label}${source.source === 'pain' ? '不适' : '酸痛'}存在训练重叠。`
        : '',
  };
};

const levelForScore = (score: number, hasPain: boolean): RecoveryConflictLevel => {
  if (score < 0.5) return 'none';
  if (score < 4) return 'low';
  if (score < 8 && !(hasPain && score >= 5)) return 'moderate';
  return 'high';
};

export const buildTemplateBodyPartConflictScore = ({
  template,
  sorenessAreas = [],
  painAreas = [],
  exerciseLibrary,
}: BuildTemplateBodyPartConflictInput): TemplateBodyPartConflict => {
  if (!template) {
    return { score: 0, level: 'none', affectedAreas: [], conflictingExercises: [] };
  }
  const sources = mergeSources([
    ...bodyAreasFromValues(sorenessAreas, 'soreness'),
    ...bodyAreasFromValues(painAreas, 'pain'),
  ]);
  if (!sources.length) {
    return { score: 0, level: 'none', affectedAreas: [], conflictingExercises: [] };
  }

  const conflicts = (template.exercises || [])
    .map((exercise) => {
      const best = sources
        .map((source) => scoreExerciseForArea(exercise, source, exerciseLibrary))
        .sort((left, right) => right.score - left.score)[0];
      return {
        exercise,
        score: best?.score || 0,
        reason: best?.reason || '',
      };
    })
    .filter((item) => item.score > 0);

  const score = Math.round(conflicts.reduce((sum, item) => sum + item.score, 0) * 10) / 10;
  const level = levelForScore(score, painAreas.length > 0);

  return {
    score,
    level,
    affectedAreas: sources.map((source) => source.label),
    conflictingExercises: conflicts
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((item) => ({
        exerciseId: item.exercise.id,
        exerciseName: formatExerciseName({ id: item.exercise.id, name: item.exercise.name }),
        reason: item.reason,
      })),
  };
};

const lowReadiness = (readinessResult?: ReadinessResult | null) =>
  Boolean(readinessResult && (readinessResult.score < 50 || readinessResult.trainingAdjustment === 'recovery'));

const conflictLabel = (level: RecoveryConflictLevel) =>
  ({
    none: '无明显冲突',
    low: '轻度冲突',
    moderate: '中等冲突',
    high: '较高冲突',
  })[level];

const baseReasons = (templateName: string, conflict: TemplateBodyPartConflict) => {
  if (conflict.level === 'none') return [`${templateName} 与今天标记的酸痛部位没有明显重叠。`];
  return [
    `你标记的${conflict.affectedAreas.join('、')}与 ${templateName} 存在${conflictLabel(conflict.level)}。`,
    ...(conflict.conflictingExercises[0] ? [conflict.conflictingExercises[0].reason] : []),
  ];
};

const findLowerConflictTemplate = (
  preferredTemplate: TrainingTemplate,
  templates: TrainingTemplate[],
  sorenessAreas: string[],
  painAreas: string[],
  exerciseLibrary?: Record<string, ExerciseMetaInput>,
) =>
  templates
    .filter((template) => template.id !== preferredTemplate.id)
    .map((template) => ({
      template,
      conflict: buildTemplateBodyPartConflictScore({ template, sorenessAreas, painAreas, exerciseLibrary }),
    }))
    .filter((item) => item.conflict.level === 'none' || item.conflict.level === 'low')
    .sort((left, right) => left.conflict.score - right.conflict.score || left.template.duration - right.template.duration)[0];

export const buildRecoveryAwareRecommendation = ({
  preferredTemplate,
  template,
  templates = [],
  sorenessAreas = [],
  painAreas = [],
  exerciseLibrary,
  readinessResult,
  availableTimeMin,
}: BuildRecoveryAwareRecommendationInput): RecoveryAwareRecommendation => {
  const targetTemplate = preferredTemplate || template || templates[0];
  if (!targetTemplate) {
    return {
      kind: 'active_recovery',
      title: '今日建议：主动恢复',
      summary: '当前没有可用训练模板，今天可以安排轻量活动度、步行或休息。',
      conflictLevel: 'none',
      affectedAreas: [],
      reasons: ['没有可用训练模板，因此不生成正式训练建议。'],
      suggestedChanges: [{ type: 'rest', reason: '先保留恢复空间，等计划可用后再开始训练。' }],
      requiresConfirmationToOverride: false,
    };
  }

  const templateName = formatTemplateName(targetTemplate);
  const conflict = buildTemplateBodyPartConflictScore({
    template: targetTemplate,
    sorenessAreas,
    painAreas,
    exerciseLibrary,
  });
  const readinessIsLow = lowReadiness(readinessResult);
  const availableTime = number(availableTimeMin);
  const reasons = baseReasons(templateName, conflict);

  if (conflict.level === 'high' && readinessIsLow) {
    return {
      kind: 'rest',
      title: '今日建议：休息',
      summary: `${templateName} 与今天的恢复信号冲突较高，且准备度偏低。建议今天休息或做很轻量的恢复活动。`,
      conflictLevel: conflict.level,
      affectedAreas: conflict.affectedAreas,
      reasons: [...reasons, '准备度偏低时，高冲突模板不适合作为正常训练推荐。'],
      suggestedChanges: [{ type: 'rest', reason: '今天保留恢复空间，不强行安排正式训练。' }],
      requiresConfirmationToOverride: true,
    };
  }

  if (conflict.level === 'high') {
    const alternative = findLowerConflictTemplate(targetTemplate, templates, sorenessAreas, painAreas, exerciseLibrary);
    if (alternative) {
      const alternativeName = formatTemplateName(alternative.template);
      return {
        kind: 'train',
        templateId: alternative.template.id,
        templateName: alternativeName,
        title: `今日建议：${alternativeName}`,
        summary: `${templateName} 与今天的酸痛部位冲突较高，建议改为低冲突的 ${alternativeName}。`,
        conflictLevel: conflict.level,
        affectedAreas: conflict.affectedAreas,
        reasons: [...reasons, `${alternativeName} 与当前酸痛部位重叠更少。`],
        suggestedChanges: [
          {
            type: 'choose_alternative_template',
            target: alternative.template.id,
            reason: `改为 ${alternativeName}，避免把主要压力继续放在${conflict.affectedAreas.join('、')}。`,
          },
        ],
        requiresConfirmationToOverride: true,
      };
    }

    return {
      kind: 'active_recovery',
      title: '今日建议：主动恢复',
      summary: `${templateName} 与今天的酸痛部位冲突较高，当前没有更低冲突的训练模板。建议安排主动恢复。`,
      conflictLevel: conflict.level,
      affectedAreas: conflict.affectedAreas,
      reasons,
      suggestedChanges: [{ type: 'rest', reason: '用主动恢复替代正式训练，避免继续刺激高冲突部位。' }],
      requiresConfirmationToOverride: true,
    };
  }

  if (conflict.level === 'moderate') {
    if (availableTime > 0 && availableTime <= 30) {
      return {
        kind: 'mobility_only',
        templateId: targetTemplate.id,
        templateName,
        title: '今日建议：只做活动度 / 纠偏',
        summary: `${templateName} 与今天的酸痛部位有中等重叠，且可用时间较少。建议只做轻量活动度或纠偏。`,
        conflictLevel: conflict.level,
        affectedAreas: conflict.affectedAreas,
        reasons,
        suggestedChanges: [
          { type: 'avoid_movement_pattern', reason: '跳过高冲突动作模式，只保留轻量活动度。' },
          { type: 'skip_accessory', reason: '今天不额外堆叠辅助动作。' },
        ],
        requiresConfirmationToOverride: true,
      };
    }

    return {
      kind: 'modified_train',
      templateId: targetTemplate.id,
      templateName,
      title: `今日建议：${templateName}（保守建议）`,
      summary: `${templateName} 可以训练，但建议降低相关部位训练压力，不按正常强度推进。`,
      conflictLevel: conflict.level,
      affectedAreas: conflict.affectedAreas,
      reasons,
      suggestedChanges: [
        { type: 'reduce_volume', target: targetTemplate.id, reason: '减少与酸痛部位相关的额外组数。' },
        { type: 'reduce_intensity', target: targetTemplate.id, reason: '相关动作采用更保守的重量和余力（RIR）。' },
        { type: 'skip_accessory', target: targetTemplate.id, reason: '优先跳过高冲突辅助动作。' },
      ],
      requiresConfirmationToOverride: true,
    };
  }

  return {
    kind: 'train',
    templateId: targetTemplate.id,
    templateName,
    title: `今日建议：${templateName}`,
    summary:
      conflict.level === 'low'
        ? `${templateName} 与今天的酸痛部位只有轻度重叠，可以训练，但注意动作质量。`
        : `${templateName} 可以按计划训练。`,
    conflictLevel: conflict.level,
    affectedAreas: conflict.affectedAreas,
    reasons,
    suggestedChanges:
      conflict.level === 'low'
        ? [{ type: 'reduce_intensity', target: targetTemplate.id, reason: '如酸痛加重，相关动作保持保守。' }]
        : [],
    requiresConfirmationToOverride: false,
  };
};
