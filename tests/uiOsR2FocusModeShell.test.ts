import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('UI-OS R2 Focus shell behavior', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const shellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
  const mainSource = readFileSync('src/main.tsx', 'utf8');

  it('keeps normal bottom nav and hides it in immersive Focus Mode', () => {
    expect(appSource).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(shellSource).toContain('{!immersive ? <BottomNav');
    expect(shellSource).toContain("data-shell-safe-bottom={immersive ? 'immersive' : 'bottom-nav-protected'}");
    expect(shellSource).toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))] scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]");
    expect(shellSource).toContain("data-shell-bottom-reserve={immersive ? 'none' : 'content-clearance'}");
    expect(appSource).toContain('<TrainingFocusView');
  });

  it('does not import prototype runtime files into production', () => {
    for (const source of [appSource, shellSource, mainSource]) {
      expect(source).not.toContain('IronPathOS2');
      expect(source).not.toContain('prototypePreview');
      expect(source).not.toContain('src/prototype');
    }
  });
});
