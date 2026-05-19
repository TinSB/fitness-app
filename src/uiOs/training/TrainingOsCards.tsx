import React from 'react';
import { classNames } from '../../engines/engineUtils';
import { WorkoutActionBar } from '../../ui/WorkoutActionBar';

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export const trainingOsGlassSurface =
  'border border-white/10 bg-white/[0.07] text-white shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl';

export const trainingOsInsetSurface = 'border border-white/10 bg-white/[0.09] text-white backdrop-blur-xl';

export function TodayHeroCard({ children, className = '' }: SurfaceProps) {
  return (
    <section
      className={classNames('overflow-hidden rounded-[28px]', trainingOsGlassSurface, className)}
      aria-label="今日训练总览"
    >
      {children}
    </section>
  );
}

export function TodayFocusOverrideCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl p-4', trainingOsInsetSurface, className)} aria-label="今天想练">
      {children}
    </section>
  );
}

export function UnfinishedSessionNotice({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-50', className)}>
      {children}
    </section>
  );
}

export function TrainingFocusHeroCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-[30px] p-5', trainingOsGlassSurface, className)} aria-label="当前训练动作">
      {children}
    </section>
  );
}

export function SetPrescriptionCard({ children, className = '' }: SurfaceProps) {
  return (
    <section
      className={classNames('rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-white backdrop-blur-xl', className)}
      aria-label="推荐处方"
    >
      {children}
    </section>
  );
}

export function ActualSetInputCard({ children, className = '' }: SurfaceProps) {
  return (
    <section className={classNames('rounded-3xl p-4', trainingOsInsetSurface, className)} aria-label="实际记录">
      {children}
    </section>
  );
}

export function TrainingActionBar({ children, className = '' }: SurfaceProps) {
  return (
    <WorkoutActionBar className={classNames('border-white/10 bg-[#101012]/95 text-white shadow-[0_-18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl md:static', className)}>
      {children}
    </WorkoutActionBar>
  );
}
