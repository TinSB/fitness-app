import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSession } from '../src/engines/sessionBuilder';
import { applySessionPatches, type SessionPatch } from '../src/engines/sessionPatchEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { completeTrainingSessionIntoHistory } from '../src/engines/trainingCompletionEngine';
import { getTemplate, makeAppData } from './fixtures';

const temporaryPatch: SessionPatch = {
  id: 'session-patch-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '本次只保留主训练，不修改原模板。',
  reason: '今天可训练时间有限，优先完成主训练。',
  reversible: true,
};

const createBaseSession = () => {
  const data = makeAppData({ selectedTemplateId: 'push-a', activeProgramTemplateId: 'push-a' });
  return {
    data,
    session: createSession(
      getTemplate('push-a'),
      data.todayStatus,
      data.history,
      data.trainingMode,
      buildWeeklyPrescription(data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    ),
  };
};

describe('session patch startSession flow', () => {
  it('documents that App startSession consumes and clears pending patches', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(app).toContain('const patches = explicitPatches ?? pendingSessionPatches');
    expect(app).toContain('applySessionPatches(baseSession, patches)');
    expect(app).toContain('setPendingSessionPatches([])');
    expect(app).toContain('pendingSessionPatches={pendingSessionPatches}');
  });

  it('writes applied patches and adjustment notes into the active session only', () => {
    const { data, session } = createBaseSession();
    const originalProgramTemplate = JSON.stringify(data.programTemplate);
    const originalMesocyclePlan = JSON.stringify(data.mesocyclePlan);
    const originalTemplates = JSON.stringify(data.templates);

    const result = applySessionPatches(session, [temporaryPatch]);

    expect(result.session.appliedCoachActions?.[0]).toMatchObject({
      id: temporaryPatch.id,
      type: temporaryPatch.type,
      title: temporaryPatch.title,
    });
    expect(result.session.adjustmentNotes?.join(' ')).toContain('只做主训练');
    expect(result.session.adjustmentReasons?.join(' ')).toContain('优先完成主训练');
    expect(result.session.adjustmentType).toBeTruthy();
    expect(JSON.stringify(data.programTemplate)).toBe(originalProgramTemplate);
    expect(JSON.stringify(data.mesocyclePlan)).toBe(originalMesocyclePlan);
    expect(JSON.stringify(data.templates)).toBe(originalTemplates);
  });

  it('preserves applied patches when the active session is saved into history', () => {
    const { data, session } = createBaseSession();
    const patched = applySessionPatches(session, [temporaryPatch]).session;
    const completed = completeTrainingSessionIntoHistory({ ...data, activeSession: patched }, '2026-04-29T10:30:00.000Z');

    expect(completed.session?.appliedCoachActions?.[0].id).toBe(temporaryPatch.id);
    expect(completed.session?.adjustmentNotes?.join(' ')).toContain('只做主训练');
    expect(completed.data.history[0].appliedCoachActions?.[0].id).toBe(temporaryPatch.id);
  });

  it('does not automatically inherit temporary patches into the next session', () => {
    const { data, session } = createBaseSession();
    const patched = applySessionPatches(session, [temporaryPatch]).session;
    const completed = completeTrainingSessionIntoHistory({ ...data, activeSession: patched }, '2026-04-29T10:30:00.000Z');
    const nextSession = createSession(
      getTemplate('push-a'),
      data.todayStatus,
      completed.data.history,
      data.trainingMode,
      buildWeeklyPrescription(completed.data),
      undefined,
      data.screeningProfile,
      data.mesocyclePlan,
    );

    expect(nextSession.appliedCoachActions || []).toHaveLength(0);
    expect(nextSession.adjustmentNotes || []).toHaveLength(0);
    expect(nextSession.adjustmentType).toBeUndefined();
  });
});
