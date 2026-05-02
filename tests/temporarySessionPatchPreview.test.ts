import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import {
  buildPendingSessionPatch,
  getActivePendingSessionPatches,
  upsertPendingSessionPatch,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
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
  reason: '今天恢复一般，先保证主训练质量。',
  reversible: true,
};

const reduceIntensityPatch: SessionPatch = {
  id: 'session-patch-reduce-intensity',
  type: 'reduce_intensity',
  targetId: 'barbell-row',
  title: '降低本次强度',
  description: '本次不主动加重。',
  reason: '背部酸痛，划船动作保持保守。',
  reversible: true,
};

const substitutePatch: SessionPatch = {
  id: 'session-patch-substitute',
  type: 'substitute_exercise',
  targetId: 'barbell-row',
  title: '建议替代动作',
  description: '本次训练中提示替代。',
  reason: '当前动作恢复冲突较高。',
  reversible: true,
};

const renderToday = (pendingSessionPatches: SessionPatch[] = []) => {
  const data = makeAppData({
    selectedTemplateId: 'pull-a',
    activeProgramTemplateId: 'pull-a',
    unitSettings,
  });
  const selectedTemplate = getTemplate('pull-a');
  return renderToStaticMarkup(
    React.createElement(TodayView, {
      data,
      selectedTemplate,
      suggestedTemplate: getTemplate('legs-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingMode: data.trainingMode as TrainingMode,
      pendingSessionPatches,
      temporarySessionAdjustmentActive: pendingSessionPatches.length > 0,
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

describe('temporary session patch preview', () => {
  it('shows adjusted preview state after temporary patches are pending', () => {
    const text = renderToday([reduceSupportPatch, reduceIntensityPatch]);

    expect(text).toContain('训练预览');
    expect(text).toContain('已应用本次调整');
    expect(text).toContain('本次调整');
    expect(text).toContain('减少');
    expect(text).toContain('不主动加重，降低本次强度');
    expect(text).toContain('只影响本次训练，不修改原模板');
    expect(text).toContain('降低强度');
  });

  it('shows substitute and skipped support hints without raw enum text', () => {
    const text = renderToday([reduceSupportPatch, substitutePatch]);

    expect(text).toContain('训练预览');
    expect(text).toContain('已应用本次调整');
    expect(text).toContain('建议替代');
    expect(text).toMatch(/本次跳过|辅助内容本次减少/);
    expect(text).not.toMatch(/\b(reduce_support|reduce_intensity|substitute_exercise|undefined|null)\b/);
  });

  it('restores original preview when pending patches are cleared', () => {
    const originalText = renderToday([]);
    const adjustedText = renderToday([reduceSupportPatch]);

    expect(adjustedText).toContain('已应用本次调整');
    expect(originalText).toContain('训练预览');
    expect(originalText).not.toContain('已应用本次调整');
  });

  it('keeps adopting adjustment wired to real pending patch state, not only toast', () => {
    const data = makeAppData({
      selectedTemplateId: 'pull-a',
      activeProgramTemplateId: 'pull-a',
      unitSettings,
      pendingSessionPatches: [],
      settings: { pendingSessionPatches: [] },
    });
    const pending = buildPendingSessionPatch({
      patches: [reduceSupportPatch, reduceIntensityPatch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'daily-adjustment:pull-a:preview',
      targetTemplateId: 'pull-a',
    });
    const upserted = upsertPendingSessionPatch(data.pendingSessionPatches, pending);
    const nextData = {
      ...data,
      pendingSessionPatches: upserted.pendingPatches,
      settings: { ...data.settings, pendingSessionPatches: upserted.pendingPatches },
    };
    const activePatches = getActivePendingSessionPatches(nextData.pendingSessionPatches, '2026-05-01', 'pull-a');
    const text = renderToday(activePatches);

    expect(upserted.created).toBe(true);
    expect(nextData.pendingSessionPatches).toEqual([
      expect.objectContaining({
        id: pending.id,
        status: 'pending',
        sourceFingerprint: 'daily-adjustment:pull-a:preview',
        targetTemplateId: 'pull-a',
      }),
    ]);
    expect(nextData.settings.pendingSessionPatches).toEqual(nextData.pendingSessionPatches);
    expect(activePatches).toHaveLength(2);
    expect(text).toContain('已应用本次调整');
    expect(text).toContain('本次调整');
    expect(text).not.toMatch(/\b(undefined|null|pending)\b/);
  });
});
