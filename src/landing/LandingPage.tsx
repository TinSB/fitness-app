import React from 'react';
import { SiteNav } from './SiteNav';
import { Hero } from './Hero';
import { ProblemSection } from './ProblemSection';
import { ProductPromise } from './ProductPromise';
import { DesignLanguage } from './DesignLanguage';
import { EarlyAccess } from './EarlyAccess';
import { PricingSignal } from './PricingSignal';

export function LandingPage() {
  return (
    <div className="min-h-dvh font-sans" style={{ background: 'var(--color-graphite-900)' }}>
      <SiteNav />
      <main>
        <Hero />
        <ProblemSection />
        <ProductPromise />
        <DesignLanguage />
        <EarlyAccess />
        <PricingSignal />
      </main>
      <footer className="border-t" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
        <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
          <p className="text-xs leading-relaxed text-steel-600">
            IronPath · Early access · General fitness guidance, not medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
