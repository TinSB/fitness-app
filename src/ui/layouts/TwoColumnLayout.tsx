import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../engines/engineUtils';

interface TwoColumnLayoutProps extends HTMLAttributes<HTMLDivElement> {
  left: ReactNode;
  right: ReactNode;
  leftClassName?: string;
  rightClassName?: string;
}

export const TwoColumnLayout = ({ left, right, leftClassName, rightClassName, className, ...props }: TwoColumnLayoutProps) => (
  <div className={classNames('grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]', className)} {...props}>
    <div className={classNames('min-w-0 space-y-3', leftClassName)}>{left}</div>
    <div className={classNames('min-w-0 space-y-4', rightClassName)}>{right}</div>
  </div>
);
