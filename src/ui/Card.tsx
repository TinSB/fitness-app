import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';
import { uiTokens } from './designTokens';

export type UiTone = 'slate' | 'emerald' | 'amber' | 'rose' | 'sky';

interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: UiTone;
  padded?: boolean;
  children: ReactNode;
}

const cardTones: Record<UiTone, string> = {
  slate: 'border-slate-200 bg-white text-slate-950',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  rose: 'border-rose-200 bg-rose-50 text-rose-950',
  sky: 'border-sky-200 bg-sky-50 text-sky-950',
};

export const Card = ({ tone = 'slate', padded = true, className, children, ...props }: CardProps) => (
  <section
    className={classNames(
      uiTokens.radius.md,
      uiTokens.shadow.card,
      'border',
      padded && 'p-4 md:p-5',
      cardTones[tone],
      className,
    )}
    {...props}
  >
    {children}
  </section>
);
