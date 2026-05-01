import { DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS, EXERCISE_DISPLAY_NAMES } from '../data/trainingData';
import type {
  AppData,
  DeloadDecision,
  ExercisePrescription,
  ExerciseTemplate,
  ExerciseWarningSignal,
  PerformanceSnapshot,
  ScreeningProfile,
  TrainingSession,
  TrainingSetLog,
} from '../models/training-model';
import { actionableSorenessAreas, completedSets, enrichExercise, number, setVolume } from './engineUtils';
import { inferCorrectionPriority, ISSUE_LABELS } from './screeningEngine';

type ExerciseLike = ExerciseTemplate | ExercisePrescription;
type AdaptiveStateSnapshot = NonNullable<ScreeningProfile['adaptiveState']>;
type AdaptiveExerciseResult = ExercisePrescription;

type AdaptiveExerciseProfile = {
  baseId: string;
  linkedIssues: string[];
  issueScore: number;
  painCount: number;
  performanceDrop: boolean;
  restricted: boolean;
  contraindicated: boolean;
  boost: boolean;
  taper: boolean;
};

type AdaptiveConservativeDecision = AdaptiveExerciseProfile & {
  conservativeLevel: number;
  lockProgress: boolean;
  conservativeTopSet: boolean;
  topSetFactor: number;
  backoffFactor: number;
  extraRestSec: number;
  preferStableAlternatives: boolean;
  preferRegression: boolean;
  reasons: string[];
  warningSignals: ExerciseWarningSignal[];
};

const ISSUE_FROM_PATTERN: Array<{ match: (exercise: ExerciseLike) => boolean; issues: string[] }> = [
  {
    match: (exercise) => /(bench|press|chest-press|fly|close-grip)/i.test(String(exercise.baseId || exercise.id || '')),
    issues: ['upper_crossed', 'scapular_control', 'breathing_ribcage'],
  },
  {
    match: (exercise) => /(shoulder-press|landmine|bottom-up|waiter)/i.test(String(exercise.baseId || exercise.id || '')),
    issues: ['overhead_press_restriction', 'scapular_control', 'breathing_ribcage'],
  },
  {
    match: (exercise) => /(squat|leg-press|hack-squat|goblet)/i.test(String(exercise.baseId || exercise.id || '')),
    issues: ['ankle_mobility', 'squat_lean_forward', 'hip_stability', 'core_control'],
  },
  {
    match: (exercise) => /(deadlift|rdl|hinge)/i.test(String(exercise.baseId || exercise.id || '')),
    issues: ['lumbar_compensation', 'core_control', 'hip_flexor_tightness'],
  },
  {
    match: (exercise) => /(row|pulldown|pull-up|face-pull)/i.test(String(exercise.baseId || exercise.id || '')),
    issues: ['thoracic_rotation', 'scapular_control'],
  },
];

const painRegex = /(pain|ache|pinch|sharp|不适|刺痛|拉伤)/i;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const performanceValue = (performance: PerformanceSnapshot | null) => {
  if (!performance) return 0;

  const topValue = performance.sets.reduce((best, set) => {
    const current = number(set.weight) * Math.max(1, number(set.reps));
    return Math.max(best, current);
  }, 0);

  const volume = performance.sets.reduce((sum, set) => sum + setVolume(set), 0);
  return Math.max(topValue, volume * 0.1);
};

const hasPainFlag = (exercise: { painFlag?: boolean; sets: ExercisePrescription['sets'] }) => {
  if (exercise.painFlag) return true;
  if (!Array.isArray(exercise.sets)) return false;
  return exercise.sets.some((set) => set.painFlag || painRegex.test(set.note || ''));
};

const issuesForExercise = (exercise: ExerciseLike) =>
  ISSUE_FROM_PATTERN.filter((rule) => rule.match(exercise)).flatMap((rule) => rule.issues);

const recentSessionsForMuscle = (history: TrainingSession[], muscle: string) =>
  history
    .slice(0, 6)
    .flatMap((session) =>
      session.exercises.filter((exercise) => {
        const muscles = new Set([exercise.muscle, ...(exercise.primaryMuscles || [])].filter(Boolean));
        return muscles.has(muscle);
      })
    );

const fallbackExercise = (exerciseId: string): ExerciseTemplate =>
  enrichExercise({
    id: exerciseId,
    name: EXERCISE_DISPLAY_NAMES[exerciseId] || exerciseId,
    alias: EXERCISE_DISPLAY_NAMES[exerciseId] || exerciseId,
    muscle: '胸',
    kind: 'compound',
    sets: 3,
    repMin: 6,
    repMax: 8,
    rest: 120,
    startWeight: 20,
    alternatives: [],
  });

export const findLastPerformance = (history: TrainingSession[], exerciseId: string): PerformanceSnapshot | null => {
  for (const session of history) {
    for (const exercise of session.exercises) {
      if (exercise.baseId !== exerciseId && exercise.id !== exerciseId) continue;
      const sets = completedSets(exercise);
      if (sets.length) return { session, exercise, sets };
    }
  }

  return null;
};

export const findPreviousPerformance = (
  history: TrainingSession[],
  exerciseId: string,
  skipSessionId?: string
): PerformanceSnapshot | null => {
  let skipped = !skipSessionId;

  for (const session of history) {
    if (!skipped && session.id === skipSessionId) {
      skipped = true;
      continue;
    }
    if (!skipped) continue;

    for (const exercise of session.exercises) {
      if (exercise.baseId !== exerciseId && exercise.id !== exerciseId) continue;
      const sets = completedSets(exercise);
      if (sets.length) return { session, exercise, sets };
    }
  }

  return null;
};

export const findRecentPerformances = (history: TrainingSession[], exerciseId: string, limit = 3): PerformanceSnapshot[] => {
  const results: PerformanceSnapshot[] = [];

  for (const session of history) {
    for (const exercise of session.exercises) {
      if (exercise.baseId !== exerciseId && exercise.id !== exerciseId) continue;
      const sets = completedSets(exercise);
      if (sets.length) results.push({ session, exercise, sets });
      if (results.length >= limit) return results;
    }
  }

  return results;
};

export const buildAdaptiveState = (history: TrainingSession[], screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE) => {
  const recentSessions = history.slice(0, 8);
  const painByExercise: Record<string, number> = {};
  const issueScores: Record<string, number> = { ...(screening.adaptiveState?.issueScores || {}) };
  const performanceDrops = new Set<string>();
  const improvingIssues = new Set<string>();

  recentSessions.forEach((session) => {
    session.exercises.forEach((exercise) => {
      const baseId = exercise.baseId || exercise.id;
      if (hasPainFlag(exercise)) painByExercise[baseId] = (painByExercise[baseId] || 0) + 1;
    });
  });

  const candidateIds = new Set(recentSessions.flatMap((session) => session.exercises.map((exercise) => exercise.baseId || exercise.id)));
  candidateIds.forEach((exerciseId) => {
    const recent = findRecentPerformances(history, exerciseId, 3);
    if (recent.length < 3) return;

    const latest = performanceValue(recent[0]);
    const baseline = (performanceValue(recent[1]) + performanceValue(recent[2])) / 2;
    if (baseline > 0 && latest < baseline * 0.9) {
      performanceDrops.add(exerciseId);
      issuesForExercise(enrichExercise(recent[0].exercise as ExerciseTemplate)).forEach((issue) => {
        issueScores[issue] = (issueScores[issue] || 0) + 2;
      });
    }

    if (baseline > 0 && latest > baseline * 1.05 && !painByExercise[exerciseId]) {
      issuesForExercise(enrichExercise(recent[0].exercise as ExerciseTemplate)).forEach((issue) => improvingIssues.add(issue));
    }
  });

  Object.entries(painByExercise).forEach(([exerciseId, count]) => {
    if (count < 2) return;
    const performance = findLastPerformance(history, exerciseId);
    issuesForExercise(performance?.exercise || fallbackExercise(exerciseId)).forEach((issue) => {
      issueScores[issue] = (issueScores[issue] || 0) + 3;
    });
  });

  const moduleDose: Record<string, 'taper' | 'baseline' | 'boost'> = {};
  const issueUniverse = new Set([...Object.keys(issueScores), ...Array.from(improvingIssues)]);
  issueUniverse.forEach((issue) => {
    if ((issueScores[issue] || 0) >= 4) moduleDose[issue] = 'boost';
    else if (improvingIssues.has(issue)) moduleDose[issue] = 'taper';
    else moduleDose[issue] = 'baseline';
  });

  return {
    issueScores,
    painByExercise,
    performanceDrops: [...performanceDrops],
    improvingIssues: [...improvingIssues],
    moduleDose,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
};

export const reconcileScreeningProfile = (screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE, history: TrainingSession[] = []) => {
  const adaptiveState = buildAdaptiveState(history, screening);
  const repeatedPainRestrictions = Object.entries(adaptiveState.painByExercise)
    .filter(([, count]) => count >= 2)
    .map(([exerciseId]) => exerciseId);

  const next: ScreeningProfile = {
    ...DEFAULT_SCREENING_PROFILE,
    ...screening,
    postureFlags: { ...DEFAULT_SCREENING_PROFILE.postureFlags, ...(screening.postureFlags || {}) },
    movementFlags: { ...DEFAULT_SCREENING_PROFILE.movementFlags, ...(screening.movementFlags || {}) },
    restrictedExercises: [...new Set([...(screening.restrictedExercises || []), ...repeatedPainRestrictions])],
    adaptiveState,
  };

  next.correctionPriority = inferCorrectionPriority(next);
  return next;
};

const screeningIssuesForExercise = (exercise: ExerciseLike, screening: ScreeningProfile) => {
  const issues = new Set(issuesForExercise(exercise));
  const directlyMatchedIssues = issuesForExercise(exercise);
  (screening.correctionPriority || []).forEach((issue) => {
    if (directlyMatchedIssues.includes(issue)) issues.add(issue);
  });
  return [...issues];
};

export const getExerciseAdaptiveProfile = (
  exercise: ExerciseLike,
  screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE
): AdaptiveExerciseProfile => {
  const baseId = exercise.baseId || exercise.id;
  const linkedIssues = screeningIssuesForExercise(exercise, screening);
  const issueScore = linkedIssues.reduce((sum, issue) => sum + number(screening.adaptiveState?.issueScores?.[issue] || 0), 0);
  const painCount = screening.adaptiveState?.painByExercise?.[baseId] || 0;
  const performanceDrop = (screening.adaptiveState?.performanceDrops || []).includes(baseId);
  const restricted = (screening.restrictedExercises || []).includes(baseId);
  const contraindicated = (exercise.contraindications || []).some(
    (issue) => linkedIssues.includes(issue) || (screening.correctionPriority || []).includes(issue)
  );

  return {
    baseId,
    linkedIssues,
    issueScore,
    painCount,
    performanceDrop,
    restricted,
    contraindicated,
    boost: linkedIssues.some((issue) => screening.adaptiveState?.moduleDose?.[issue] === 'boost'),
    taper: linkedIssues.length > 0 && linkedIssues.every((issue) => screening.adaptiveState?.moduleDose?.[issue] === 'taper'),
  };
};

export const buildAdaptiveConservativeDecision = (
  exercise: ExerciseLike,
  screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE,
  readinessLevel: 'green' | 'yellow' | 'red' = 'green',
  deloadLevel: DeloadDecision['level'] = 'none'
): AdaptiveConservativeDecision => {
  const profile = getExerciseAdaptiveProfile(exercise, screening);
  const reasons: string[] = [];
  const warningSignals: ExerciseWarningSignal[] = [];
  const addReason = (message: string, source: ExerciseWarningSignal['source'], type: ExerciseWarningSignal['type']) => {
    reasons.push(message);
    warningSignals.push({ message, source, type });
  };
  let conservativeLevel = 0;

  if (readinessLevel === 'yellow') {
    conservativeLevel += 1;
    addReason('今日恢复信号一般', 'recoveryConflict', 'recovery_conflict');
  }
  if (readinessLevel === 'red') {
    conservativeLevel += 2;
    addReason('今日恢复信号偏差', 'recoveryConflict', 'recovery_conflict');
  }
  if (profile.performanceDrop) {
    conservativeLevel += 2;
    addReason('最近表现连续回落', 'recoveryConflict', 'recovery_conflict');
  }
  if (profile.painCount >= 2) {
    conservativeLevel += 2;
    addReason('同动作不适记录累积偏多', 'painPattern', 'pain_history');
  }
  if (profile.restricted) {
    conservativeLevel += 1;
    addReason('动作已进入限制列表', 'screeningRestriction', 'screening_restriction');
  }
  if (profile.issueScore >= 4) {
    conservativeLevel += 1;
    addReason('当前筛查记录提示该动作模式需要保守处理', 'screeningRestriction', 'screening_restriction');
  }
  if (profile.contraindicated) {
    conservativeLevel += 2;
    addReason('当前筛查记录提示该动作模式需要保守处理或替代', 'screeningRestriction', 'screening_restriction');
  }
  if (deloadLevel === 'watch') {
    conservativeLevel += 1;
    addReason('疲劳闸门提示观察', 'recoveryConflict', 'recovery_conflict');
  }
  if (deloadLevel === 'yellow') {
    conservativeLevel += 2;
    addReason('疲劳闸门建议减量', 'recoveryConflict', 'recovery_conflict');
  }
  if (deloadLevel === 'red') {
    conservativeLevel += 3;
    addReason('疲劳闸门建议恢复优先', 'recoveryConflict', 'recovery_conflict');
  }

  const lockProgress = profile.painCount >= 2 || profile.performanceDrop || profile.contraindicated || deloadLevel === 'red';
  const conservativeTopSet = conservativeLevel >= 2 || lockProgress;
  const topSetFactor = conservativeLevel >= 5 ? 0.92 : conservativeLevel >= 3 ? 0.96 : conservativeLevel >= 1 ? 0.98 : 1;
  const backoffFactor = conservativeLevel >= 5 ? 0.84 : conservativeLevel >= 3 ? 0.88 : conservativeLevel >= 1 ? 0.9 : 0.92;
  const extraRestSec = conservativeLevel >= 4 ? 45 : conservativeLevel >= 2 ? 30 : 0;

  return {
    ...profile,
    conservativeLevel,
    lockProgress,
    conservativeTopSet,
    topSetFactor,
    backoffFactor,
    extraRestSec,
    preferStableAlternatives: conservativeLevel >= 2 || profile.boost,
    preferRegression: conservativeLevel >= 4 || profile.contraindicated,
    reasons,
    warningSignals,
  };
};

export const applyAdaptiveExerciseRules = (
  exercise: ExerciseLike,
  screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE,
  context: { readinessLevel?: 'green' | 'yellow' | 'red'; deloadLevel?: DeloadDecision['level'] } = {}
): AdaptiveExerciseResult => {
  const decision = buildAdaptiveConservativeDecision(
    exercise,
    screening,
    context.readinessLevel || 'green',
    context.deloadLevel || 'none'
  );

  const next: AdaptiveExerciseResult = {
    ...enrichExercise(exercise as ExerciseTemplate),
    ...exercise,
    rest: number(exercise.rest) + decision.extraRestSec,
    progressLocked: Boolean((exercise as ExercisePrescription).progressLocked || decision.lockProgress),
    conservativeTopSet: Boolean((exercise as ExercisePrescription).conservativeTopSet || decision.conservativeTopSet),
    adaptiveTopSetFactor: decision.topSetFactor,
    adaptiveBackoffFactor: decision.backoffFactor,
    adaptiveRestPenaltySec: decision.extraRestSec,
    adaptiveReasons: decision.reasons,
    warningSignals: [...((exercise as ExercisePrescription).warningSignals || []), ...decision.warningSignals],
  };

  if (decision.conservativeLevel >= 4) {
    next.sets = Math.max(1, number(next.sets) - (next.kind === 'isolation' ? 1 : 2));
  } else if (decision.conservativeLevel >= 2) {
    next.sets = Math.max(1, number(next.sets) - (next.kind === 'isolation' ? 0 : 1));
  }

  if (decision.restricted || decision.painCount >= 2 || decision.contraindicated) {
    const fallbackRegressionId = next.regressionIds?.[0];
    next.replacementSuggested =
      next.alternatives?.[0] || (fallbackRegressionId ? EXERCISE_DISPLAY_NAMES[fallbackRegressionId] || fallbackRegressionId : '');
  }

  if (decision.boost && next.kind !== 'isolation') {
    const message = `纠偏模块已上调：${decision.linkedIssues.map((issue) => ISSUE_LABELS[issue] || issue).join(' / ')}`;
    const signal: ExerciseWarningSignal = { message, source: 'screeningRestriction', type: 'screening_restriction' };
    next.warningSignals = [...(next.warningSignals || []), signal];
    next.warningSource = signal.source;
    next.warningType = signal.type;
    next.warning = [next.warning, message]
      .filter(Boolean)
      .join(' / ');
  }

  if (decision.reasons.length) {
    next.warning = [next.warning, ...decision.reasons].filter(Boolean).join(' / ');
    if (!next.warningSource && decision.warningSignals[0]) {
      next.warningSource = decision.warningSignals[0].source;
      next.warningType = decision.warningSignals[0].type;
    }
  }

  return next;
};

export const getAdaptiveBudgetAdjustment = (
  data: Pick<Partial<AppData>, 'history' | 'screeningProfile' | 'todayStatus' | 'templates'>,
  muscle: string,
  deloadDecision: DeloadDecision = buildAdaptiveDeloadDecision(data)
) => {
  const recentExercises = recentSessionsForMuscle(data.history || [], muscle);
  const relatedIds = new Set(recentExercises.map((exercise) => exercise.baseId || exercise.id));
  const painHits = [...relatedIds].filter((id) => (data.screeningProfile?.adaptiveState?.painByExercise?.[id] || 0) >= 2).length;
  const performanceHits = [...relatedIds].filter((id) => (data.screeningProfile?.adaptiveState?.performanceDrops || []).includes(id)).length;
  const reasons: string[] = [];
  let targetMultiplier = 1;

  if (actionableSorenessAreas(data.todayStatus?.soreness).includes(muscle)) {
    targetMultiplier -= 0.1;
    reasons.push(`${muscle} 今天有酸痛`);
  }
  if (painHits > 0) {
    targetMultiplier -= 0.15;
    reasons.push(`${muscle} 相关动作近期 pain flag 偏多`);
  }
  if (performanceHits > 0) {
    targetMultiplier -= 0.1;
    reasons.push(`${muscle} 相关动作近期表现回落`);
  }
  if (deloadDecision.level === 'watch') {
    targetMultiplier -= 0.05;
    reasons.push('疲劳闸门进入观察');
  }
  if (deloadDecision.level === 'yellow') {
    targetMultiplier -= 0.15;
    reasons.push('疲劳闸门建议下修周剂量');
  }
  if (deloadDecision.level === 'red') {
    targetMultiplier -= 0.3;
    reasons.push('疲劳闸门建议恢复优先');
  }

  return {
    targetMultiplier: clamp(targetMultiplier, 0.55, 1),
    reasons,
  };
};

export const buildAdaptiveDeloadDecision = (
  data: Pick<Partial<AppData>, 'history' | 'screeningProfile' | 'todayStatus' | 'templates'> & {
    selectedTemplateId?: string;
    trainingMode?: AppData['trainingMode'];
  }
): DeloadDecision => {
  const history = data.history || [];
  const recentSessions = history.slice(0, 4);
  const adaptive: AdaptiveStateSnapshot = data.screeningProfile?.adaptiveState || DEFAULT_SCREENING_PROFILE.adaptiveState!;
  const currentStatus = data.todayStatus || DEFAULT_STATUS;
  const reasons: string[] = [];
  let score = 0;

  const poorRecoveryCount = recentSessions.filter((session) => session.status?.sleep === '差' || session.status?.energy === '低').length;
  const repeatedPainCount = Object.values(adaptive.painByExercise || {}).filter((count) => number(count) >= 2).length;
  const performanceDropCount = (adaptive.performanceDrops || []).length;
  const highIssueCount = Object.values(adaptive.issueScores || {}).filter((count) => number(count) >= 4).length;
  const currentSorenessCount = actionableSorenessAreas(currentStatus.soreness).length;

  if (performanceDropCount >= 2) {
    score += 2;
    reasons.push('最近多个动作表现下滑');
  } else if (performanceDropCount === 1) {
    score += 1;
    reasons.push('最近有主动作表现回落');
  }

  if (repeatedPainCount >= 2) {
    score += 2;
    reasons.push('pain flag 累积偏多');
  } else if (repeatedPainCount === 1) {
    score += 1;
    reasons.push('已有动作进入疼痛观察');
  }

  if (poorRecoveryCount >= 2) {
    score += 1;
    reasons.push('最近恢复信号偏差');
  }

  if (currentStatus.sleep === '差' && currentStatus.energy === '低') {
    score += 2;
    reasons.push('今天睡眠和精力都偏差');
  } else if (currentStatus.sleep === '差' || currentStatus.energy === '低') {
    score += 1;
    reasons.push('今天恢复状态一般');
  }

  if (currentSorenessCount >= 2) {
    score += 1;
    reasons.push('今日多肌群酸痛');
  }

  if (highIssueCount >= 2) {
    score += 1;
    reasons.push('纠偏问题分值在上升');
  }

  const level: DeloadDecision['level'] = score >= 5 ? 'red' : score >= 3 ? 'yellow' : score >= 1 ? 'watch' : 'none';
  const strategy: DeloadDecision['strategy'] =
    level === 'red' ? 'recovery_template' : level === 'yellow' ? 'reduce_volume' : level === 'watch' ? 'reduce_accessories' : 'none';
  const volumeMultiplier = level === 'red' ? 0.6 : level === 'yellow' ? 0.75 : level === 'watch' ? 0.9 : 1;
  const templates = data.templates || [];
  const recoveryTemplate = templates.find((template) => template.id === 'quick-30') || templates.find((template) => template.id === 'crowded-gym');

  return {
    level,
    triggered: level !== 'none',
    reasons,
    title:
      level === 'red'
        ? '建议直接切到恢复模板'
        : level === 'yellow'
          ? '建议主动减量'
          : level === 'watch'
            ? '建议先保守推进'
            : '暂时不需要减量',
    strategy,
    volumeMultiplier,
    options:
      level === 'red'
        ? ['切到恢复模板', '主动作保留，辅动作明显减量', '本周总量下修 40%']
        : level === 'yellow'
          ? ['本周总量下修 25%', '顶组保守推进', '辅动作减少 1-2 组']
          : level === 'watch'
            ? ['暂停加重', '减少高疲劳辅动作', '保留纠偏和功能补丁']
            : ['维持原计划'],
    autoSwitchTemplateId: level === 'red' ? recoveryTemplate?.id : undefined,
  };
};
