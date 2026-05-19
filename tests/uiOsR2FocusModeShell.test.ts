import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('UI-OS R2 Focus shell behavior', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const shellSource = readFileSync('src/uiOs/MobileAppShell.tsx', 'utf8');
  const mainSource = readFileSync('src/main.tsx', 'utf8');

  it('keeps normal bottom nav and hides it in immersive Focus Mode', () => {
    expect(appSource).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(shellSource).toContain('{!immersive ? <BottomNav');
    expect(shellSource).toContain("immersive ? 'pb-0' : 'pb-28'");
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
