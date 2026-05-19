import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI-OS R8.6 Focus bottom safe area', () => {
  it('keeps the closed Focus bottom area compact and dark', () => {
    const actionBar = readFileSync('src/ui/WorkoutActionBar.tsx', 'utf8');
    const focusBar = readFileSync('src/uiOs/training/FocusModeActionBar.tsx', 'utf8');

    expect(actionBar).toContain('pb-[calc(0.25rem+env(safe-area-inset-bottom))]');
    expect(actionBar).toContain('bg-[#0a0a0b]/96');
    expect(actionBar).not.toContain('0.875rem+env(safe-area-inset-bottom)');
    expect(focusBar).toContain('data-focus-bottom-safe-area="compact"');
    expect(focusBar).toContain('data-focus-mode-action-bar="one-dominant-primary"');
  });
});
