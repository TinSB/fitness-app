import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveThemeText } from '../src/uiOs/theme/themeTextModel';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { EquipmentProfileSettingsPanel } from '../src/uiOs/settings/EquipmentProfileSettingsPanel';
import { BackupRecoverySettingsPanel } from '../src/uiOs/settings/BackupRecoverySettingsPanel';
import { EmergencyLocalSettingsPanel } from '../src/uiOs/settings/EmergencyLocalSettingsPanel';
import type { UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const lbToKg = (lb: number) => lb * 0.45359237;

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const renderFocusHtml = () =>
  renderToStaticMarkup(
    React.createElement(TrainingFocusView, {
      session: makeFocusSession([
        {
          ...makeExercise('bench-press', 1, 0, 1),
          name: '平板卧推',
          warmupSets: [{ weight: lbToKg(17), reps: 10 }],
          sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
        },
      ]),
      unitSettings,
      restTimer: null,
      expandedExercise: 0,
      setExpandedExercise: setStateNoop,
      onSetChange: noop,
      onCompleteSet: noop,
      onCopyPrevious: noop,
      onAdjustSet: noop,
      onApplySuggestion: noop,
      onUpdateActualDraft: noop,
      onSwitchExercise: noop,
      onReplaceExercise: noop,
      onLoadFeedback: noop,
      onFinish: noop,
      onCompleteSupportSet: noop,
      onSkipSupportExercise: noop,
      onSkipSupportBlock: noop,
      onUpdateSupportSkipReason: noop,
    }),
  );

describe('UI-OS R8.3 training density, contrast, and Chinese copy', () => {
  it('compresses Focus recommendation to one primary load and collapsed weight details', () => {
    const html = renderFocusHtml();
    const text = visibleText(html);

    expect((html.match(/data-focus-primary-load-label="true"/g) || [])).toHaveLength(1);
    expect(text).toContain('本组建议');
    expect(text).not.toContain('器械可做重量');
    expect(text.match(/套用建议/g) || []).toHaveLength(1);
    expect(html).toContain('data-equipment-weight-details="collapsed"');
    expect(html).not.toContain('<details');
    expect(text).toContain('重量详情');
    expect(text).not.toContain('actual record');
    expect(text).not.toContain('base weight not included');
    expect(text).not.toContain('machine stack');
    expect(text).not.toContain('each hand');
  });

  it('moves record details and exercise order into the collapsed More actions', () => {
    const html = renderFocusHtml();
    const secondaryActions = sourceOf('src/features/TrainingFocusView.tsx');
    const recommendation = html.slice(html.indexOf('data-focus-recommendation-density'), html.indexOf('data-focus-secondary-actions-panel'));

    expect(secondaryActions).toContain('记录详情');
    expect(secondaryActions).toContain('动作顺序');
    expect(recommendation).not.toContain('记录详情');
    expect(recommendation).not.toContain('查看动作顺序');
  });

  it('collapses repeated Training page exercise guidance behind details', () => {
    const source = sourceOf('src/features/TrainingView.tsx');

    expect(source).toContain('data-training-exercise-details="collapsed"');
    expect(source).toContain('动作设置');
    expect(source).not.toContain('>本次建议<');
    expect(source).not.toContain('推荐处方与实际记录分开');
  });

  it('uses high contrast semantic text tokens for major headings', () => {
    expect(resolveThemeText('pageTitle', 'dark')).toMatchObject({
      className: 'text-white',
      sourceOfTruthChanged: false,
      persistenceChanged: false,
    });
    expect(resolveThemeText('sectionTitle', 'dark').className).toBe('text-white');
    expect(resolveThemeText('mutedText', 'dark').className).not.toBe(resolveThemeText('pageTitle', 'dark').className);

    const pageHeader = sourceOf('src/ui/PageHeader.tsx');
    const progressCards = sourceOf('src/uiOs/progress/StrengthTrendCards.tsx');

    expect(pageHeader).toContain('data-theme-text="pageTitle"');
    expect(pageHeader).toContain('data-heading-contrast="high"');
    expect(progressCards).toContain('力量趋势 / PR / e1RM');
    expect(progressCards).toContain('data-heading-contrast="high"');
  });

  it('renders Settings and equipment UI with Chinese-first owner copy', () => {
    const settingsText = visibleText([
      renderToStaticMarkup(React.createElement(EquipmentProfileSettingsPanel, { copy: '器械档案只影响推荐显示，不会自动改写历史记录。' })),
      renderToStaticMarkup(React.createElement(BackupRecoverySettingsPanel, { copy: '先导出备份，再进行恢复。', onDownloadBackup: noop, onDownloadCsv: noop, onImportClick: noop, onOpenRecordData: noop })),
      renderToStaticMarkup(React.createElement(EmergencyLocalSettingsPanel, { copy: '本地训练记录仍可继续。' })),
    ].join('\n'));

    for (const phrase of ['备份与恢复', '紧急本地模式', '器械档案', '奥林匹克杠铃', '史密斯机', '哑铃', '插片器械', '挂片器械']) {
      expect(settingsText).toContain(phrase);
    }
    for (const forbidden of ['Backup / Recovery', 'Emergency Local Mode', 'Equipment Profiles', 'Olympic barbell', 'Smith machine', 'Dumbbell', 'Selectorized machine', 'Plate-loaded']) {
      expect(settingsText).not.toContain(forbidden);
    }
  });
});
