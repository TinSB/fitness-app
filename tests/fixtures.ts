import {
  DEFAULT_PROGRAM_TEMPLATE,
  DEFAULT_SCREENING_PROFILE,
  DEFAULT_STATUS,
  DEFAULT_USER_PROFILE,
  DEFAULT_MESOCYCLE_PLAN,
  INITIAL_TEMPLATES,
  STORAGE_VERSION,
} from '../src/data/trainingData';
import { hydrateTemplates } from '../src/engines/engineUtils';
import type { AppData, TodayStatus, TrainingSession, TrainingTemplate } from '../src/models/training-model';

export const templates = hydrateTemplates(INITIAL_TEMPLATES);

export const getTemplate = (id: string) => {
  const template = templates.find((item) => item.id === id);
  if (!template) throw new Error(`Missing template ${id}`);
  return template;
};

export const makeStatus = (overrides: Partial<TodayStatus> = {}): TodayStatus => ({
  ...DEFAULT_STATUS,
  ...overrides,
});

export const makeExerciseLog = (
  template: TrainingTemplate,
  exerciseId: string,
  setSpecs: Array<{
    weight: number;
    reps: number;
    rir?: number;
    note?: string;
    painFlag?: boolean;
    painArea?: string;
    painSeverity?: number;
    techniqueQuality?: 'good' | 'acceptable' | 'poor';
  }>
) => {
  const templateExercise = template.exercises.find((exercise) => exercise.id === exerciseId);
  if (!templateExercise) throw new Error(`Missing exercise ${exerciseId} in ${template.id}`);

  return {
    ...templateExercise,
    baseId: templateExercise.id,
    sets: setSpecs.map((set, index) => ({
      id: `${exerciseId}-${index + 1}`,
      type: index === 0 ? 'top' : 'backoff',
      weight: set.weight,
      reps: set.reps,
      rir: set.rir ?? 2,
      rpe: '',
      note: set.note || '',
      painFlag: Boolean(set.painFlag),
      painArea: set.painArea || '',
      painSeverity: set.painSeverity || 0,
      techniqueQuality: set.techniqueQuality || 'acceptable',
      done: true,
    })),
  };
};

export const makeSession = ({
  id,
  date,
  templateId,
  programTemplateId,
  programTemplateName,
  isExperimentalTemplate,
  exerciseId,
  setSpecs,
  status,
}: {
  id: string;
  date: string;
  templateId: string;
  programTemplateId?: string;
  programTemplateName?: string;
  isExperimentalTemplate?: boolean;
  exerciseId: string;
  setSpecs: Array<{
    weight: number;
    reps: number;
    rir?: number;
    note?: string;
    painFlag?: boolean;
    painArea?: string;
    painSeverity?: number;
    techniqueQuality?: 'good' | 'acceptable' | 'poor';
  }>;
  status?: TodayStatus;
}): TrainingSession => {
  const template = getTemplate(templateId);
  return {
    id,
    date,
    templateId,
    templateName: template.name,
    programTemplateId: programTemplateId || templateId,
    programTemplateName: programTemplateName || template.name,
    isExperimentalTemplate: Boolean(isExperimentalTemplate),
    trainingMode: 'hybrid',
    focus: template.focus,
    exercises: [makeExerciseLog(template, exerciseId, setSpecs)],
    status: status || DEFAULT_STATUS,
    completed: true,
  };
};

export const makeAppData = (overrides: Partial<AppData> = {}): AppData => ({
  schemaVersion: STORAGE_VERSION,
  templates,
  history: [],
  bodyWeights: [],
  activeSession: null,
  selectedTemplateId: 'push-a',
  trainingMode: 'hybrid',
  todayStatus: DEFAULT_STATUS,
  userProfile: DEFAULT_USER_PROFILE,
  screeningProfile: DEFAULT_SCREENING_PROFILE,
  programTemplate: DEFAULT_PROGRAM_TEMPLATE,
  mesocyclePlan: DEFAULT_MESOCYCLE_PLAN,
  settings: {},
  ...overrides,
});
