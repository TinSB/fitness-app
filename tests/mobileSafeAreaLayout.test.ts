import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile safe-area layout', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const commonSource = readFileSync(resolve(process.cwd(), 'src/ui/common.tsx'), 'utf8');

  it('keeps top safe-area handling in the app header, not repeated in Page content', () => {
    expect(appSource).toContain('pt-[env(safe-area-inset-top)]');
    expect(commonSource).toContain('pt-4 md:px-8 md:py-8');
    expect(commonSource).not.toContain('pt-[calc(1rem+env(safe-area-inset-top))]');
    expect(commonSource).not.toContain('pt-[calc(1.25rem+env(safe-area-inset-top))]');
  });

  it('keeps bottom safe-area for mobile action areas', () => {
    expect(commonSource).toContain('env(safe-area-inset-bottom)');
    expect(appSource).toContain('pb-[env(safe-area-inset-bottom)]');
  });
});
