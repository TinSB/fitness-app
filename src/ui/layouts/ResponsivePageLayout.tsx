import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';
import { uiTokens } from '../designTokens';

interface ResponsivePageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  bleed?: boolean;
}

export const ResponsivePageLayout = ({ children, bleed = false, className, ...props }: ResponsivePageLayoutProps) => (
  <div
    className={classNames(
      'mx-auto w-full',
      bleed ? 'max-w-none' : uiTokens.page.maxWidth,
      uiTokens.page.contentPadding,
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
