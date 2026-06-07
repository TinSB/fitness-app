import React, { useState } from 'react';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Early Access', href: '#early-access' },
  { label: 'Pricing Signal', href: '#pricing' },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{
        borderColor: 'rgba(200,205,210,0.08)',
        background: 'rgba(17,19,18,0.82)',
      }}
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <a href="#top" className="text-base font-semibold tracking-tight text-chalk-50">
          IronPath
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <ul className="flex items-center gap-7">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-medium text-steel-300 transition-colors hover:text-chalk-50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#early-access"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-paper-0 transition-opacity hover:opacity-90"
            style={{ borderRadius: 8, background: 'var(--color-ember-500)' }}
          >
            Join Early Access
          </a>
        </div>

        {/* Mobile: keep a single CTA + a compact menu toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <a
            href="#early-access"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-paper-0"
            style={{ borderRadius: 8, background: 'var(--color-ember-500)' }}
          >
            Join
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ borderRadius: 8, borderColor: 'rgba(200,205,210,0.16)' }}
          >
            <span className="flex flex-col gap-1" aria-hidden>
              <span className="block h-0.5 w-4 bg-steel-300" />
              <span className="block h-0.5 w-4 bg-steel-300" />
            </span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t md:hidden" style={{ borderColor: 'rgba(200,205,210,0.08)' }}>
          <ul className="mx-auto flex w-full max-w-6xl flex-col px-5 py-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm font-medium text-steel-300"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
