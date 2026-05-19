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
  slate: '!border-white/10 !bg-[#1c1c1e]/86 text-white',
  emerald: '!border-emerald-400/25 !bg-emerald-400/10 text-emerald-50',
  amber: '!border-amber-400/25 !bg-amber-400/10 text-amber-50',
  rose: '!border-rose-400/25 !bg-rose-400/10 text-rose-50',
  sky: '!border-sky-400/25 !bg-sky-400/10 text-sky-50',
};

const legacyChildOverrides =
  '[&_.border-slate-200]:border-white/10 [&_.bg-stone-50]:bg-white/[0.05] [&_.bg-white]:bg-white/[0.06] [&_.bg-emerald-50]:bg-emerald-400/10 [&_.bg-amber-50]:bg-amber-400/10 [&_.bg-rose-50]:bg-rose-400/10 [&_.bg-sky-50]:bg-sky-400/10 [&_.text-slate-950]:text-white [&_.text-slate-900]:text-white [&_.text-slate-800]:text-white/86 [&_.text-slate-700]:text-white/72 [&_.text-slate-600]:text-white/60 [&_.text-slate-500]:text-white/45 [&_.text-slate-400]:text-white/35 [&_.text-emerald-700]:text-emerald-200 [&_.text-emerald-900]:text-emerald-100 [&_.text-amber-700]:text-amber-200 [&_.text-amber-900]:text-amber-100 [&_.text-sky-700]:text-sky-200 [&_.text-sky-900]:text-sky-100 [&_.text-rose-700]:text-rose-200 [&_.text-rose-900]:text-rose-100';

export const Card = ({ tone = 'slate', padded = true, className, children, ...props }: CardProps) => (
  <section
    className={classNames(
      uiTokens.radius.md,
      uiTokens.shadow.card,
      'border',
      padded && 'p-4 md:p-5',
      legacyChildOverrides,
      cardTones[tone],
      className,
    )}
    data-theme-surface={tone === 'slate' ? 'elevated_card' : tone === 'rose' ? 'danger_surface' : tone === 'amber' ? 'warning_surface' : 'health_card'}
    {...props}
  >
    {children}
  </section>
);
