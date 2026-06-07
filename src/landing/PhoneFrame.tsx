import React from 'react';
import { ScreenPlaceholder } from './ScreenPlaceholder';

/**
 * A blank, premium iPhone frame holding three reserved screenshot slots.
 * No fake product UI — only intentional placeholders.
 */
export function PhoneFrame() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* Device body */}
      <div
        className="relative rounded-[44px] border p-3"
        style={{
          borderColor: 'rgba(200,205,210,0.16)',
          background: 'var(--color-graphite-800)',
          boxShadow:
            '0 1px 0 rgba(246,247,245,0.04) inset, 0 40px 80px -40px rgba(0,0,0,0.9)',
        }}
      >
        {/* Screen */}
        <div
          className="relative overflow-hidden rounded-[34px]"
          style={{ background: 'var(--color-graphite-900)' }}
        >
          {/* Notch */}
          <div className="flex justify-center pt-3">
            <div
              className="h-5 w-24 rounded-full"
              style={{ background: 'rgba(17,19,18,0.9)', border: '1px solid rgba(200,205,210,0.08)' }}
              aria-hidden
            />
          </div>

          <div className="flex flex-col gap-3 px-4 pb-6 pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold tracking-tight text-chalk-50">IronPath</span>
              <span className="tnum text-[11px] text-steel-600">Push A · Day 12</span>
            </div>
            <ScreenPlaceholder label="Today decision placeholder" active />
            <ScreenPlaceholder label="Current set placeholder" />
            <ScreenPlaceholder label="Decision receipt placeholder" />
          </div>
        </div>
      </div>
    </div>
  );
}
