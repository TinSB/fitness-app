import type { ThemePreferenceMode } from '../../engines/themePreferenceModel';

export const UI_THEME_STORAGE_KEY = 'ironpath:ui-theme';

export const normalizeUiThemeMode = (mode: unknown): ThemePreferenceMode =>
  mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';

export function readUiThemePreference(storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): ThemePreferenceMode {
  if (!storage) return 'system';
  try {
    return normalizeUiThemeMode(storage.getItem(UI_THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function writeUiThemePreference(
  mode: ThemePreferenceMode,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
) {
  if (!storage) return;
  try {
    storage.setItem(UI_THEME_STORAGE_KEY, normalizeUiThemeMode(mode));
  } catch {
    // UI-only preference writes are best effort and must not affect training data.
  }
}
