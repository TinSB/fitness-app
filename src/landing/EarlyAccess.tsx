import React, { useState } from 'react';

const frequencyOptions = ['2 days / week', '3 days / week', '4 days / week', '5+ days / week'];

export function EarlyAccess() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="early-access" className="border-t" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-chalk-50 md:text-4xl text-balance">
              Help shape the first iOS beta.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-steel-300">
              Early access is for serious beginner and intermediate lifters who
              want a clear next move, not another tracker to maintain.
            </p>
          </div>

          <form
            className="flex flex-col gap-5 rounded-lg border p-6 md:p-8"
            style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.1)', background: 'var(--color-graphite-800)' }}
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-chalk-50">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                className="rounded-lg border px-4 py-3 text-sm text-chalk-50 outline-none transition-colors placeholder:text-steel-600 focus:border-[var(--color-ember-500)]"
                style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.16)', background: 'rgba(17,19,18,0.6)' }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="frequency" className="text-sm font-medium text-chalk-50">
                Training frequency
              </label>
              <select
                id="frequency"
                className="rounded-lg border px-4 py-3 text-sm text-chalk-50 outline-none transition-colors focus:border-[var(--color-ember-500)]"
                style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.16)', background: 'rgba(17,19,18,0.6)' }}
              >
                {frequencyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="goal" className="text-sm font-medium text-chalk-50">
                What should IronPath solve for you?
              </label>
              <textarea
                id="goal"
                rows={3}
                placeholder="The decision you keep second-guessing."
                className="resize-none rounded-lg border px-4 py-3 text-sm leading-relaxed text-chalk-50 outline-none transition-colors placeholder:text-steel-600 focus:border-[var(--color-ember-500)]"
                style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.16)', background: 'rgba(17,19,18,0.6)' }}
              />
            </div>

            <button
              type="submit"
              className="mt-1 inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-paper-0 transition-opacity hover:opacity-90"
              style={{ borderRadius: 8, background: 'var(--color-ember-500)' }}
            >
              {submitted ? 'Request received' : 'Join Early Access'}
            </button>

            {submitted ? (
              <p className="text-sm leading-relaxed text-steel-300">
                Thanks — you&apos;re on the list. We&apos;ll reach out as TestFlight slots open.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
