import React from 'react';
import { classNames, number } from '../../engines/engineUtils';
import { formatWeight } from '../../engines/unitConversionEngine';
import type {
  PostWorkoutExerciseRecommendation,
  PostWorkoutNextTimeRecommendation,
} from '../../engines/postWorkoutNextTimeRecommendationEngine';
import type { TrainingSession, UnitSettings } from '../../models/training-model';
import { GlassCard } from '../primitives/GlassCard';
import { useUiTheme } from '../theme/UiThemeProvider';

export const shouldShowPostWorkoutNextTimeRecommendation = (
  session: Pick<TrainingSession, 'id'> | null | undefined,
  recommendation: PostWorkoutNextTimeRecommendation | null | undefined,
  isEditing: boolean,
): recommendation is PostWorkoutNextTimeRecommendation =>
  Boolean(
    session &&
      recommendation &&
      !isEditing &&
      recommendation.sourceSessionId === session.id &&
      recommendation.recommendations.length > 0,
  );

export const formatPostWorkoutNextTimePrescription = (
  recommendation: Pick<PostWorkoutExerciseRecommendation, 'actionableLoadKg' | 'plannedReps'>,
  unitSettings: UnitSettings,
): string => {
  const loadText = number(recommendation.actionableLoadKg) > 0
    ? formatWeight(recommendation.actionableLoadKg, unitSettings).replace(/(kg|lb)$/u, ' $1')
    : '';
  const repsText = number(recommendation.plannedReps) > 0 ? `${Math.round(number(recommendation.plannedReps))}` : '';
  if (loadText && repsText) return `${loadText} × ${repsText}`;
  if (loadText) return loadText;
  if (repsText) return `× ${repsText}`;
  return '';
};

export function PostWorkoutNextTimeRecommendationCard({
  recommendation,
  unitSettings,
}: {
  recommendation: PostWorkoutNextTimeRecommendation;
  unitSettings: UnitSettings;
}) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <GlassCard
      as="section"
      surface="record_detail_surface"
      padding="md"
      ariaLabel="下次建议"
      data-post-workout-next-time-recommendation="display"
      className="space-y-3"
    >
      <div>
        <div className={classNames('text-sm font-semibold', isDark ? 'text-emerald-200' : 'text-emerald-700')}>下次建议</div>
        <p className={classNames('mt-1 text-sm leading-6', isDark ? 'text-white/60' : 'text-slate-600')}>{recommendation.summary}</p>
      </div>
      <div className="space-y-2">
        {recommendation.recommendations.map((item) => {
          const prescription = formatPostWorkoutNextTimePrescription(item, unitSettings);
          return (
            <div
              key={item.id}
              className={classNames(
                'rounded-xl border px-3 py-2 text-sm leading-6',
                isDark ? 'border-white/10 bg-white/[0.05] text-white/70' : 'border-slate-200 bg-white text-slate-700',
              )}
              data-post-workout-next-time-recommendation-row="exercise"
            >
              <div className={classNames('font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{item.exerciseName}</div>
              <div>
                {item.userMessage}
                {prescription ? <span className={classNames('ml-2 font-semibold', isDark ? 'text-white' : 'text-slate-950')}>{prescription}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
