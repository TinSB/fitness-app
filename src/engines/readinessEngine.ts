import type { AppData, ReadinessInput, ReadinessResult, TodayStatus, TrainingSession, TrainingTemplate } from '../models/training-model';
import { buildHealthSummary, type HealthSummary } from './healthSummaryEngine';

const sleepMap: Record<TodayStatus['sleep'], ReadinessInput['sleep']> = {
  差: 'poor',
  一般: 'ok',
  好: 'good',
};

const energyMap: Record<TodayStatus['energy'], ReadinessInput['energy']> = {
  低: 'low',
  中: 'medium',
  高: 'high',
};

export const mapTodayStatusToReadinessInput = (
  status: TodayStatus,
  template?: Pick<TrainingTemplate, 'duration'>,
  painAreas: string[] = []
): ReadinessInput => ({
  sleep: sleepMap[status.sleep],
  energy: energyMap[status.energy],
  sorenessAreas: (status.soreness || []).filter((item) => item !== '无') as string[],
  painAreas,
  availableTimeMin: Number(status.time),
  plannedTimeMin: template?.duration,
});

export const buildReadinessResult = (
  input: ReadinessInput,
  context: { adherenceHigh?: boolean; healthSummary?: HealthSummary } = {}
): ReadinessResult => {
  let score = 82;
  const reasons: string[] = [];

  if (input.sleep === 'poor') {
    score -= 20;
    reasons.push('睡眠偏差');
  } else if (input.sleep === 'ok') {
    score -= 8;
  } else {
    score += 4;
  }

  if (input.energy === 'low') {
    score -= 18;
    reasons.push('精力偏低');
  } else if (input.energy === 'medium') {
    score -= 6;
  } else {
    score += 4;
  }

  if ((input.sorenessAreas || []).length >= 2) {
    score -= 15;
    reasons.push('多肌群酸痛');
  } else if ((input.sorenessAreas || []).length === 1) {
    score -= 8;
    reasons.push('局部酸痛');
  }

  if ((input.painAreas || []).length > 0) {
    score -= 20;
    reasons.push('存在疼痛区域');
  }

  if (input.plannedTimeMin && input.availableTimeMin < input.plannedTimeMin) {
    const gap = input.plannedTimeMin - input.availableTimeMin;
    score -= gap >= 30 ? 15 : gap >= 15 ? 8 : 4;
    reasons.push('可用时间低于计划时长');
  }

  if (context.healthSummary && context.healthSummary.confidence !== 'low') {
    const healthNotes = context.healthSummary.notes.join(' ');
    if (context.healthSummary.latestSleepHours !== undefined && context.healthSummary.latestSleepHours < 6) {
      score -= 4;
      reasons.push('导入健康数据提示睡眠偏少，建议略保守');
    }
    if (healthNotes.includes('静息心率高于') || healthNotes.includes('HRV 低于')) {
      score -= 3;
      reasons.push('导入健康数据提示恢复可能偏低');
    }
    if (context.healthSummary.recentHighActivityDays > 0 || context.healthSummary.recentWorkoutMinutes >= 120) {
      score -= 3;
      reasons.push('导入健康数据提示近期活动负荷偏高');
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let level: ReadinessResult['level'] = 'medium';
  let trainingAdjustment: ReadinessResult['trainingAdjustment'] = 'normal';

  if (score < 50) {
    level = 'low';
    trainingAdjustment = (input.painAreas || []).length ? 'recovery' : 'conservative';
  } else if (score < 75) {
    level = 'medium';
    trainingAdjustment = 'normal';
  } else {
    level = 'high';
    trainingAdjustment = context.adherenceHigh && score >= 85 ? 'push' : 'normal';
  }

  if (score < 65 && trainingAdjustment === 'normal') trainingAdjustment = 'conservative';

  return { score, level, trainingAdjustment, reasons };
};

export const buildTodayReadiness = (
  data: Pick<Partial<AppData>, 'todayStatus' | 'activeSession' | 'history' | 'healthMetricSamples' | 'importedWorkoutSamples'>,
  template?: Pick<TrainingTemplate, 'duration'>,
  context: { adherenceHigh?: boolean; painAreas?: string[]; healthSummary?: HealthSummary } = {}
) =>
  buildReadinessResult(mapTodayStatusToReadinessInput((data.todayStatus || ({} as TodayStatus)) as TodayStatus, template, context.painAreas), {
    adherenceHigh: context.adherenceHigh,
    healthSummary:
      context.healthSummary ||
      buildHealthSummary(data.healthMetricSamples || [], data.importedWorkoutSamples || []),
  });

export const collectPainAreasFromHistory = (history: TrainingSession[] = []) =>
  history
    .slice(0, 6)
    .flatMap((session) =>
      session.exercises.flatMap((exercise) =>
        (Array.isArray(exercise.sets) ? exercise.sets : [])
          .filter((set) => set.painFlag)
          .map((set) => set.painArea || exercise.muscle)
      )
    )
    .filter(Boolean);
