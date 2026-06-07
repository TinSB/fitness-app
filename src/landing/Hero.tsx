import React from 'react';
import { PhoneFrame } from './PhoneFrame';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* Copy column */}
        <div className="relative flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-steel-600">
            Native iOS · Early access · Built for strength training
          </span>

          <h1 className="mt-6 text-5xl font-bold leading-none tracking-tight text-chalk-50 md:text-6xl">
            IronPath
          </h1>

          <p className="mt-5 text-2xl font-semibold leading-tight text-chalk-50 md:text-3xl text-balance">
            Plan the lift. Show the reason.
          </p>

          <p className="mt-5 max-w-md text-base leading-relaxed text-steel-300">
            Not another logbook. Not a black-box coach. IronPath gives you the
            lift, the load, and the reason.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#early-access"
              className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-paper-0 transition-opacity hover:opacity-90"
              style={{ borderRadius: 8, background: 'var(--color-ember-500)' }}
            >
              Join Early Access
            </a>
            <a
              href="#early-access"
              className="inline-flex items-center justify-center rounded-lg border px-6 py-3 text-sm font-semibold text-chalk-50 transition-colors hover:bg-white/[0.04]"
              style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.18)' }}
            >
              Apply for TestFlight
            </a>
          </div>
        </div>

        {/* Product column with the thin ember path marker */}
        <div className="relative flex items-center justify-center">
          {/* Thin ember line connecting copy to the product */}
          <div
            className="ember-line absolute -left-4 top-0 hidden h-full w-px lg:block"
            aria-hidden
          />
          <PhoneFrame />
        </div>
      </div>
    </section>
  );
}
