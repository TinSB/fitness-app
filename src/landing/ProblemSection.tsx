import React from 'react';

const blocks = [
  {
    title: 'Decision',
    body: 'Train today or hold. One clear call, not a wall of metrics to interpret yourself.',
  },
  {
    title: 'Direction',
    body: 'Add weight, repeat, or scale back. The next move is named before you touch the bar.',
  },
  {
    title: 'Evidence',
    body: 'Every change carries the signal behind it, so you know why the plan moved.',
  },
];

export function ProblemSection() {
  return (
    <section
      className="border-t"
      style={{ borderColor: 'rgba(200,205,210,0.08)' }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-chalk-50 md:text-4xl text-balance">
          The hard part is the next decision.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-steel-300">
          Should you train today? Add weight or hold? Push through or deload?
          IronPath turns those calls into clear coaching notes.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border md:grid-cols-3"
          style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.1)', background: 'rgba(200,205,210,0.1)' }}
        >
          {blocks.map((block) => (
            <div
              key={block.title}
              className="flex flex-col gap-3 p-6"
              style={{ background: 'var(--color-graphite-900)' }}
            >
              <div className="flex items-center gap-2.5">
                <span className="h-4 w-px" style={{ background: 'var(--color-ember-500)' }} aria-hidden />
                <span className="text-sm font-semibold tracking-tight text-chalk-50">
                  {block.title}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-steel-300">{block.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
