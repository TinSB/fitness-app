import React from 'react';
import { classNames } from '../../engines/engineUtils';
import { WorkoutActionBar } from '../../ui/WorkoutActionBar';
import { GlassCard } from '../primitives/GlassCard';
import { TrainingFocusHero } from './TrainingFocusHero';

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export const trainingOsGlassSurface =
  'border shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl';

export const trainingOsInsetSurface = 'border backdrop-blur-xl';

export function TodayHeroCard({ children, className = '' }: SurfaceProps) {
  return (
    <GlassCard as="section" padding="none" className={classNames('overflow-hidden rounded-[28px]', className)} ariaLabel="今日训练总览" highlight>
      {children}
    </GlassCard>
  );
}

export function TodayFocusOverrideCard({ children, className = '' }: SurfaceProps) {
  return (
    <GlassCard as="section" padding="md" className={classNames('rounded-3xl', className)} ariaLabel="今天想练">
      {children}
    </GlassCard>
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
    <TrainingFocusHero className={className}>
      {children}
    </TrainingFocusHero>
  );
}

export function SetPrescriptionCard({ children, className = '' }: SurfaceProps) {
  return (
    <GlassCard as="section" padding="md" surface="training_hero" className={classNames('rounded-3xl', className)} ariaLabel="本组建议" highlight>
      {children}
    </GlassCard>
  );
}

export function ActualSetInputCard({ children, className = '' }: SurfaceProps) {
  return (
    <GlassCard as="section" padding="md" className={classNames('rounded-3xl', className)} ariaLabel="实际记录">
      {children}
    </GlassCard>
  );
}

export function TrainingActionBar({ children, className = '' }: SurfaceProps) {
  return (
    <WorkoutActionBar className={classNames('backdrop-blur-xl md:static', className)}>
      {children}
    </WorkoutActionBar>
  );
}
