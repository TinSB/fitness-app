import { createContext, useContext, type ReactNode } from 'react';
import type { ResolvedTheme, ThemePreferenceMode } from '../../engines/themePreferenceModel';

export type UiThemeContextValue = {
  selectedThemeMode: ThemePreferenceMode;
  resolvedTheme: ResolvedTheme;
  focusModeImmersiveDark: boolean;
};

const defaultTheme: UiThemeContextValue = {
  selectedThemeMode: 'dark',
  resolvedTheme: 'dark',
  focusModeImmersiveDark: true,
};

const UiThemeContext = createContext<UiThemeContextValue>(defaultTheme);

export function UiThemeProvider({ value, children }: { value: UiThemeContextValue; children: ReactNode }) {
  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme() {
  return useContext(UiThemeContext);
}
