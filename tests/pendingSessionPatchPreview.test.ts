import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildPendingSessionPatch,
  getActivePendingSessionPatches,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import type { TrainingMode } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const unitSettings = {
  weightUnit: 'kg' as const,
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const reduceSupportPatch: SessionPatch = {
  id: 'session-patch-reduce-support',
  type: 'reduce_support',
  title: '减少辅助训练',
  description: '本次减少辅助内容，优先保留主训练。',
  reason: '今天恢复一般。',
  reversible: true,
};

const reduceIntensityPatch: SessionPatch = {
  id: 'session-patch-reduce-intensity',
  type: 'reduce_intensity',
  title: '降低本次强度',
  description: '本次不主动加重。',
  reason: '保守推进。',
  reversible: true,
};

const renderTodayWithPatches = (patches: SessionPatch[]) => {
  const data = makeAppData({
    selectedTemplateId: 'pull-a',
    activeProgramTemplateId: 'pull-a',
    unitSettings,
  });
  return renderToStaticMarkup(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate('pull-a'),
      suggestedTemplate: getTemplate('pull-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingMode: data.trainingMode as TrainingMode,
      pendingSessionPatches: patches,
      temporarySessionAdjustmentActive: patches.length > 0,
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
      onCoachAction: noop,
      onDismissCoachAction: noop,
      onRevertTemporarySessionPatches: noop,
    }),
  ).replace(/<[^>]+>/g, ' ');
};

describe('pending session patch preview', () => {
  it('renders persisted active pending patches as an applied temporary adjustment', () => {
    const pending = buildPendingSessionPatch({
      patches: [reduceSupportPatch, reduceIntensityPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const patches = getActivePendingSessionPatches([pending], '2026-05-01', 'pull-a');
    const text = renderTodayWithPatches(patches);

    expect(text).toMatch(/已应用本次调整|宸插簲鐢ㄦ湰娆¤皟鏁/);
    expect(text).toMatch(/本次调整|鏈璋冩暣/);
    expect(text).toMatch(/减少|鍑忓皯/);
    expect(text).not.toMatch(/\b(reduce_support|reduce_intensity|pending|undefined|null)\b/);
  });

  it('does not show pending patch preview when target template does not match', () => {
    const pending = buildPendingSessionPatch({
      patches: [reduceSupportPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a',
      targetTemplateId: 'pull-a',
    });
    const patches = getActivePendingSessionPatches([pending], '2026-05-01', 'push-a');
    const text = renderTodayWithPatches(patches);

    expect(patches).toEqual([]);
    expect(text).not.toMatch(/已应用本次调整|宸插簲鐢ㄦ湰娆¤皟鏁/);
  });
});
