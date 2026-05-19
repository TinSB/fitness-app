import { describe, expect, it } from 'vitest';
import { resolveThemePreference } from '../src/engines/themePreferenceModel';

describe('theme preference model', () => {
  it('resolves system theme from system dark preference', () => {
    const result = resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: true });

    expect(result.resolvedTheme).toBe('dark');
    expect(result.shellThemeClass).toBe('uios-theme-dark');
  });

  it('resolves system theme from system light preference', () => {
    const result = resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: false });

    expect(result.resolvedTheme).toBe('light');
    expect(result.shellThemeClass).toBe('uios-theme-light');
  });

  it('resolves explicit light and dark themes', () => {
    expect(resolveThemePreference({ selectedThemeMode: 'light', systemPrefersDark: true }).resolvedTheme).toBe('light');
    expect(resolveThemePreference({ selectedThemeMode: 'dark', systemPrefersDark: false }).resolvedTheme).toBe('dark');
  });

  it('allows Focus Mode to prefer immersive dark', () => {
    const result = resolveThemePreference({ selectedThemeMode: 'light', focusModeImmersive: true });

    expect(result.resolvedTheme).toBe('light');
    expect(result.focusModeUsesImmersiveDark).toBe(true);
  });

  it('does not imply AppData source-of-truth or persistence mutation', () => {
    const result = resolveThemePreference({ selectedThemeMode: 'dark' });

    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.persistenceChanged).toBe(false);
  });
});
