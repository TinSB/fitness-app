import React from 'react';

/** Emberline — a thin ember path marking the next training step. */
function EmberlineVisual() {
  return (
    <div className="flex h-24 items-center justify-center">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(200,205,210,0.3)' }} />
        <span className="h-px w-10" style={{ background: 'rgba(200,205,210,0.2)' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-ember-500)' }} />
        <span className="ember-line h-px w-16" style={{ background: 'var(--color-ember-500)' }} />
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: 'var(--color-ember-500)', boxShadow: '0 0 0 4px rgba(232,93,42,0.16)' }}
        />
      </div>
    </div>
  );
}

/** Load Plate — a compact weight-number module. */
function LoadPlateVisual() {
  return (
    <div className="flex h-24 items-center justify-center">
      <div
        className="flex flex-col items-center justify-center rounded-lg border px-6 py-3"
        style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.16)', background: 'rgba(246,247,245,0.03)' }}
        aria-hidden
      >
        <span className="tnum text-2xl font-bold tracking-tight text-chalk-50">185</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-steel-600">lb · 5 reps</span>
      </div>
    </div>
  );
}

/** Decision Receipt — signal, change, and control. */
function DecisionReceiptVisual() {
  return (
    <div className="flex h-24 flex-col justify-center gap-1.5" aria-hidden>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-ember-500)' }} />
        <span className="h-2 w-24 rounded-full" style={{ background: 'rgba(200,205,210,0.22)' }} />
      </div>
      <div className="flex items-center gap-2 pl-3.5">
        <span className="h-2 w-32 rounded-full" style={{ background: 'rgba(200,205,210,0.12)' }} />
      </div>
      <div className="flex items-center gap-2 pl-3.5">
        <span className="h-2 w-20 rounded-full" style={{ background: 'rgba(200,205,210,0.12)' }} />
      </div>
    </div>
  );
}

const features = [
  {
    title: 'Emberline',
    body: 'A thin ember path marking the next training step.',
    visual: <EmberlineVisual />,
  },
  {
    title: 'Load Plate',
    body: 'A compact weight-number module for the set in front of you.',
    visual: <LoadPlateVisual />,
  },
  {
    title: 'Decision Receipt',
    body: 'A short explanation with signal, change, and control.',
    visual: <DecisionReceiptVisual />,
  },
];

export function DesignLanguage() {
  return (
    <section className="border-t" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-chalk-50 md:text-4xl text-balance">
          A calibrated instrument, guided by a calm coach.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col rounded-lg border p-6"
              style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.1)', background: 'var(--color-graphite-800)' }}
            >
              {feature.visual}
              <div className="mt-5 border-t pt-5" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
                <h3 className="text-sm font-semibold tracking-tight text-chalk-50">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-steel-300">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
