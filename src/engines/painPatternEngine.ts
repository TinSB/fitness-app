import type { PainPattern, TrainingSession } from '../models/training-model';
import { number } from './engineUtils';

type PainAccumulator = {
  area: string;
  exerciseId?: string;
  frequency: number;
  totalSeverity: number;
  lastOccurredAt: string;
};

const painSeverityFromSet = (set: { painSeverity?: number; note?: string }) => {
  if (number(set.painSeverity) > 0) return number(set.painSeverity);
  if (/sharp|刺痛|剧烈/i.test(String(set.note || ''))) return 4;
  if (/ache|酸|不适/i.test(String(set.note || ''))) return 2;
  return 2;
};

export const buildPainPatterns = (history: TrainingSession[] = []): PainPattern[] => {
  const byArea = new Map<string, PainAccumulator>();
  const byExercise = new Map<string, PainAccumulator>();

  history.slice(0, 24).forEach((session) => {
    session.exercises.forEach((exercise) => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      sets.filter((set) => set.painFlag).forEach((set) => {
        const area = set.painArea || exercise.muscle || '未知部位';
        const severity = painSeverityFromSet(set);
        const exerciseKey = `${area}:${exercise.baseId || exercise.id}`;

        const nextArea = byArea.get(area) || { area, frequency: 0, totalSeverity: 0, lastOccurredAt: session.date };
        nextArea.frequency += 1;
        nextArea.totalSeverity += severity;
        nextArea.lastOccurredAt = nextArea.lastOccurredAt > session.date ? nextArea.lastOccurredAt : session.date;
        byArea.set(area, nextArea);

        const nextExercise = byExercise.get(exerciseKey) || {
          area,
          exerciseId: exercise.baseId || exercise.id,
          frequency: 0,
          totalSeverity: 0,
          lastOccurredAt: session.date,
        };
        nextExercise.frequency += 1;
        nextExercise.totalSeverity += severity;
        nextExercise.lastOccurredAt = nextExercise.lastOccurredAt > session.date ? nextExercise.lastOccurredAt : session.date;
        byExercise.set(exerciseKey, nextExercise);
      });
    });
  });

  const exercisePatterns: PainPattern[] = [...byExercise.values()].map((item) => {
    const severityAvg = item.totalSeverity / Math.max(1, item.frequency);
    let suggestedAction: PainPattern['suggestedAction'] = 'watch';
    if (severityAvg >= 4 || item.frequency >= 4) suggestedAction = 'substitute';
    if (severityAvg >= 4.5 && item.frequency >= 4) suggestedAction = 'deload';
    return {
      area: item.area,
      exerciseId: item.exerciseId,
      frequency: item.frequency,
      severityAvg: Math.round(severityAvg * 10) / 10,
      lastOccurredAt: item.lastOccurredAt,
      suggestedAction,
    };
  });

  const areaPatterns: PainPattern[] = [...byArea.values()]
    .filter((item) => item.frequency >= 2)
    .map((item) => {
      const severityAvg = item.totalSeverity / Math.max(1, item.frequency);
      let suggestedAction: PainPattern['suggestedAction'] = 'watch';
      if (severityAvg >= 3.5 || item.frequency >= 4) suggestedAction = 'deload';
      if (severityAvg >= 4.5 || item.frequency >= 6) suggestedAction = 'seek_professional';
      return {
        area: item.area,
        frequency: item.frequency,
        severityAvg: Math.round(severityAvg * 10) / 10,
        lastOccurredAt: item.lastOccurredAt,
        suggestedAction,
      };
    });

  const distinctAreas = [...byArea.keys()];
  if (distinctAreas.length >= 2) {
    const totalFrequency = [...byArea.values()].reduce((sum, item) => sum + item.frequency, 0);
    const totalSeverity = [...byArea.values()].reduce((sum, item) => sum + item.totalSeverity, 0);
    const severityAvg = totalSeverity / Math.max(1, totalFrequency);
    areaPatterns.push({
      area: distinctAreas.join(' / '),
      frequency: totalFrequency,
      severityAvg: Math.round(severityAvg * 10) / 10,
      lastOccurredAt: [...byArea.values()].map((item) => item.lastOccurredAt).sort().slice(-1)[0] || '',
      suggestedAction: severityAvg >= 4 ? 'deload' : 'watch',
    });
  }

  return [...exercisePatterns, ...areaPatterns].sort((left, right) => {
    if (right.severityAvg !== left.severityAvg) return right.severityAvg - left.severityAvg;
    return right.frequency - left.frequency;
  });
};

export const getExercisePainPattern = (patterns: PainPattern[] = [], exerciseId: string) =>
  patterns.find((pattern) => pattern.exerciseId === exerciseId);
