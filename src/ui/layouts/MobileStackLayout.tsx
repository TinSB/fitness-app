import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';

interface MobileStackLayoutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const MobileStackLayout = ({ children, className, ...props }: MobileStackLayoutProps) => (
  <div className={classNames('space-y-3 md:space-y-4', className)} {...props}>
    {children}
  </div>
);
