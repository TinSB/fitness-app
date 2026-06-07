import React from 'react';

const rows = [
  {
    label: "Today's call",
    body: 'You can train today. Push A stays, with pressing volume capped.',
  },
  {
    label: 'Next set',
    body: 'Bench press. 3 × 5. Next set: 185 lb × 5, RIR 2.',
  },
  {
    label: 'Reason',
    body: 'Shoulder discomfort showed up twice, so high-risk pressing is scaled back.',
  },
  {
    label: 'Control',
    body: 'Apply, skip, swap, or undo.',
  },
];

export function ProductPromise() {
  return (
    <section id="product" className="border-t" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-chalk-50 md:text-4xl text-balance">
          Open the app and know what changed.
        </h2>

        <div className="mt-12 flex flex-col gap-px overflow-hidden rounded-lg border"
          style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.1)', background: 'rgba(200,205,210,0.1)' }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-[160px_1fr] sm:gap-6 sm:p-6"
              style={{ background: 'var(--color-graphite-900)' }}
            >
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-px" style={{ background: 'var(--color-ember-500)' }} aria-hidden />
                <span className="text-sm font-semibold tracking-tight text-chalk-50">{row.label}</span>
              </div>
              <p className="tnum text-sm leading-relaxed text-steel-300">{row.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
