import type { ExerciseTemplate, ProgramTemplate, TrainingSession, TrainingTemplate } from '../models/training-model';
import { getLatestCompletedSession, getNextTemplateAfterLastCompletedSession } from './sessionBuilder';
import { findTemplate, number } from './engineUtils';

export interface NextSessionPreviewExercise {
  exerciseId: string;
  exerciseName: string;
  muscle: string;
  kind: string;
  sets: number;
  repRange: [number, number];
  startWeight: number;
}

export interface NextSessionPreview {
  available: boolean;
  templateId?: string;
  templateName?: string;
  estimatedDurationMin?: number;
  daysSinceLastSession?: number;
  exercises: NextSessionPreviewExercise[];
  headline: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const safeDate = (value?: string) => {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  const iso = direct ? `${direct[0]}T12:00:00.000Z` : value;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const previewExercise = (exercise: ExerciseTemplate): NextSessionPreviewExercise => ({
  exerciseId: exercise.id,
  exerciseName: exercise.name || exercise.id,
  muscle: exercise.muscle,
  kind: String(exercise.kind || 'compound'),
  sets: number(exercise.sets) || 3,
  repRange: [number(exercise.repMin) || 6, number(exercise.repMax) || 10],
  startWeight: number(exercise.startWeight) || 0,
});

export interface NextSessionPreviewOptions {
  limit?: number;
  nowIso?: string;
}

export const buildNextSessionPreview = (
  history: TrainingSession[] = [],
  templates: TrainingTemplate[] = [],
  programTemplate?: ProgramTemplate,
  options: NextSessionPreviewOptions = {},
): NextSessionPreview => {
  const limit = options.limit ?? 3;
  const nowIso = options.nowIso || new Date().toISOString();
  const nowMs = safeDate(nowIso) ?? Date.now();
  const latest = getLatestCompletedSession(history);
  let templateId = getNextTemplateAfterLastCompletedSession(history, templates, programTemplate);

  if (!templateId) {
    const fallback = templates.find((template) => template.id === 'push-a')?.id || templates[0]?.id;
    if (!fallback) {
      return {
        available: false,
        exercises: [],
        headline: '尚无可用模板，去计划页配置一个吧。',
      };
    }
    templateId = fallback;
  }

  const template = findTemplate(templates, templateId);
  if (!template) {
    return {
      available: false,
      exercises: [],
      headline: '找不到下次推荐模板，去计划页确认模板顺序。',
    };
  }

  const exercises = (template.exercises || []).slice(0, limit).map((exercise) => previewExercise(exercise as ExerciseTemplate));
  const days = latest
    ? (() => {
        const ts = safeDate(latest.finishedAt) ?? safeDate(latest.startedAt) ?? safeDate(latest.date);
        if (ts === null) return undefined;
        return Math.max(0, Math.round((nowMs - ts) / MS_PER_DAY));
      })()
    : undefined;

  const headline = latest
    ? `下次训练：${template.name || template.id}${days !== undefined ? `（距离上次 ${days} 天）` : ''}。`
    : `下次训练：${template.name || template.id}（首次训练）。`;

  return {
    available: true,
    templateId,
    templateName: template.name,
    estimatedDurationMin: number(template.duration) || undefined,
    daysSinceLastSession: days,
    exercises,
    headline,
  };
};
