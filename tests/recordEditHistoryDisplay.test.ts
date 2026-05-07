import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { DEFAULT_UNIT_SETTINGS } from '../src/engines/unitConversionEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { RecordView } from '../src/features/RecordView';
import type { TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const noop = () => undefined;

const visibleText = (element: React.ReactElement) =>
  renderToStaticMarkup(element)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeEditableSession = (): TrainingSession =>
  makeSession({
    id: 'record-edit-history',
    date: '2026-05-06',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

const renderRecordText = (session: TrainingSession) => {
  const data = makeAppData({ history: [session], unitSettings: DEFAULT_UNIT_SETTINGS });
  const operationResult = { ok: true, changed: false, session, message: '' };
  return visibleText(
    React.createElement(RecordView, {
      data,
      unitSettings: DEFAULT_UNIT_SETTINGS,
      weeklyPrescription: buildWeeklyPrescription(data),
      bodyWeightInput: '',
      setBodyWeightInput: noop as React.Dispatch<React.SetStateAction<string>>,
      onSaveBodyWeight: noop,
      onDeleteSession: () => operationResult,
      onMarkSessionDataFlag: () => operationResult,
      onEditSession: () => operationResult,
      onUpdateUnitSettings: noop,
      onRestoreData: noop,
      selectedSessionId: session.id,
    }),
  );
};

describe('Record edit history display', () => {
  it('renders corrected badge, latest edit time, folded audit trail, and Chinese labels', () => {
    const before = makeEditableSession();
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 102.5, reps: 8 }),
      ['sets'],
      '历史训练详情修正',
      before,
    );
    const text = renderRecordText(edited);

    expect(text).toContain('已修正');
    expect(text).toContain('最近修正：');
    expect(text).toContain('查看修正记录');
    expect(text).toContain('类型：修改正式组');
    expect(text).toContain('字段：重量');
    expect(text).toContain('修改：正式组 1：100kg × 8 / RIR 2 → 正式组 1：102.5kg × 8 / RIR 2');
    expect(text).toContain('影响：总量、有效组、PR、e1RM');
    expect(text).not.toMatch(/\b(undefined|null|working_set|warmup_set|data_flag|effectiveSet|calendar|sessionQuality)\b|bench-press|__auto_alt|__alt_/);
  });

  it('renders warmup audit rows as not affecting PR, e1RM, or effective sets', () => {
    const before = {
      ...makeEditableSession(),
      focusWarmupSetLogs: [
        {
          id: 'main:bench-press:warmup:0',
          exerciseId: 'bench-press',
          type: 'warmup',
          weight: 20,
          actualWeightKg: 20,
          reps: 8,
          rir: '',
          done: true,
        },
      ],
    };
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'main:bench-press:warmup:0', { weightKg: 45, reps: 8 }),
      ['warmupSets'],
      '历史训练热身组修正',
      before,
    );
    const text = renderRecordText(edited);

    expect(text).toContain('类型：修改热身组');
    expect(text).toContain('修改：热身组 1：20kg × 8 → 热身组 1：45kg × 8');
    expect(text).toContain('影响：不影响 PR、e1RM 和有效组');
    expect(text).not.toMatch(/\b(undefined|null|warmup_set|none)\b|bench-press|__auto_alt|__alt_/);
  });
});
