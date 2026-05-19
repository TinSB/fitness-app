import type { ReactNode } from 'react';
import { classNames } from '../engines/engineUtils';

interface PageContainerProps {
  auxiliary?: ReactNode;
  immersive?: boolean;
  children: ReactNode;
}

export const PageContainer = ({ auxiliary, immersive = false, children }: PageContainerProps) => (
  <div
    className={classNames(
      'mx-auto w-full max-w-[1600px]',
      auxiliary && !immersive ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6' : '',
    )}
  >
    <section className="min-w-0">{children}</section>
    {auxiliary && !immersive ? (
      <aside className="hidden min-w-0 px-4 py-6 lg:block xl:px-6">
        <div className="sticky top-6 space-y-3">{auxiliary}</div>
      </aside>
    ) : null}
  </div>
);
