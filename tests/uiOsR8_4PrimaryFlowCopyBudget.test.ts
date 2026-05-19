import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BackupRecoverySettingsPanel } from '../src/uiOs/settings/BackupRecoverySettingsPanel';
import { CloudCandidateSettingsPanel } from '../src/uiOs/settings/CloudCandidateSettingsPanel';
import { DiagnosticsDataSafetyPanel } from '../src/uiOs/settings/DiagnosticsDataSafetyPanel';
import { EquipmentProfileSettingsPanel } from '../src/uiOs/settings/EquipmentProfileSettingsPanel';
import { ThemeSettingsPanel } from '../src/uiOs/settings/ThemeSettingsPanel';
import { buildDataHealthClaritySummary } from '../src/engines/dataHealthClaritySummary';
import { resolveThemePreference } from '../src/engines/themePreferenceModel';
import type { UnitSettings } from '../src/models/training-model';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const noop = (..._args: unknown[]) => undefined;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const unitSettings: UnitSettings = { weightUnit: 'lb', defaultIncrementKg: 2.5, defaultIncrementLb: 5, customIncrementsKg: [], customIncrementsLb: [] };

describe('UI-OS R8.4 primary-flow copy budget', () => {
  it('keeps Today Train History and Settings page headers free of generic subtitles', () => {
    const combined = [
      read('src/features/TodayView.tsx'),
      read('src/features/TrainingView.tsx'),
      read('src/features/RecordView.tsx'),
      read('src/features/ProfileView.tsx'),
    ].join('\n');

    expect(combined).not.toContain('判断今天练不练、练什么，以及从哪里开始');
    expect(combined).not.toContain('完整训练页用于查看整体流程');
    expect(combined).not.toContain('默认从日历进入，回答');
    expect(combined).not.toContain('管理个人资料、筛查、单位');
    expect(combined).not.toContain('这里用于查看全流程');
    expect(combined).not.toContain('完整页用于复盘和补记');
  });

  it('renders Settings top-level cards with short summaries and collapsed details', () => {
    const summary = buildDataHealthClaritySummary({ issues: [], sourceOfTruthClear: true });
    const markup = [
      renderToStaticMarkup(React.createElement(ThemeSettingsPanel, {
        theme: resolveThemePreference({ selectedThemeMode: 'system', systemPrefersDark: false, focusModeImmersive: true }),
        unitSettings,
        onThemeChange: noop,
        onUnitChange: noop,
      })),
      renderToStaticMarkup(React.createElement(BackupRecoverySettingsPanel, {
        copy: '先导出备份，再进行恢复。恢复会覆盖当前浏览器里的 IronPath 数据，请先确认备份。',
        onDownloadBackup: noop,
        onDownloadCsv: noop,
        onImportClick: noop,
        onOpenRecordData: noop,
      })),
      renderToStaticMarkup(React.createElement(EquipmentProfileSettingsPanel, { copy: '器械档案只影响推荐显示，不会自动改写历史记录。' })),
      renderToStaticMarkup(React.createElement(CloudCandidateSettingsPanel, { copy: '云端候选需要手动确认，不会自动覆盖本地数据；上传候选也需要再次确认。' })),
      renderToStaticMarkup(React.createElement(DiagnosticsDataSafetyPanel, { diagnosticsCopy: '诊断摘要不会上传完整训练数据；只显示脱敏摘要；不会外传诊断。', dataHealthSummary: summary })),
    ].join('\n');
    const visible = text(markup);

    expect(visible).toContain('先导出备份，再进行恢复。');
    expect(visible).toContain('器械配置只影响推荐显示。');
    expect(visible).toContain('诊断摘要已脱敏。');
    expect(visible).not.toContain('主题只影响本次界面显示');
    expect(visible).not.toContain('不会改写历史记录');
    expect(visible).not.toContain('这里不提供一键同步');
    expect(markup).toContain('data-settings-diagnostics-details="collapsed"');
    expect(markup).toContain('data-settings-equipment-editor="collapsed"');
  });
});
