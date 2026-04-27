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
  context: { adherenceHigh?: boolean; healthSummary?: HealthSummary; useHealthDataForReadiness?: boolean } = {}
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

  const healthSummary = context.useHealthDataForReadiness === false ? undefined : context.healthSummary;
  if (healthSummary) {
    if (healthSummary.confidence === 'low') {
      reasons.push('健康数据不足，本次准备度主要依据主观状态。');
    }
    const healthNotes = healthSummary.notes.join(' ');
    if (healthSummary.latestSleepHours !== undefined && healthSummary.latestSleepHours < 6) {
      score -= healthSummary.confidence === 'low' ? 2 : 4;
      reasons.push('导入健康数据提示睡眠偏少，因此今天建议略保守。');
    }
    if (healthNotes.includes('静息心率高于') || healthNotes.includes('HRV 低于')) {
      if (healthSummary.confidence !== 'low') score -= 3;
      reasons.push('导入健康数据提示恢复可能偏低，系统仅作轻度训练提醒，不作为医疗判断。');
    }
    if (healthSummary.activityLoad?.previous24hHighActivity) {
      score -= 4;
      reasons.push('过去 24 小时外部活动量较高，今天训练建议略保守。');
    } else if (healthSummary.activityLoad?.previous48hHighActivity) {
      score -= 2;
      reasons.push('过去 48 小时外部活动量偏高，今天作为轻度恢复提醒。');
    } else if (healthSummary.activityLoad && healthSummary.activityLoad.recent7dWorkoutMinutes >= 240) {
      reasons.push('最近 7 天外部活动量较高，但 24/48 小时负荷正常，因此只作为趋势参考。');
    } else if (healthSummary.confidence !== 'low' && (healthSummary.recentHighActivityDays > 0 || healthSummary.recentWorkoutMinutes >= 120)) {
      score -= 2;
      reasons.push('导入健康数据提示近期活动负荷偏高。');
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
  context: { adherenceHigh?: boolean; painAreas?: string[]; healthSummary?: HealthSummary; useHealthDataForReadiness?: boolean } = {}
) => {
  const hasImportedHealthData = Boolean((data.healthMetricSamples || []).length || (data.importedWorkoutSamples || []).length);
  return buildReadinessResult(mapTodayStatusToReadinessInput((data.todayStatus || ({} as TodayStatus)) as TodayStatus, template, context.painAreas), {
    adherenceHigh: context.adherenceHigh,
    useHealthDataForReadiness: context.useHealthDataForReadiness,
    healthSummary:
      context.useHealthDataForReadiness === false
        ? undefined
        :
      context.healthSummary ||
      (hasImportedHealthData ? buildHealthSummary(data.healthMetricSamples || [], data.importedWorkoutSamples || []) : undefined),
  });
};

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
