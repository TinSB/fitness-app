import type { ReactNode } from 'react';
import { GlassCard } from '../primitives/GlassCard';

export type TrainingFocusHeroProps = {
  children: ReactNode;
  className?: string;
};

export function TrainingFocusHero({ children, className = '' }: TrainingFocusHeroProps) {
  return (
    <GlassCard as="section" padding="lg" className={`rounded-[30px] ${className}`} ariaLabel="当前训练动作" highlight>
      {children}
    </GlassCard>
  );
}
