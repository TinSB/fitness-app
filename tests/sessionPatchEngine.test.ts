import { describe, expect, it } from 'vitest';
import {
  applySessionPatches,
  buildSessionPatchesFromDailyAdjustment,
  revertSessionPatches,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import type { DailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';
import { getTemplate, makeAppData } from './fixtures';

const visiblePatchText = (patches: SessionPatch[]) =>
  patches.flatMap((patch) => [patch.title, patch.description, patch.reason]).join('\n');

const conservativeAdjustment: DailyTrainingAdjustment = {
  type: 'reduce_support',
  title: '减少辅助',
  summary: '今天优先完成主训练，减少辅助内容。',
  reasons: ['昨晚恢复一般，本次只做轻量调整。'],
  suggestedChanges: [
    { type: 'reduce_support', reason: '减少未完成的纠偏和功能补丁。' },
    { type: 'extend_rest', reason: '组间休息略微延长。' },
  ],
  confidence: 'medium',
  requiresUserConfirmation: true,
};

describe('sessionPatchEngine', () => {
  it('builds Chinese patches from daily adjustment without raw enum text', () => {
    const patches = buildSessionPatchesFromDailyAdjustment(conservativeAdjustment);
    const text = visiblePatchText(patches);

    expect(patches.map((patch) => patch.type)).toEqual(['reduce_support', 'extend_rest']);
    expect(text).toMatch(/[\u4e00-\u9fa5]/);
    expect(text).not.toMatch(/\b(undefined|null|reduce_support|extend_rest|low|medium|high)\b/);
  });

  it('applies reduce_support only to the current session', () => {
    const source = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 3, 0)]));
    const patch = buildSessionPatchesFromDailyAdjustment(conservativeAdjustment)[0];
    const result = applySessionPatches(source, [patch]);

    expect(result.session).not.toBe(source);
    expect(result.session.supportExerciseLogs?.every((log) => log.skippedReason === 'too_tired')).toBe(true);
    expect(source.supportExerciseLogs?.some((log) => log.skippedReason)).toBe(false);
    expect(result.session.appliedCoachActions?.[0].id).toBe(patch.id);
    expect(result.session.adjustmentNotes?.join(' ')).toContain('减少辅助训练');
  });

  it('keeps main_only local and does not change the source template object', () => {
    const data = makeAppData();
    const templateBefore = JSON.stringify(data.templates);
    const session = createSession(
      getTemplate('push-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    const result = applySessionPatches(session, [
      {
        id: 'main-only',
        type: 'main_only',
        title: '只做主训练',
        description: '本次只保留主训练。',
        reason: '时间有限，先保证主训练。',
        reversible: true,
      },
    ]);

    expect(JSON.stringify(data.templates)).toBe(templateBefore);
    expect(result.session.appliedCoachActions?.some((item) => item.id === 'main-only')).toBe(true);
    expect(result.session.supportExerciseLogs?.every((log) => log.skippedReason === 'too_tired')).toBe(true);
  });

  it('reverts a patched session from the stored snapshot', () => {
    const source = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 3, 0)]));
    const patch = buildSessionPatchesFromDailyAdjustment(conservativeAdjustment)[0];
    const patched = applySessionPatches(source, [patch]).session;
    const reverted = revertSessionPatches(patched, [patch.id]).session;

    expect(reverted.supportExerciseLogs).toEqual(source.supportExerciseLogs);
    expect(reverted.appliedCoachActions || []).toHaveLength(0);
    expect(reverted.adjustmentNotes || []).toHaveLength(0);
  });

  it('supports applying patches to a newly created session', () => {
    const data = makeAppData();
    const session = createSession(
      getTemplate('pull-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );
    const patches = buildSessionPatchesFromDailyAdjustment(conservativeAdjustment);
    const result = applySessionPatches(session, patches);

    expect(result.session.templateId).toBe('pull-a');
    expect(result.session.appliedCoachActions?.length).toBe(patches.length);
    expect(result.session.adjustmentType).toBe('temporary_session_patch');
  });

  it('accepts substitute patches only for real session exercise ids', () => {
    const source = makeFocusSession([makeExercise('bench-press', 3, 0)]);
    const valid = applySessionPatches(source, [
      {
        id: 'substitute-bench',
        type: 'substitute_exercise',
        targetId: 'bench-press',
        title: '建议替代动作',
        description: '本次对卧推给出替代提醒。',
        reason: '肩部状态一般。',
        reversible: true,
      },
    ]);
    const invalid = applySessionPatches(source, [
      {
        id: 'substitute-synthetic',
        type: 'substitute_exercise',
        targetId: '__auto_alt',
        title: '建议替代动作',
        description: '本次对动作给出替代提醒。',
        reason: '测试非法目标。',
        reversible: true,
      },
    ]);

    expect(valid.session.exercises[0].replacementSuggested).toBe('建议替代动作');
    expect(valid.appliedPatches).toHaveLength(1);
    expect(invalid.appliedPatches).toHaveLength(0);
    expect(invalid.warnings.join(' ')).toContain('无效');
  });
});
