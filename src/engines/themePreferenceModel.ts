export type ThemePreferenceMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type ThemeSurfaceTone = 'light_health' | 'dark_glass';

export type ThemePreferenceInput = {
  selectedThemeMode?: ThemePreferenceMode;
  systemPrefersDark?: boolean;
  focusModeImmersive?: boolean;
};

export type ThemePreferenceResult = {
  selectedThemeMode: ThemePreferenceMode;
  resolvedTheme: ResolvedTheme;
  shellThemeClass: string;
  surfaceTone: ThemeSurfaceTone;
  focusModeUsesImmersiveDark: boolean;
  sourceOfTruthChanged: false;
  persistenceChanged: false;
};

const normalizeThemeMode = (mode?: ThemePreferenceMode): ThemePreferenceMode =>
  mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';

export const resolveThemePreference = (input: ThemePreferenceInput = {}): ThemePreferenceResult => {
  const selectedThemeMode = normalizeThemeMode(input.selectedThemeMode);
  const resolvedTheme: ResolvedTheme =
    selectedThemeMode === 'system' ? (input.systemPrefersDark ? 'dark' : 'light') : selectedThemeMode;

  return {
    selectedThemeMode,
    resolvedTheme,
    shellThemeClass: resolvedTheme === 'dark' ? 'uios-theme-dark' : 'uios-theme-light',
    surfaceTone: resolvedTheme === 'dark' ? 'dark_glass' : 'light_health',
    focusModeUsesImmersiveDark: input.focusModeImmersive !== false,
    sourceOfTruthChanged: false,
    persistenceChanged: false,
  };
};
