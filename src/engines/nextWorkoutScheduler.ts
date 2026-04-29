import { formatMuscleName, formatTemplateName, formatTrainingMode } from '../i18n/formatters';
import type {
  PainPattern,
  ProgramTemplate,
  ReadinessResult,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
} from '../models/training-model';
import type { TodayTrainingState } from './todayStateEngine';
import { number } from './engineUtils';
import {
  buildRecoveryAwareRecommendation,
  type DailyRecommendationKind,
  type RecoveryAwareRecommendation,
  type RecoveryConflictLevel,
} from './recoveryAwareScheduler';

export type NextWorkoutRecommendation = {
  kind?: DailyRecommendationKind;
  templateId?: string;
  templateName: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  warnings: string[];
  conflictLevel?: RecoveryConflictLevel;
  recovery?: RecoveryAwareRecommendation;
  alternatives: Array<{
    templateId: string;
    templateName: string;
    reason: string;
  }>;
};

export type WeeklyVolumeSummaryInput = {
  byMuscle?: Record<
    string,
    Partial<{
      target: number;
      targetSets: number;
      sets: number;
      completedSets: number;
      effectiveSets: number;
      weightedEffectiveSets: number;
      remaining: number;
      remainingSets: number;
    }>
  >;
  muscles?: Array<
    Partial<{
      muscle: string;
      muscleId: string;
      target: number;
      targetSets: number;
      sets: number;
      completedSets: number;
      effectiveSets: number;
      weightedEffectiveSets: number;
      remaining: number;
      remainingSets: number;
    }>
  >;
};

export type BuildNextWorkoutRecommendationInput = {
  history?: TrainingSession[];
  activeSession?: TrainingSession | null;
  programTemplate?: ProgramTemplate;
  templates?: TrainingTemplate[];
  todayState?: TodayTrainingState;
  weeklyVolumeSummary?: WeeklyVolumeSummaryInput | null;
  painPatterns?: PainPattern[];
  sorenessAreas?: string[];
  painAreas?: string[];
  readinessResult?: ReadinessResult | null;
  trainingMode?: TrainingMode | string;
};

type TemplateCandidate = {
  template: TrainingTemplate;
  muscles: Set<string>;
  riskScore: number;
  deficitScore: number;
  reasons: string[];
  warnings: string[];
};

const PPL_ORDER = ['push-a', 'pull-a', 'legs-a'];

const normalizeKey = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

const isAnalyticsSession = (session: TrainingSession) => {
  const flag = session.dataFlag || 'normal';
  return flag !== 'test' && flag !== 'excluded';
};

const completedHistory = (history: TrainingSession[] = []) =>
  history
    .filter((session) => isAnalyticsSession(session) && session.completed === true)
    .sort((left, right) => String(right.finishedAt || right.startedAt || right.date || '').localeCompare(String(left.finishedAt || left.startedAt || left.date || '')));

const localizedTemplateName = (template?: Pick<TrainingTemplate, 'id' | 'name'> | Pick<TrainingSession, 'templateId' | 'templateName'> | null) => {
  if (!template) return '暂无下次建议';
  if ('templateId' in template) return formatTemplateName(template.templateId || template.templateName, '未命名模板');
  return formatTemplateName(template.id || template.name, '未命名模板');
};

const templateAliases = (template: TrainingTemplate | undefined | null) =>
  new Set([template?.id, template?.sourceTemplateId, template?.name].filter(Boolean).map(normalizeKey));

const resolveProgramDayTemplate = (day: ProgramTemplate['dayTemplates'][number], templates: TrainingTemplate[]) => {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const exact = byId.get(day.id);
  if (exact) return exact;
  const dayKey = normalizeKey(day.id || day.name);
  const dayNameKey = normalizeKey(day.name);
  return templates.find((template) => template.sourceTemplateId === day.id) ||
    templates.find((template) => templateAliases(template).has(dayKey) || templateAliases(template).has(dayNameKey));
};

const orderedTemplates = (templates: TrainingTemplate[] = [], programTemplate?: ProgramTemplate) => {
  const dayTemplates = programTemplate?.dayTemplates || [];
  const ordered = dayTemplates.map((day) => resolveProgramDayTemplate(day, templates)).filter(Boolean) as TrainingTemplate[];
  const remaining = templates.filter((template) => !ordered.some((item) => item.id === template.id));
  return {
    templates: [...ordered, ...remaining],
    usedProgramOrder: dayTemplates.length > 0 && ordered.length > 0,
  };
};

const resolveSessionTemplateKey = (session: TrainingSession | undefined, templates: TrainingTemplate[], programTemplate?: ProgramTemplate) => {
  if (!session) return undefined;
  const programIds = new Set((programTemplate?.dayTemplates || []).map((day) => day.id));
  const candidates = [session.programTemplateId, session.templateId].filter(Boolean).map(String);
  const matchedTemplate = templates.find((template) => candidates.includes(template.id));
  if (matchedTemplate?.sourceTemplateId) return matchedTemplate.sourceTemplateId;
  const programMatch = candidates.find((id) => programIds.has(id));
  if (programMatch) return programMatch;
  return matchedTemplate?.id || session.templateId;
};

const templateMatchesKey = (template: TrainingTemplate, key: string | undefined) => {
  if (!key) return false;
  const normalizedKey = normalizeKey(key);
  return templateAliases(template).has(normalizedKey);
};

const rotationFamilyKey = (template: TrainingTemplate | undefined) => {
  const text = [...templateAliases(template)].join(' ');
  if (/\b(push|pull|legs?|leg)\b/.test(text)) return 'push-pull-legs';
  if (/\b(upper|lower)\b/.test(text)) return 'upper-lower';
  return '';
};

const contiguousFamilyGroup = (templates: TrainingTemplate[], index: number) => {
  const family = rotationFamilyKey(templates[index]);
  if (!family) return [];
  let start = index;
  let end = index;
  while (start > 0 && rotationFamilyKey(templates[start - 1]) === family) start -= 1;
  while (end < templates.length - 1 && rotationFamilyKey(templates[end + 1]) === family) end += 1;
  return templates.slice(start, end + 1);
};

const nextByDefaultRotation = (lastTemplateKey: string | undefined, templates: TrainingTemplate[], usePplFallback: boolean) => {
  if (!templates.length) return undefined;
  const ids = new Set(templates.map((template) => template.id));
  if (usePplFallback && lastTemplateKey && PPL_ORDER.every((id) => ids.has(id)) && PPL_ORDER.includes(lastTemplateKey)) {
    const nextId = PPL_ORDER[(PPL_ORDER.indexOf(lastTemplateKey) + 1) % PPL_ORDER.length];
    return templates.find((template) => template.id === nextId);
  }
  const index = templates.findIndex((template) => templateMatchesKey(template, lastTemplateKey));
  if (index < 0) return templates[0];
  const familyGroup = contiguousFamilyGroup(templates, index);
  if (familyGroup.length > 1) {
    const groupIndex = familyGroup.findIndex((template) => template.id === templates[index].id);
    return familyGroup[(groupIndex + 1) % familyGroup.length];
  }
  return templates[(index + 1) % templates.length];
};

const muscleAliases: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps', '胸', '肩', '手臂'],
  pull: ['back', 'lats', 'biceps', '背', '背阔肌', '手臂'],
  legs: ['legs', 'quads', 'hamstrings', 'glutes', 'calves', '腿', '股四头肌', '腘绳肌', '臀', '小腿'],
};

const templateMuscles = (template: TrainingTemplate) => {
  const muscles = new Set<string>();
  const id = normalizeKey(template.id);
  if (id.includes('push')) muscleAliases.push.forEach((item) => muscles.add(normalizeKey(item)));
  if (id.includes('pull')) muscleAliases.pull.forEach((item) => muscles.add(normalizeKey(item)));
  if (id.includes('leg') || id.includes('lower')) muscleAliases.legs.forEach((item) => muscles.add(normalizeKey(item)));
  (template.exercises || []).forEach((exercise) => {
    [
      exercise.muscle,
      ...(exercise.primaryMuscles || []),
      ...(exercise.secondaryMuscles || []),
      ...Object.keys(exercise.muscleContribution || {}),
      exercise.movementPattern,
    ].forEach((value) => {
      if (value) muscles.add(normalizeKey(value));
    });
  });
  return muscles;
};

const painAreaKeys = (pattern: PainPattern) => {
  const area = normalizeKey(pattern.area);
  const keys = new Set([area]);
  if (['chest', 'shoulder', 'shoulders', 'triceps', 'arm', 'arms', '胸', '肩', '手臂'].some((item) => area.includes(normalizeKey(item)))) {
    muscleAliases.push.forEach((item) => keys.add(normalizeKey(item)));
  }
  if (['back', 'lat', 'lats', 'biceps', '背', '背阔肌'].some((item) => area.includes(normalizeKey(item)))) {
    muscleAliases.pull.forEach((item) => keys.add(normalizeKey(item)));
  }
  if (['leg', 'legs', 'knee', 'quad', 'hamstring', 'glute', 'calf', '腿', '膝', '臀', '小腿'].some((item) => area.includes(normalizeKey(item)))) {
    muscleAliases.legs.forEach((item) => keys.add(normalizeKey(item)));
  }
  return keys;
};

const directPainRiskForTemplate = (template: TrainingTemplate, painPatterns: PainPattern[] = []) => {
  const templateId = normalizeKey(template.id);
  const painText = painPatterns.map((pattern) => `${pattern.area} ${pattern.exerciseId || ''}`).join(' ').toLowerCase();
  if (!painText) return false;
  if (templateId.includes('push') && /(chest|shoulder|triceps|arm|胸|肩|手臂)/i.test(painText)) return true;
  if (templateId.includes('pull') && /(back|lat|biceps|背|背阔肌)/i.test(painText)) return true;
  if ((templateId.includes('leg') || templateId.includes('lower')) && /(leg|knee|quad|hamstring|glute|calf|腿|膝|臀|小腿)/i.test(painText)) return true;
  return false;
};

const hasPainRisk = (template: TrainingTemplate, painPatterns: PainPattern[] = []) => {
  const muscles = templateMuscles(template);
  const templateId = normalizeKey(template.id);
  const relevant = painPatterns.filter((pattern) => {
    if (pattern.suggestedAction === 'watch' && number(pattern.severityAvg) < 2) return false;
    const area = normalizeKey(pattern.area);
    const directFamilyRisk =
      (templateId.includes('push') && ['chest', 'shoulder', 'triceps', 'arm', '胸', '肩', '手臂'].some((item) => area.includes(normalizeKey(item)))) ||
      (templateId.includes('pull') && ['back', 'lat', 'biceps', '背', '背阔肌'].some((item) => area.includes(normalizeKey(item)))) ||
      ((templateId.includes('leg') || templateId.includes('lower')) && ['leg', 'knee', 'quad', 'hamstring', 'glute', 'calf', '腿', '膝', '臀', '小腿'].some((item) => area.includes(normalizeKey(item))));
    if (directFamilyRisk) return true;
    const keys = painAreaKeys(pattern);
    return [...keys].some((key) => muscles.has(key)) || (pattern.exerciseId ? template.exercises.some((exercise) => exercise.id === pattern.exerciseId || exercise.baseId === pattern.exerciseId) : false);
  });
  const directRisk = directPainRiskForTemplate(template, painPatterns);
  return {
    riskScore: relevant.reduce((sum, item) => sum + Math.max(1, number(item.frequency)) * Math.max(1, number(item.severityAvg)), 0) || (directRisk ? 1 : 0),
    patterns: relevant,
  };
};

const weeklyDeficitEntries = (summary?: WeeklyVolumeSummaryInput | null) => {
  if (!summary) return [];
  const fromRows = (summary.muscles || []).map((row) => ({
    muscle: String(row.muscle || row.muscleId || ''),
    remaining: number(row.remainingSets ?? row.remaining),
    target: number(row.targetSets ?? row.target),
    done: number(row.weightedEffectiveSets ?? row.effectiveSets ?? row.completedSets ?? row.sets),
  }));
  const fromMap = Object.entries(summary.byMuscle || {}).map(([muscle, row]) => ({
    muscle,
    remaining: number(row.remainingSets ?? row.remaining),
    target: number(row.targetSets ?? row.target),
    done: number(row.weightedEffectiveSets ?? row.effectiveSets ?? row.completedSets ?? row.sets),
  }));
  return [...fromRows, ...fromMap]
    .map((row) => ({
      ...row,
      key: normalizeKey(row.muscle),
      label: formatMuscleName(row.muscle),
      deficit: row.remaining || Math.max(0, row.target - row.done),
    }))
    .filter((row) => row.muscle && row.deficit >= 2)
    .sort((left, right) => right.deficit - left.deficit);
};

const candidateFor = (template: TrainingTemplate, painPatterns: PainPattern[], deficits: ReturnType<typeof weeklyDeficitEntries>): TemplateCandidate => {
  const muscles = templateMuscles(template);
  const pain = hasPainRisk(template, painPatterns);
  const matchingDeficits = deficits.filter((row) => muscles.has(row.key));
  const deficitScore = matchingDeficits.reduce((sum, row) => sum + row.deficit, 0);
  const reasons = matchingDeficits.slice(0, 2).map((row) => `${row.label}本周训练量还差约 ${Math.round(row.deficit * 10) / 10} 组。`);
  const warnings = pain.patterns.slice(0, 2).map((pattern) => `${formatMuscleName(pattern.area)}近期有不适记录，建议避免直接安排高风险训练日。`);
  return { template, muscles, riskScore: pain.riskScore, deficitScore, reasons, warnings };
};

const choosePainSafeAlternative = (base: TrainingTemplate, candidates: TemplateCandidate[]) => {
  const baseCandidate = candidates.find((candidate) => candidate.template.id === base.id);
  if (!baseCandidate || baseCandidate.riskScore <= 0) return base;
  const baseIndex = candidates.findIndex((candidate) => candidate.template.id === base.id);
  const rotated = [...candidates.slice(baseIndex + 1), ...candidates.slice(0, baseIndex)];
  const nextSafe = rotated.find((candidate) => candidate.riskScore === 0);
  if (nextSafe) return nextSafe.template;
  return [...candidates]
    .filter((candidate) => candidate.riskScore === 0)
    .sort((left, right) => right.deficitScore - left.deficitScore)[0]?.template || base;
};

const chooseWeeklyVolumeAlternative = (base: TrainingTemplate, candidates: TemplateCandidate[], readinessLow: boolean) => {
  if (readinessLow) return base;
  const baseCandidate = candidates.find((candidate) => candidate.template.id === base.id);
  const best = [...candidates].filter((candidate) => candidate.riskScore === 0).sort((left, right) => right.deficitScore - left.deficitScore)[0];
  if (!best || !baseCandidate) return base;
  return best.deficitScore >= baseCandidate.deficitScore + 3 ? best.template : base;
};

const lowLoadTemplate = (templates: TrainingTemplate[]) =>
  templates.find((template) => template.id === 'quick-30') ||
  [...templates].sort((left, right) => left.duration - right.duration)[0];

const alternativesFor = (templates: TrainingTemplate[], selected: TrainingTemplate, candidates: TemplateCandidate[]) =>
  templates
    .filter((template) => template.id !== selected.id)
    .slice(0, 3)
    .map((template) => {
      const candidate = candidates.find((item) => item.template.id === template.id);
      const reason = candidate?.warnings[0] || candidate?.reasons[0] || '作为备选训练日，可在时间、器械或恢复状态变化时手动选择。';
      return {
        templateId: template.id,
        templateName: localizedTemplateName(template),
        reason,
      };
    });

const appendWarning = (warnings: string[], value?: string) => {
  if (value && !warnings.includes(value)) warnings.push(value);
};

export const buildNextWorkoutRecommendation = ({
  history = [],
  activeSession = null,
  programTemplate,
  templates = [],
  todayState,
  weeklyVolumeSummary,
  painPatterns = [],
  sorenessAreas = [],
  painAreas = [],
  readinessResult,
  trainingMode,
}: BuildNextWorkoutRecommendationInput): NextWorkoutRecommendation => {
  if (activeSession && activeSession.completed !== true) {
    return {
      kind: 'train',
      templateId: activeSession.templateId,
      templateName: localizedTemplateName(activeSession),
      confidence: 'high',
      reason: `今天已有进行中的训练，优先继续${localizedTemplateName(activeSession)}。系统不会生成覆盖当前训练的下次建议。`,
      warnings: [],
      alternatives: [],
    };
  }

  const orderedResult = orderedTemplates(templates, programTemplate);
  const ordered = orderedResult.templates;
  if (!ordered.length) {
    return {
      kind: 'active_recovery',
      templateName: '暂无下次建议',
      confidence: 'low',
      reason: '当前没有可用训练模板，因此暂时无法判断下次练什么。',
      warnings: ['请先确认训练计划中至少有一个可用模板。'],
      alternatives: [],
    };
  }

  const normalCompleted = completedHistory(history);
  const todayCompletedId = todayState?.status === 'completed' ? todayState.lastCompletedSessionId : undefined;
  const anchorSession = (todayCompletedId ? normalCompleted.find((session) => session.id === todayCompletedId) : undefined) || normalCompleted[0];
  const anchorTemplateKey = resolveSessionTemplateKey(anchorSession, ordered, programTemplate);
  const baseTemplate = nextByDefaultRotation(anchorTemplateKey, ordered, !orderedResult.usedProgramOrder) || ordered[0];
  const deficits = weeklyDeficitEntries(weeklyVolumeSummary);
  const candidates = ordered.map((template) => candidateFor(template, painPatterns, deficits));
  const readinessScore = readinessResult?.score;
  const readinessLow = typeof readinessScore === 'number' && readinessScore < 50;

  let selected = baseTemplate;
  const warnings: string[] = [];
  const reasonParts: string[] = [];
  const modeLabel = trainingMode ? formatTrainingMode(trainingMode) : '';

  if (anchorSession) {
    reasonParts.push(`最近一次正式完成的是${localizedTemplateName(anchorSession)}，下次默认按计划轮转到${localizedTemplateName(baseTemplate)}。`);
  } else {
    reasonParts.push(`还没有可用于轮转的正式训练记录，先从${localizedTemplateName(baseTemplate)}开始。`);
  }

  if (todayState?.status === 'completed') {
    reasonParts.push('这是下次建议，不会覆盖今天已经完成的训练状态。');
  }

  if (modeLabel) reasonParts.push(`当前训练侧重为${modeLabel}，仅用于解释本次建议，不会改变计划顺序。`);

  const painSafe = choosePainSafeAlternative(selected, candidates);
  if (painSafe.id !== selected.id) {
    const baseCandidate = candidates.find((candidate) => candidate.template.id === selected.id);
    selected = painSafe;
    appendWarning(warnings, baseCandidate?.warnings[0] || '近期不适记录与默认训练日相关，已优先选择风险更低的训练日。');
    reasonParts.push(`考虑近期不适记录，建议先改为${localizedTemplateName(selected)}。`);
  }
  if (directPainRiskForTemplate(selected, painPatterns)) {
    const selectedIndex = ordered.findIndex((template) => template.id === selected.id);
    const safeByFamily = [...ordered.slice(selectedIndex + 1), ...ordered.slice(0, selectedIndex)].find((template) => !directPainRiskForTemplate(template, painPatterns));
    if (safeByFamily) {
      selected = safeByFamily;
      appendWarning(warnings, '近期不适记录与默认训练日相关，已优先选择风险更低的训练日。');
      reasonParts.push(`考虑近期不适记录，建议先改为${localizedTemplateName(selected)}。`);
    }
  }

  const volumeAdjusted = chooseWeeklyVolumeAlternative(selected, candidates, readinessLow);
  if (volumeAdjusted.id !== selected.id) {
    const selectedCandidate = candidates.find((candidate) => candidate.template.id === volumeAdjusted.id);
    selected = volumeAdjusted;
    reasonParts.push(selectedCandidate?.reasons[0] || `本周训练量分布提示${localizedTemplateName(selected)}更值得优先安排。`);
  }

  if (readinessLow) {
    const lowLoad = lowLoadTemplate(ordered);
    if (lowLoad && lowLoad.id !== selected.id) {
      appendWarning(warnings, '准备度较低，建议把下次训练作为恢复或低负荷日执行。');
      selected = lowLoad;
      reasonParts.push(`准备度较低，本次更适合安排${localizedTemplateName(selected)}作为低负荷日，或降低训练负荷。`);
    } else {
      appendWarning(warnings, '准备度较低，建议降低负荷、减少组数或缩短训练。');
      reasonParts.push('准备度较低，建议保守执行下次训练。');
    }
  } else if (readinessResult?.trainingAdjustment === 'conservative' || readinessResult?.trainingAdjustment === 'recovery') {
    appendWarning(warnings, '当前恢复状态提示需要保守执行。');
  }

  if (anchorSession && selected.id === anchorSession.templateId) {
    appendWarning(warnings, `下次建议仍是${localizedTemplateName(selected)}，请确认这是因为计划里没有更合适的备选，或近期不适、训练量不足导致需要重复。`);
    reasonParts.push(`本次出现重复模板，是因为其他模板存在更高风险或计划中缺少可用备选。`);
  }

  const selectedCandidate = candidates.find((candidate) => candidate.template.id === selected.id);
  selectedCandidate?.warnings.forEach((warning) => appendWarning(warnings, warning));

  const recovery = buildRecoveryAwareRecommendation({
    preferredTemplate: selected,
    templates: ordered,
    sorenessAreas,
    painAreas,
    readinessResult,
    availableTimeMin: number(todayState && 'availableTimeMin' in todayState ? todayState.availableTimeMin : undefined),
  });
  if (recovery.kind !== 'train' || recovery.templateId !== selected.id || recovery.conflictLevel !== 'none') {
    reasonParts.push(recovery.summary);
    recovery.reasons.slice(0, 2).forEach((reason) => appendWarning(warnings, reason));
  }
  if (recovery.kind === 'train' && recovery.templateId && recovery.templateId !== selected.id) {
    const recoveryTemplate = ordered.find((template) => template.id === recovery.templateId);
    if (recoveryTemplate) selected = recoveryTemplate;
  }

  const confidence: NextWorkoutRecommendation['confidence'] =
    !anchorSession || readinessLow || warnings.length >= 2 || recovery.kind !== 'train'
      ? 'low'
      : selected.id !== baseTemplate.id || warnings.length || recovery.conflictLevel !== 'none'
        ? 'medium'
        : 'high';

  if (recovery.kind === 'rest' || recovery.kind === 'active_recovery' || recovery.kind === 'mobility_only') {
    return {
      kind: recovery.kind,
      templateName: recovery.templateName || recovery.title.replace('今日建议：', ''),
      confidence,
      reason: reasonParts.join(' '),
      warnings,
      conflictLevel: recovery.conflictLevel,
      recovery,
      alternatives: alternativesFor(ordered, selected, candidates),
    };
  }

  return {
    kind: recovery.kind,
    templateId: selected.id,
    templateName: localizedTemplateName(selected),
    confidence,
    reason: reasonParts.join(' '),
    warnings,
    conflictLevel: recovery.conflictLevel,
    recovery,
    alternatives: alternativesFor(ordered, selected, candidates),
  };
};
