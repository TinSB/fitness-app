import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('UI-OS 3 app shell integration docs', () => {
  const doc = () => readSource('docs/UI_OS_3_CODEX_APP_SHELL_INTEGRATION.md');

  it('documents baseline evidence and shell scope', () => {
    const content = doc();

    for (const expected of [
      'UI-OS 3',
      'Codex App Shell Integration V1',
      'UI-OS 2B complete',
      'PR #274',
      '181e36d355c01fcd1ebb207b9d7cd5fabbf889db',
      '1102 files / 4497 tests',
      'dist token scan clean',
      'MobileAppShell',
      'BottomNav',
      'PageContainer',
      'AppTopBar',
      'LocalFirstSafetyStrip',
      'Today / Train / History / Progress / Settings',
      'existing pages are preserved inside the shell',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents tab mapping and next task boundary', () => {
    const content = doc();

    for (const expected of [
      'Today / 今日 maps to the existing `TodayView`.',
      'Train / 训练 maps to the existing `TrainingFocusView` or `TrainingView`.',
      'History / 历史 maps to the existing `RecordView` history/calendar/data sections.',
      'Progress / 进步 maps to the existing `RecordView` stats/PR sections by default.',
      'Settings / 设置 maps to the existing `ProfileView`',
      'UI-OS 4 — Today / Train / Focus Mode Redesign V1 is recommended next.',
      'UI-OS 4 is not started by UI-OS 3.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
