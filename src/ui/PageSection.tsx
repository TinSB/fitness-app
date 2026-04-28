import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';
import { SectionHeader } from './common';

interface PageSectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
}

export const PageSection = ({ title, eyebrow, description, action, className, children, ...props }: PageSectionProps) => (
  <section className={classNames('space-y-3', className)} {...props}>
    {title ? <SectionHeader eyebrow={eyebrow} title={title} description={description} action={action} /> : null}
    {children}
  </section>
);
