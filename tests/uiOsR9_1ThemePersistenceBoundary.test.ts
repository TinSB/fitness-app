import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  UI_THEME_STORAGE_KEY,
  normalizeUiThemeMode,
  readUiThemePreference,
  writeUiThemePreference,
} from '../src/uiOs/theme/uiThemePreferenceStorage';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('UI-OS R9.1 theme persistence boundary', () => {
  it('uses a UI-only localStorage key outside AppData and source-of-truth storage', () => {
    expect(UI_THEME_STORAGE_KEY).toBe('ironpath:ui-theme');
    expect(UI_THEME_STORAGE_KEY).not.toContain('appData');
    expect(UI_THEME_STORAGE_KEY).not.toContain('source');
    expect(UI_THEME_STORAGE_KEY).not.toContain('cloud');
  });

  it('reads and writes only the namespaced UI theme preference', () => {
    const storage = new MemoryStorage();
    writeUiThemePreference('light', storage);

    expect(storage.values.get('ironpath:ui-theme')).toBe('light');
    expect(readUiThemePreference(storage)).toBe('light');
    expect(storage.values.size).toBe(1);
    expect(normalizeUiThemeMode('invalid')).toBe('system');
  });

  it('does not touch AppData persistence or source-of-truth modules', () => {
    const appSource = readFileSync('src/App.tsx', 'utf8');
    const storageSource = readFileSync('src/storage/persistence.ts', 'utf8');
    const themeStorageSource = readFileSync('src/uiOs/theme/uiThemePreferenceStorage.ts', 'utf8');

    expect(appSource).toContain('readUiThemePreference');
    expect(appSource).not.toContain('selectedThemeMode: data');
    expect(themeStorageSource).toContain('ironpath:ui-theme');
    expect(themeStorageSource).not.toContain('AppData');
    expect(themeStorageSource).not.toContain('saveData');
    expect(storageSource).not.toContain('ironpath:ui-theme');
  });
});
