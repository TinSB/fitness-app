import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
} from '../data/exerciseLibrary';
import { formatExerciseName } from '../i18n/formatters';
import type {
  ExerciseFatigueCost,
  ExerciseMetadata,
  ExercisePrescription,
  ExerciseTemplate,
  LoadFeedback,
  LoadFeedbackValue,
  PainPattern,
  ReadinessResult,
  TrainingLevel,
  TrainingSession,
} from '../models/training-model';
import { isSyntheticReplacementExerciseId, validateReplacementExerciseId } from './replacementEngine';

export type SmartReplacementPriority = 'primary' | 'secondary' | 'angle_variation' | 'avoid';

export type SmartReplacementRecommendation = {
  exerciseId: string;
  exerciseName: string;
  priority: SmartReplacementPriority;
  fatigueCost: 'low' | 'medium' | 'high';
  reason: string;
  warnings: string[];
};

type SmartReplacementExercise = Partial<Omit<ExerciseTemplate, 'sets'>> &
  Partial<Omit<ExercisePrescription, 'sets'>> &
  Partial<ExerciseMetadata> & {
  id?: string;
  sets?: ExerciseTemplate['sets'] | ExercisePrescription['sets'];
};

type SmartReplacementParams = {
  currentExercise?: SmartReplacementExercise | string | null;
  exerciseLibrary?: Array<SmartReplacementExercise | string> | Record<string, SmartReplacementExercise | string> | null;
  painPatterns?: PainPattern[] | null;
  readinessResult?: ReadinessResult | null;
  loadFeedback?: LoadFeedback[] | LoadFeedbackValue | { dominantFeedback?: LoadFeedbackValue; feedback?: LoadFeedbackValue; adjustment?: { dominantFeedback?: LoadFeedbackValue } } | null;
  trainingHistory?: TrainingSession[] | null;
  equipmentPreferences?: string[] | null;
  trainingLevel?: TrainingLevel | 'unknown' | string | null;
};

type Candidate = {
  id: string;
  metadata: SmartReplacementExercise;
  explicitPriority?: string;
  source: 'explicit' | 'chain' | 'similar' | 'avoid';
  score: number;
  warnings: string[];
  reasons: string[];
};

const fatigueRank: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const priorityOrder: Record<SmartReplacementPriority, number> = {
  primary: 0,
  secondary: 1,
  angle_variation: 2,
  avoid: 3,
};

const normalizeKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const normalizeText = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[\s_\-·,，。/|]+/g, '');

const isChinese = (value: unknown) => /[\u3400-\u9fff]/.test(String(value || ''));

const getExerciseId = (exercise: SmartReplacementExercise | string | null | undefined) => {
  if (!exercise) return '';
  if (typeof exercise === 'string') return exercise;
  return String(
    exercise.actualExerciseId ||
      exercise.replacementExerciseId ||
      exercise.canonicalExerciseId ||
      exercise.baseId ||
      exercise.id ||
      ''
  );
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value.filter(Boolean) as T[]) : []);

const getOverride = (id: string): SmartReplacementExercise => (EXERCISE_KNOWLEDGE_OVERRIDES[id] || {}) as SmartReplacementExercise;

const mergeExercise = (id: string, exercise?: SmartReplacementExercise | string): SmartReplacementExercise => {
  const source = typeof exercise === 'object' && exercise ? exercise : {};
  return {
    id,
    name: EXERCISE_DISPLAY_NAMES[id] || source.name,
    ...getOverride(id),
    ...source,
  };
};

const buildLibraryMap = (exerciseLibrary: SmartReplacementParams['exerciseLibrary']) => {
  const map = new Map<string, SmartReplacementExercise>();

  Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES).forEach((id) => {
    if (validateReplacementExerciseId(id)) map.set(id, mergeExercise(id));
  });

  if (Array.isArray(exerciseLibrary)) {
    exerciseLibrary.forEach((item) => {
      const id = getExerciseId(item);
      if (id && validateReplacementExerciseId(id)) map.set(id, mergeExercise(id, item));
    });
  } else if (exerciseLibrary && typeof exerciseLibrary === 'object') {
    Object.entries(exerciseLibrary).forEach(([key, item]) => {
      const id = getExerciseId(item) || key;
      if (id && validateReplacementExerciseId(id)) map.set(id, mergeExercise(id, item));
    });
  }

  return map;
};

const getFatigueCost = (value: unknown): 'low' | 'medium' | 'high' => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
};

const getSkillDemand = (value: unknown): 'low' | 'medium' | 'high' => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
};

const getPrimaryMuscles = (exercise: SmartReplacementExercise): string[] => {
  const primary = asArray<string>(exercise.primaryMuscles);
  if (primary.length) return primary;
  return exercise.muscle ? [String(exercise.muscle)] : [];
};

const hasSharedMuscle = (left: SmartReplacementExercise, right: SmartReplacementExercise) => {
  const leftMuscles = getPrimaryMuscles(left).map(normalizeText);
  const rightMuscles = getPrimaryMuscles(right).map(normalizeText);
  return leftMuscles.some((item) => rightMuscles.includes(item));
};

const samePattern = (left: SmartReplacementExercise, right: SmartReplacementExercise) =>
  normalizeText(left.movementPattern) && normalizeText(left.movementPattern) === normalizeText(right.movementPattern);

const chainForExercise = (id: string, exercise: SmartReplacementExercise) =>
  Object.values(EXERCISE_EQUIVALENCE_CHAINS).find(
    (chain) => chain.id === exercise.equivalenceChainId || chain.members.includes(id)
  );

const mapExplicitPriority = (value: unknown): SmartReplacementPriority | undefined => {
  if (value === 'priority' || value === 'primary') return 'primary';
  if (value === 'optional' || value === 'secondary') return 'secondary';
  if (value === 'angle' || value === 'angle_variation') return 'angle_variation';
  if (value === 'not_recommended' || value === 'avoid') return 'avoid';
  return undefined;
};

const addCandidate = (map: Map<string, Candidate>, candidate: Candidate) => {
  const previous = map.get(candidate.id);
  if (!previous || candidate.score > previous.score || previous.source === 'similar') {
    map.set(candidate.id, candidate);
  }
};

const getEquipmentType = (id: string, exercise: SmartReplacementExercise) => {
  const text = normalizeKey(`${id} ${exercise.kind || ''} ${exercise.name || ''}`);
  if (text.includes('machine')) return 'machine';
  if (text.includes('cable')) return 'cables';
  if (text.includes('db') || text.includes('dumbbell')) return 'dumbbell';
  if (text.includes('barbell') || id === 'bench-press' || id === 'squat' || id === 'deadlift') return 'barbell';
  if (text.includes('pushup') || text.includes('pullup') || text.includes('bodyweight')) return 'bodyweight';
  return '';
};

const hasHighFatigueSignal = (readinessResult?: ReadinessResult | null) =>
  Boolean(readinessResult && (readinessResult.level === 'low' || readinessResult.trainingAdjustment === 'conservative' || readinessResult.trainingAdjustment === 'recovery' || readinessResult.score < 65));

const feedbackValuesFromInput = (loadFeedback: SmartReplacementParams['loadFeedback']) => {
  if (!loadFeedback) return [] as LoadFeedbackValue[];
  if (loadFeedback === 'too_light' || loadFeedback === 'good' || loadFeedback === 'too_heavy') return [loadFeedback];
  if (Array.isArray(loadFeedback)) return loadFeedback.map((item) => item.feedback).filter(Boolean);
  return [loadFeedback.dominantFeedback, loadFeedback.feedback, loadFeedback.adjustment?.dominantFeedback].filter(Boolean) as LoadFeedbackValue[];
};

const collectRecentExerciseFeedback = (trainingHistory: TrainingSession[] | null | undefined, exerciseId: string) =>
  (trainingHistory || [])
    .filter((session) => session.dataFlag !== 'test' && session.dataFlag !== 'excluded')
    .flatMap((session) => session.loadFeedback || [])
    .filter((item) => item.exerciseId === exerciseId)
    .slice(-5);

const collectHistoryPainPatterns = (trainingHistory: TrainingSession[] | null | undefined): PainPattern[] => {
  const patterns = new Map<string, PainPattern>();
  (trainingHistory || [])
    .filter((session) => session.dataFlag !== 'test' && session.dataFlag !== 'excluded')
    .slice(0, 12)
    .forEach((session) => {
      session.exercises.forEach((exercise) => {
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        sets
          .filter((set) => set.painFlag)
          .forEach((set) => {
            const exerciseId = exercise.actualExerciseId || exercise.replacementExerciseId || exercise.canonicalExerciseId || exercise.id;
            const area = String(set.painArea || exercise.muscle || '相关部位');
            const key = `${exerciseId}:${area}`;
            const previous = patterns.get(key);
            patterns.set(key, {
              area,
              exerciseId,
              frequency: (previous?.frequency || 0) + 1,
              severityAvg: Math.max(previous?.severityAvg || 0, Number(set.painSeverity || 2)),
              lastOccurredAt: session.date,
              suggestedAction: 'substitute',
            });
          });
      });
    });
  return [...patterns.values()];
};

const painMatchesExercise = (pattern: PainPattern, id: string, exercise: SmartReplacementExercise) => {
  if (pattern.exerciseId && pattern.exerciseId === id) return true;
  const area = normalizeText(pattern.area);
  if (!area) return false;
  const muscles = getPrimaryMuscles(exercise).map(normalizeText);
  if (muscles.some((muscle) => muscle && (area.includes(muscle) || muscle.includes(area)))) return true;
  return asArray<string>(exercise.contraindications).some((item) => normalizeText(item).includes(area));
};

const buildBaseCandidates = (currentId: string, currentMetadata: SmartReplacementExercise, library: Map<string, SmartReplacementExercise>) => {
  const candidates = new Map<string, Candidate>();
  const priorityMap = (currentMetadata.alternativePriorities || {}) as Record<string, string>;
  const explicitAlternativeIds = asArray<string>(currentMetadata.alternativeIds);

  explicitAlternativeIds.forEach((id, index) => {
    if (id === currentId || isSyntheticReplacementExerciseId(id) || !validateReplacementExerciseId(id)) return;
    const explicitPriority = priorityMap[id];
    const mappedPriority = mapExplicitPriority(explicitPriority);
    addCandidate(candidates, {
      id,
      metadata: library.get(id) || mergeExercise(id),
      explicitPriority,
      source: mappedPriority === 'avoid' ? 'avoid' : 'explicit',
      score: mappedPriority === 'primary' ? 120 - index : mappedPriority === 'angle_variation' ? 72 - index : mappedPriority === 'avoid' ? -100 : 90 - index,
      warnings: mappedPriority === 'avoid' ? ['这个动作与当前目标差异较大，本次不建议作为主要替代。'] : [],
      reasons: [],
    });
  });

  Object.entries(priorityMap).forEach(([id, priority]) => {
    const mappedPriority = mapExplicitPriority(priority);
    if (mappedPriority !== 'avoid' || id === currentId || isSyntheticReplacementExerciseId(id) || !validateReplacementExerciseId(id)) return;
    addCandidate(candidates, {
      id,
      metadata: library.get(id) || mergeExercise(id),
      explicitPriority: priority,
      source: 'avoid',
      score: -120,
      warnings: ['动作模式或主肌群差异较大，本次不建议作为主要替代。'],
      reasons: [],
    });
  });

  const chain = chainForExercise(currentId, currentMetadata);
  (chain?.members || []).forEach((id) => {
    if (id === currentId || candidates.has(id) || isSyntheticReplacementExerciseId(id) || !validateReplacementExerciseId(id)) return;
    addCandidate(candidates, {
      id,
      metadata: library.get(id) || mergeExercise(id),
      source: 'chain',
      score: 82,
      warnings: [],
      reasons: [],
    });
  });

  library.forEach((exercise, id) => {
    if (id === currentId || candidates.has(id) || isSyntheticReplacementExerciseId(id) || !validateReplacementExerciseId(id)) return;
    if (!samePattern(currentMetadata, exercise) && !hasSharedMuscle(currentMetadata, exercise)) return;
    addCandidate(candidates, {
      id,
      metadata: exercise,
      source: 'similar',
      score: samePattern(currentMetadata, exercise) ? 64 : 42,
      warnings: [],
      reasons: [],
    });
  });

  return [...candidates.values()];
};

const applyContextScoring = (
  candidate: Candidate,
  currentMetadata: SmartReplacementExercise,
  context: {
    readinessResult?: ReadinessResult | null;
    loadFeedbackValues: LoadFeedbackValue[];
    trainingHistory?: TrainingSession[] | null;
    painPatterns: PainPattern[];
    equipmentPreferences: string[];
    trainingLevel?: string | null;
  }
) => {
  const fatigueCost = getFatigueCost(candidate.metadata.fatigueCost);
  const skillDemand = getSkillDemand(candidate.metadata.skillDemand);
  const explicitPriority = mapExplicitPriority(candidate.explicitPriority);

  if (explicitPriority === 'avoid') {
    candidate.score -= 80;
  }

  if (samePattern(currentMetadata, candidate.metadata)) {
    candidate.score += 18;
    candidate.reasons.push('动作模式接近');
  }

  if (hasSharedMuscle(currentMetadata, candidate.metadata)) {
    candidate.score += 16;
    candidate.reasons.push('主要训练肌群一致');
  }

  if (hasHighFatigueSignal(context.readinessResult)) {
    if (fatigueCost === 'low') {
      candidate.score += 18;
      candidate.reasons.push('今天更适合低疲劳替代');
    } else if (fatigueCost === 'medium') {
      candidate.score += 6;
    } else {
      candidate.score -= 24;
      candidate.warnings.push('当前准备度偏低，高疲劳动作建议谨慎。');
    }
  }

  if (context.loadFeedbackValues.includes('too_heavy')) {
    if (fatigueCost === 'low' || candidate.metadata.kind === 'machine') {
      candidate.score += 10;
      candidate.reasons.push('近期反馈偏重，优先选择更可控的替代');
    } else if (fatigueCost === 'high') {
      candidate.score -= 14;
      candidate.warnings.push('近期反馈偏重，这个动作仍可能偏吃力。');
    }
  }

  const recentCandidateFeedback = collectRecentExerciseFeedback(context.trainingHistory, candidate.id);
  if (recentCandidateFeedback.some((item) => item.feedback === 'too_heavy')) {
    candidate.score -= 12;
    candidate.warnings.push('该动作近期也反馈偏重，建议降低负荷或谨慎选择。');
  }

  const matchedPain = context.painPatterns.filter((pattern) => painMatchesExercise(pattern, candidate.id, candidate.metadata));
  if (matchedPain.length) {
    const severe = matchedPain.some((pattern) => pattern.suggestedAction === 'substitute' || pattern.suggestedAction === 'deload' || pattern.severityAvg >= 3.5);
    candidate.score -= severe ? 42 : 18;
    candidate.warnings.push('近期不适信号命中相关动作，建议降低优先级。');
  }

  if ((context.trainingLevel === 'unknown' || context.trainingLevel === 'beginner') && skillDemand === 'high') {
    candidate.score -= 22;
    candidate.warnings.push('动作技术要求较高，训练基线未稳定前建议降低优先级。');
  }

  if (context.equipmentPreferences.length) {
    const equipment = getEquipmentType(candidate.id, candidate.metadata);
    if (equipment && context.equipmentPreferences.map(normalizeKey).includes(normalizeKey(equipment))) {
      candidate.score += 8;
      candidate.reasons.push('符合当前器械偏好');
    } else if (equipment) {
      candidate.score -= 8;
      candidate.warnings.push('可能不符合当前器械偏好。');
    }
  }
};

const priorityFromCandidate = (candidate: Candidate): SmartReplacementPriority => {
  const explicit = mapExplicitPriority(candidate.explicitPriority);
  if (explicit === 'avoid' || explicit === 'angle_variation') return explicit;
  if (explicit === 'primary' && candidate.score >= 115 && !candidate.warnings.some((warning) => warning.includes('不适'))) return 'primary';
  if (explicit === 'secondary' && candidate.score >= 60) return 'secondary';
  if (candidate.source === 'avoid' || candidate.score < 25) return 'avoid';
  if (candidate.score >= 115) return 'primary';
  if (candidate.score >= 72) return 'secondary';
  return 'angle_variation';
};

const reasonFromCandidate = (candidate: Candidate, priority: SmartReplacementPriority) => {
  if (priority === 'avoid') {
    return '不建议作为本次主要替代：动作模式或训练重点差异较大，可能偏离原计划刺激。';
  }
  const parts = Array.from(new Set(candidate.reasons)).slice(0, 3);
  if (priority === 'primary') {
    return parts.length
      ? `${parts.join('，')}，适合优先替代。`
      : '动作模式和训练肌群接近，适合优先替代。';
  }
  if (priority === 'secondary') {
    return parts.length
      ? `${parts.join('，')}，可作为本次可选替代。`
      : '与原动作训练目标接近，可作为本次可选替代。';
  }
  return '训练角度或刺激重点略有变化，适合作为角度变化而不是首选替代。';
};

export const buildSmartReplacementRecommendations = ({
  currentExercise,
  exerciseLibrary,
  painPatterns,
  readinessResult,
  loadFeedback,
  trainingHistory,
  equipmentPreferences,
  trainingLevel,
}: SmartReplacementParams): SmartReplacementRecommendation[] => {
  const currentId = getExerciseId(currentExercise);
  if (!currentId || isSyntheticReplacementExerciseId(currentId) || !validateReplacementExerciseId(currentId)) return [];

  const library = buildLibraryMap(exerciseLibrary);
  const currentMetadata = mergeExercise(currentId, typeof currentExercise === 'object' && currentExercise ? currentExercise : undefined);
  const historyPainPatterns = collectHistoryPainPatterns(trainingHistory);
  const allPainPatterns = [...(painPatterns || []), ...historyPainPatterns];
  const loadFeedbackValues = feedbackValuesFromInput(loadFeedback);
  const currentHistoryFeedback = collectRecentExerciseFeedback(trainingHistory, currentId).map((item) => item.feedback);

  const candidates = buildBaseCandidates(currentId, currentMetadata, library);
  candidates.forEach((candidate) =>
    applyContextScoring(candidate, currentMetadata, {
      readinessResult,
      loadFeedbackValues: [...loadFeedbackValues, ...currentHistoryFeedback],
      trainingHistory,
      painPatterns: allPainPatterns,
      equipmentPreferences: equipmentPreferences || [],
      trainingLevel,
    })
  );

  return candidates
    .map((candidate): SmartReplacementRecommendation => {
      const priority = priorityFromCandidate(candidate);
      return {
        exerciseId: candidate.id,
        exerciseName: formatExerciseName({ id: candidate.id, name: EXERCISE_DISPLAY_NAMES[candidate.id] || candidate.metadata.name }),
        priority,
        fatigueCost: getFatigueCost(candidate.metadata.fatigueCost as ExerciseFatigueCost),
        reason: reasonFromCandidate(candidate, priority),
        warnings: Array.from(new Set(candidate.warnings)).filter((warning) => isChinese(warning)),
      };
    })
    .filter((item) => item.exerciseId !== currentId && validateReplacementExerciseId(item.exerciseId) && !isSyntheticReplacementExerciseId(item.exerciseId))
    .sort((left, right) => {
      const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const fatigueDiff = fatigueRank[left.fatigueCost] - fatigueRank[right.fatigueCost];
      if (fatigueDiff !== 0 && hasHighFatigueSignal(readinessResult)) return fatigueDiff;
      return left.exerciseName.localeCompare(right.exerciseName, 'zh-Hans-CN');
    });
};
