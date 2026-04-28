import type { ReactNode } from 'react';
import { uiTokens } from './designTokens';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, description, action }: PageHeaderProps) => (
  <header className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between">
    <div>
      {eyebrow ? <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">{eyebrow}</div> : null}
      <h1 className={uiTokens.typography.pageTitle}>{title}</h1>
      {description ? <div className={`mt-2 ${uiTokens.typography.helper}`}>{description}</div> : null}
    </div>
    {action}
  </header>
);
