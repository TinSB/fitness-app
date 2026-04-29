import { EXERCISE_DISPLAY_NAMES, EXERCISE_KNOWLEDGE_OVERRIDES } from '../data/trainingData';
import type { AppData, TrainingSession, TrainingSetLog, WeightUnit } from '../models/training-model';
import { number, sessionCompletedSets, sessionVolume } from './engineUtils';
import { isSyntheticReplacementExerciseId, validateReplacementExerciseId } from './replacementEngine';

export type DataHealthSeverity = 'info' | 'warning' | 'error';

export type DataHealthIssue = {
  id: string;
  severity: DataHealthSeverity;
  category:
    | 'replacement'
    | 'unit'
    | 'history'
    | 'summary'
    | 'analytics'
    | 'healthData'
    | 'template'
    | 'unknown';
  title: string;
  message: string;
  affectedIds?: string[];
  canAutoFix: boolean;
  suggestedAction?: string;
};

export type DataHealthReport = {
  status: 'healthy' | 'has_warnings' | 'has_errors';
  issues: DataHealthIssue[];
  summary: string;
};

const dataHealthSeverityRank: Record<DataHealthSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

export const sortDataHealthIssues = (issues: DataHealthIssue[] = []) =>
  [...issues].sort((left, right) => {
    const severityDiff = dataHealthSeverityRank[right.severity] - dataHealthSeverityRank[left.severity];
    if (severityDiff !== 0) return severityDiff;
    return left.title.localeCompare(right.title, 'zh-CN');
  });

type SessionSource = 'active' | 'history';
type IssueInput = Omit<DataHealthIssue, 'affectedIds' | 'suggestedAction'> & {
  affectedIds?: string[];
  suggestedAction?: string;
};

const VALID_DISPLAY_UNITS = new Set<WeightUnit>(['kg', 'lb']);
const EXTERNAL_WORKOUT_FIELDS = [
  'externalWorkoutId',
  'importedWorkoutId',
  'healthWorkoutId',
  'appleWorkoutId',
  'workoutType',
];
const EXTERNAL_SOURCE_FIELDS = ['source', 'sourceType', 'importSource', 'importedFrom', 'sourceName', 'deviceSourceName'];
const ANALYTICS_INCLUDED_FLAGS = ['includedInAnalytics', 'analyticsIncluded', 'includeInAnalytics'];
const READINESS_INCLUDED_FLAGS = ['includedInReadiness', 'readinessIncluded', 'usedForReadiness'];

const issue = (input: IssueInput): DataHealthIssue => {
  const next: DataHealthIssue = {
    id: input.id,
    severity: input.severity,
    category: input.category,
    title: input.title,
    message: input.message,
    canAutoFix: input.canAutoFix,
  };
  if (input.affectedIds?.length) next.affectedIds = [...new Set(input.affectedIds.filter(Boolean).map(String))];
  if (input.suggestedAction) next.suggestedAction = input.suggestedAction;
  return next;
};

const hasOwnTruthyFlag = (value: Record<string, unknown>, fields: string[]) => fields.some((field) => value[field] === true);

const textIncludesExternalWorkoutSource = (value: unknown) => {
  const text = String(value || '').toLowerCase();
  return text.includes('apple_watch') || text.includes('apple watch') || text.includes('apple_health') || text.includes('healthkit');
};

const isKnownExerciseId = (id: unknown) => {
  const value = String(id || '').trim();
  if (!value) return false;
  return Boolean(EXERCISE_DISPLAY_NAMES[value] || EXERCISE_KNOWLEDGE_OVERRIDES[value]);
};

const sessionLabel = (source: SessionSource, session: TrainingSession) =>
  source === 'active' ? `当前训练 ${session.id}` : `历史训练 ${session.id}`;

const sessionSources = (appData: Partial<AppData>): Array<{ source: SessionSource; session: TrainingSession }> => [
  ...(appData.activeSession ? [{ source: 'active' as const, session: appData.activeSession }] : []),
  ...((appData.history || []).map((session) => ({ source: 'history' as const, session }))),
];

const collectSessionSets = (session: TrainingSession) =>
  (session.exercises || []).flatMap((exercise) =>
    Array.isArray(exercise.sets)
      ? exercise.sets.map((set, setIndex) => ({ exercise, set, setIndex, source: 'exercise' as const }))
      : []
  );

const collectAllSessionSets = (session: TrainingSession) => [
  ...collectSessionSets(session),
  ...((session.focusWarmupSetLogs || []).map((set, setIndex) => ({
    exercise: session.exercises?.[0],
    set,
    setIndex,
    source: 'focusWarmup' as const,
  })) || []),
];

const setRawType = (set: TrainingSetLog) =>
  String((set as TrainingSetLog & { setType?: unknown; stepType?: unknown }).setType || (set as TrainingSetLog & { stepType?: unknown }).stepType || set.type || '')
    .trim()
    .toLowerCase();

const hasExplicitWarmupMarker = (set: TrainingSetLog) => {
  const raw = setRawType(set);
  return raw === 'warmup' || Boolean((set as TrainingSetLog & { isWarmup?: unknown }).isWarmup);
};

const isLikelyWarmupSet = (set: TrainingSetLog, source?: string) => {
  const raw = setRawType(set);
  return source === 'focusWarmup' || raw === 'warmup' || Boolean((set as TrainingSetLog & { isWarmup?: unknown }).isWarmup) || String(set.id || '').includes(':warmup:');
};

const hasAnySetLogs = (session: TrainingSession) =>
  (session.exercises || []).some((exercise) => Array.isArray(exercise.sets) && exercise.sets.length > 0) || Boolean(session.focusWarmupSetLogs?.length);

const hasCompletedSetLogs = (session: TrainingSession) =>
  collectAllSessionSets(session).some(({ set }) => set.done !== false && number(set.actualWeightKg ?? set.weight) > 0 && number(set.reps) > 0);

const isExternalWorkoutSession = (session: TrainingSession, importedWorkoutIds: Set<string>) => {
  const raw = session as TrainingSession & Record<string, unknown>;
  if (importedWorkoutIds.has(session.id)) return true;
  if (EXTERNAL_WORKOUT_FIELDS.some((field) => Boolean(raw[field]))) return true;
  return EXTERNAL_SOURCE_FIELDS.some((field) => textIncludesExternalWorkoutSource(raw[field]));
};

const hasReasonForMixedUnits = (session: TrainingSession) => {
  const raw = session as TrainingSession & Record<string, unknown>;
  return Boolean(raw.unitMixedReason || raw.unitConversionNote || raw.mixedUnitReason);
};

const scanReplacementIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];

  sessionSources(appData).forEach(({ source, session }) => {
    (session.exercises || []).forEach((exercise, exerciseIndex) => {
      const ids = {
        exerciseId: exercise.id,
        originalExerciseId: exercise.originalExerciseId,
        actualExerciseId: exercise.actualExerciseId,
        replacementExerciseId: exercise.replacementExerciseId,
      };
      Object.entries(ids).forEach(([field, value]) => {
        if (!value || !isSyntheticReplacementExerciseId(value)) return;
        issues.push(issue({
          id: `synthetic-replacement-${session.id}-${exerciseIndex}-${field}`,
          severity: 'error',
          category: 'replacement',
          title: '发现无效替代动作编号',
          message: `${sessionLabel(source, session)} 中有替代动作使用临时编号。该记录需要人工复查，避免影响动作历史和 PR / e1RM 归属。`,
          affectedIds: [session.id, String(value)],
          canAutoFix: false,
          suggestedAction: '打开历史详情，确认原计划动作和实际执行动作后再保存修正。',
        }));
      });

      const actualId = exercise.actualExerciseId || exercise.replacementExerciseId;
      if (actualId && !validateReplacementExerciseId(actualId)) {
        issues.push(issue({
          id: `missing-actual-exercise-${session.id}-${exerciseIndex}`,
          severity: 'error',
          category: 'replacement',
          title: '实际执行动作不存在',
          message: `${sessionLabel(source, session)} 中的实际执行动作没有在动作库中找到。该记录需要人工确认后再参与动作维度统计。`,
          affectedIds: [session.id, String(actualId)],
          canAutoFix: false,
          suggestedAction: '选择一个真实动作库动作作为实际执行动作。',
        }));
      }

      if (exercise.replacementExerciseId) {
        if (!exercise.originalExerciseId && !exercise.replacedFromId && !exercise.baseId) {
          issues.push(issue({
            id: `replacement-missing-original-${session.id}-${exerciseIndex}`,
            severity: 'warning',
            category: 'replacement',
            title: '替代动作缺少原计划动作',
            message: `${sessionLabel(source, session)} 中有替代动作，但缺少原计划动作信息。后续回看时可能无法解释为什么替换。`,
            affectedIds: [session.id, exercise.replacementExerciseId],
            canAutoFix: false,
            suggestedAction: '在历史详情中补充原计划动作和实际执行动作。',
          }));
        }
        if (exercise.actualExerciseId && exercise.actualExerciseId !== exercise.replacementExerciseId) {
          issues.push(issue({
            id: `replacement-actual-mismatch-${session.id}-${exerciseIndex}`,
            severity: 'warning',
            category: 'replacement',
            title: '替代动作关系不一致',
            message: `${sessionLabel(source, session)} 中的替代动作和实际执行动作不一致。请确认本次训练到底执行了哪个动作。`,
            affectedIds: [session.id, exercise.actualExerciseId, exercise.replacementExerciseId],
            canAutoFix: false,
            suggestedAction: '保留真实执行动作，避免动作历史混到错误动作下。',
          }));
        }
      }
    });
  });

  return issues;
};

const scanUnitIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];

  sessionSources(appData).forEach(({ source, session }) => {
    const units = new Set<WeightUnit>();
    collectAllSessionSets(session).forEach(({ set, setIndex }) => {
      const displayUnit = set.displayUnit;
      if (displayUnit && VALID_DISPLAY_UNITS.has(displayUnit)) units.add(displayUnit);
      if (displayUnit === 'lb' && set.displayWeight !== undefined && !Number.isInteger(number(set.displayWeight))) {
        issues.push(issue({
          id: `lb-display-decimal-${session.id}-${set.id || setIndex}`,
          severity: 'warning',
          category: 'unit',
          title: '磅制重量显示有异常小数',
          message: `${sessionLabel(source, session)} 中有磅制重量显示为小数。磅制显示应按当前单位规则取整，避免用户误以为输入精度发生变化。`,
          affectedIds: [session.id, set.id],
          canAutoFix: false,
          suggestedAction: '重新格式化显示重量；保存层仍应保留公斤原始值。',
        }));
      }
    });

    if (units.size > 1 && !hasReasonForMixedUnits(session)) {
      issues.push(issue({
        id: `mixed-display-unit-${session.id}`,
        severity: 'warning',
        category: 'unit',
        title: '同一次训练内单位混杂',
        message: `${sessionLabel(source, session)} 中同时出现 kg 和 lb 显示单位。请确认是否为切换单位后的旧记录，而不是输入错误。`,
        affectedIds: [session.id],
        canAutoFix: false,
        suggestedAction: '按当前单位检查每组重量，必要时用修正记录重新保存。',
      }));
    }
  });

  return issues;
};

const scanSummaryIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];

  sessionSources(appData).forEach(({ source, session }) => {
    if (!hasAnySetLogs(session)) return;
    const calculatedCompletedSets = sessionCompletedSets(session);
    const calculatedVolume = sessionVolume(session);
    const stored = session as TrainingSession & Record<string, unknown>;
    const storedCompletedSets = stored.completedSets;
    const storedTotalVolume = stored.totalVolume ?? stored.totalVolumeKg ?? stored.workingVolumeKg;

    if (storedCompletedSets !== undefined && number(storedCompletedSets) === 0 && calculatedCompletedSets > 0) {
      issues.push(issue({
        id: `summary-completed-zero-${session.id}`,
        severity: 'warning',
        category: 'summary',
        title: '顶部完成组数和动作记录不一致',
        message: `${sessionLabel(source, session)} 有已完成动作记录，但缓存的完成组数为 0。详情页应从同一份组记录重新计算。`,
        affectedIds: [session.id],
        canAutoFix: false,
        suggestedAction: '重新生成详情摘要，不要直接信任旧缓存字段。',
      }));
    }

    if (storedTotalVolume !== undefined && number(storedTotalVolume) === 0 && calculatedVolume > 0) {
      issues.push(issue({
        id: `summary-volume-zero-${session.id}`,
        severity: 'warning',
        category: 'summary',
        title: '顶部总量和动作记录不一致',
        message: `${sessionLabel(source, session)} 有重量和次数记录，但缓存的训练总量为 0。请以正式组记录重新计算展示。`,
        affectedIds: [session.id],
        canAutoFix: false,
        suggestedAction: '重新生成详情摘要，并确认单位显示来自当前单位设置。',
      }));
    }
  });

  return issues;
};

const scanWarmupIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];

  sessionSources(appData).forEach(({ source, session }) => {
    collectAllSessionSets(session).forEach(({ set, setIndex, source: setSource }) => {
      const likelyWarmup = isLikelyWarmupSet(set, setSource);
      if (!likelyWarmup) return;
      if (!hasExplicitWarmupMarker(set)) {
        issues.push(issue({
          id: `warmup-missing-type-${session.id}-${set.id || setIndex}`,
          severity: 'warning',
          category: 'history',
          title: '热身组缺少类型标记',
          message: `${sessionLabel(source, session)} 中有热身组记录缺少明确类型。它可能被当作正式组，进而影响 PR、e1RM 或有效组统计。`,
          affectedIds: [session.id, set.id],
          canAutoFix: false,
          suggestedAction: '在历史修正中把该组标记为热身组。',
        }));
      }

      const raw = set as TrainingSetLog & Record<string, unknown>;
      if (raw.prCandidate === true || raw.isPr === true || raw.countsForPr === true || raw.e1rmKg !== undefined || raw.estimated1RM !== undefined) {
        issues.push(issue({
          id: `warmup-analytics-marker-${session.id}-${set.id || setIndex}`,
          severity: 'error',
          category: 'analytics',
          title: '热身组带有强度统计标记',
          message: `${sessionLabel(source, session)} 中有热身组被标记为可进入 PR 或 e1RM。热身组只能用于回看，不应污染强度统计。`,
          affectedIds: [session.id, set.id],
          canAutoFix: false,
          suggestedAction: '取消该组的 PR / e1RM 统计标记，并保留为热身组。',
        }));
      }
    });
  });

  return issues;
};

const scanAnalyticsFlagIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];

  (appData.history || []).forEach((session) => {
    const raw = session as TrainingSession & Record<string, unknown>;
    const nonNormal = session.dataFlag === 'test' || session.dataFlag === 'excluded';
    if (!nonNormal) return;
    if (hasOwnTruthyFlag(raw, ANALYTICS_INCLUDED_FLAGS)) {
      issues.push(issue({
        id: `excluded-session-in-analytics-${session.id}`,
        severity: 'error',
        category: 'analytics',
        title: '测试或排除训练仍被统计',
        message: `历史训练 ${session.id} 已标记为测试或排除，但仍带有参与统计标记。它不应进入 PR、e1RM、有效组或完成率统计。`,
        affectedIds: [session.id],
        canAutoFix: false,
        suggestedAction: '确认该记录是否应恢复为正常数据；否则请保持排除并重新生成统计。',
      }));
      return;
    }
    if (hasCompletedSetLogs(session)) {
      issues.push(issue({
        id: `non-normal-session-present-${session.id}`,
        severity: 'info',
        category: 'analytics',
        title: '发现测试或排除训练',
        message: `历史训练 ${session.id} 已标记为测试或排除。它可以保留在历史中查看，但不应参与 PR、e1RM、有效组或完成率统计。`,
        affectedIds: [session.id],
        canAutoFix: false,
        suggestedAction: '如果这是正式训练，请手动恢复为正常数据。',
      }));
    }
  });

  return issues;
};

const scanImportedWorkoutIssues = (appData: Partial<AppData>) => {
  const importedWorkoutIds = new Set((appData.importedWorkoutSamples || []).map((workout) => workout.id));
  return (appData.history || [])
    .filter((session) => isExternalWorkoutSession(session, importedWorkoutIds))
    .map((session) =>
      issue({
        id: `external-workout-in-history-${session.id}`,
        severity: 'error',
        category: 'healthData',
        title: '外部活动进入力量训练历史',
        message: `历史训练 ${session.id} 看起来来自 Apple Watch 或健康导入。外部活动应显示在日历背景中，不应自动变成 IronPath 力量训练记录。`,
        affectedIds: [session.id],
        canAutoFix: false,
        suggestedAction: '保留外部活动在健康数据中显示；如需力量训练记录，请手动创建或修正。',
      })
    );
};

const scanTemplateIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];
  const templates = appData.templates || [];

  templates.forEach((template) => {
    (template.exercises || []).forEach((exercise, exerciseIndex) => {
      if (!isKnownExerciseId(exercise.id)) {
        issues.push(issue({
          id: `template-missing-exercise-${template.id}-${exerciseIndex}`,
          severity: 'error',
          category: 'template',
          title: '计划模板引用了不存在的动作',
          message: `训练模板中的某个动作没有在动作库中找到。请先确认动作库映射，再用于生成训练。`,
          affectedIds: [template.id, exercise.id],
          canAutoFix: false,
          suggestedAction: '把模板动作替换为动作库中的真实动作。',
        }));
      }

      const relatedIds = [
        ...(exercise.alternativeIds || []),
        ...(exercise.regressionIds || []),
        ...(exercise.progressionIds || []),
      ];
      relatedIds.forEach((relatedId) => {
        if (isKnownExerciseId(relatedId)) return;
        issues.push(issue({
          id: `template-missing-related-exercise-${template.id}-${exercise.id}-${relatedId}`,
          severity: 'warning',
          category: 'template',
          title: '模板替代动作不存在',
          message: `训练模板中有替代或进阶动作没有在动作库中找到。替代动作列表可能无法正确打开。`,
          affectedIds: [template.id, exercise.id, relatedId],
          canAutoFix: false,
          suggestedAction: '把替代动作改为真实动作库编号，或移除无效引用。',
        }));
      });
    });
  });

  (appData.programTemplate?.dayTemplates || []).forEach((dayTemplate) => {
    (dayTemplate.mainExerciseIds || []).forEach((exerciseId) => {
      if (isKnownExerciseId(exerciseId)) return;
      issues.push(issue({
        id: `program-template-missing-exercise-${dayTemplate.id}-${exerciseId}`,
        severity: 'error',
        category: 'template',
        title: '训练日引用了不存在的动作',
        message: `计划中的训练日引用了动作库中不存在的动作。该训练日生成训练时可能缺少动作。`,
        affectedIds: [dayTemplate.id, exerciseId],
        canAutoFix: false,
        suggestedAction: '在计划模板中替换为真实动作库动作。',
      }));
    });
  });

  return issues;
};

const scanHealthReadinessIssues = (appData: Partial<AppData>) => {
  const issues: DataHealthIssue[] = [];
  const healthIntegrationEnabled = appData.settings?.healthIntegrationSettings?.useHealthDataForReadiness !== false;
  if (!healthIntegrationEnabled) return issues;

  (appData.healthMetricSamples || []).forEach((sample) => {
    if (sample.dataFlag !== 'excluded') return;
    if (!hasOwnTruthyFlag(sample as unknown as Record<string, unknown>, READINESS_INCLUDED_FLAGS)) return;
    issues.push(issue({
      id: `excluded-health-readiness-${sample.id}`,
      severity: 'error',
      category: 'healthData',
      title: '排除的健康数据仍影响准备度',
      message: `有一条已排除的健康数据仍带有准备度参与标记。排除数据只能用于回看，不应影响今天是否保守训练。`,
      affectedIds: [sample.id],
      canAutoFix: false,
      suggestedAction: '重新生成健康摘要，确认排除数据不再参与准备度。',
    }));
  });

  (appData.importedWorkoutSamples || []).forEach((workout) => {
    if (workout.dataFlag !== 'excluded') return;
    if (!hasOwnTruthyFlag(workout as unknown as Record<string, unknown>, READINESS_INCLUDED_FLAGS)) return;
    issues.push(issue({
      id: `excluded-workout-readiness-${workout.id}`,
      severity: 'error',
      category: 'healthData',
      title: '排除的外部活动仍影响准备度',
      message: `有一条已排除的外部活动仍带有准备度参与标记。排除活动不应影响今天是否保守训练。`,
      affectedIds: [workout.id],
      canAutoFix: false,
      suggestedAction: '重新生成健康摘要，确认排除活动不再参与准备度。',
    }));
  });

  return issues;
};

const dedupeIssues = (issues: DataHealthIssue[]) => {
  const seen = new Set<string>();
  return issues.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const statusFromIssues = (issues: DataHealthIssue[]): DataHealthReport['status'] => {
  if (issues.some((item) => item.severity === 'error')) return 'has_errors';
  if (issues.length) return 'has_warnings';
  return 'healthy';
};

const summaryFromIssues = (issues: DataHealthIssue[], status: DataHealthReport['status']) => {
  if (status === 'healthy') return '数据健康检查未发现明显异常。';
  const errors = issues.filter((item) => item.severity === 'error').length;
  const warnings = issues.filter((item) => item.severity === 'warning').length;
  const infos = issues.filter((item) => item.severity === 'info').length;
  const parts = [
    errors ? `${errors} 个需要处理的问题` : '',
    warnings ? `${warnings} 个建议复查的问题` : '',
    infos ? `${infos} 个提示` : '',
  ].filter(Boolean);
  return `数据健康检查发现${parts.join('、')}。所有项目只提示，不会自动修改训练或健康数据。`;
};

export const buildDataHealthReport = (appData: Partial<AppData>): DataHealthReport => {
  const issues = dedupeIssues([
    ...scanReplacementIssues(appData),
    ...scanUnitIssues(appData),
    ...scanSummaryIssues(appData),
    ...scanWarmupIssues(appData),
    ...scanAnalyticsFlagIssues(appData),
    ...scanImportedWorkoutIssues(appData),
    ...scanTemplateIssues(appData),
    ...scanHealthReadinessIssues(appData),
  ]);
  const status = statusFromIssues(issues);

  return {
    status,
    issues,
    summary: summaryFromIssues(issues, status),
  };
};
