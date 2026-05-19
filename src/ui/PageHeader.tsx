import type { ReactNode } from 'react';
import { uiTokens } from './designTokens';
import { resolveThemeText } from '../uiOs/theme/themeTextModel';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, description, action }: PageHeaderProps) => (
  <header className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between">
    <div>
      {eyebrow ? <div className={`mb-1 ${uiTokens.typography.pageEyebrow}`} data-theme-text="pageEyebrow">{eyebrow}</div> : null}
      <h1 className={uiTokens.typography.pageTitle} data-theme-text="pageTitle" data-heading-contrast="high">{title}</h1>
      {description ? <div className={`mt-2 ${uiTokens.typography.helper}`}>{description}</div> : null}
    </div>
    {action}
  </header>
);

export const pageTitleTextToken = resolveThemeText('pageTitle', 'dark');
