import React from 'react';

const plans = [
  { name: 'Monthly', price: '$9.99', cadence: '/ month' },
  { name: 'Yearly', price: '$69', cadence: '/ year' },
];

export function PricingSignal() {
  return (
    <section id="pricing" className="border-t" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-chalk-50 md:text-4xl text-balance">
          Founding pricing we are testing
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-steel-300">
          These are not live subscriptions yet. Clicking a plan should not charge
          you. This helps test whether IronPath is worth building as a paid iOS app.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-lg border p-6"
              style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.1)', background: 'var(--color-graphite-800)' }}
            >
              <span className="text-sm font-medium uppercase tracking-[0.14em] text-steel-600">
                {plan.name}
              </span>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="tnum text-4xl font-bold tracking-tight text-chalk-50">{plan.price}</span>
                <span className="text-sm text-steel-600">{plan.cadence}</span>
              </div>
              <button
                type="button"
                className="mt-6 inline-flex items-center justify-center rounded-lg border px-5 py-3 text-sm font-semibold text-chalk-50 transition-colors hover:border-[var(--color-ember-500)] hover:text-paper-0"
                style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.18)' }}
              >
                I would pay for this
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
