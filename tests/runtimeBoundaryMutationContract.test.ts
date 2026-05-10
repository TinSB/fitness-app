import { describe, expect, it } from 'vitest';
import {
  handleReadMirrorRequest,
  handleRecordDataHealthMutationRequest,
  handleSessionMutationRequest,
} from '../apps/api/src';
import type {
  RecordDataHealthMutationResponse,
  SessionMutationResponse,
} from '../packages/contracts/src';
import { buildPendingSessionPatch, type SessionPatch } from '../src/engines/sessionPatchEngine';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { makeRecordData, makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { expectSourceNotToContain, repoRoot } from './runtimeBoundaryTestHelpers';
import { resolve } from 'node:path';

const NOW = '2026-05-09T12:00:00.000Z';

const patch: SessionPatch = {
  id: 'runtime-boundary-patch',
  type: 'main_only',
  title: 'runtime boundary patch',
  description: 'runtime boundary patch',
  reason: 'runtime boundary patch',
  reversible: true,
};

const expectNextDataRule = (response: SessionMutationResponse | RecordDataHealthMutationResponse) => {
  if (response.result.ok === true && response.result.changed === true) {
    expect(response.nextData).toBeDefined();
  } else {
    expect(response.nextData).toBeUndefined();
  }
};

describe('runtime boundary mutation contract acceptance', () => {
  it('keeps readMirror read-only and input AppData unchanged', () => {
    const data = makeAppData();
    const before = JSON.stringify(data);
    const responses = [
      handleReadMirrorRequest(data, { method: 'GET', path: '/app-data/summary' }),
      handleReadMirrorRequest(data, { method: 'POST', path: '/sessions/start' }),
      handleReadMirrorRequest(data, { method: 'DELETE', path: '/history/missing' }),
    ];

    expect(JSON.stringify(data)).toBe(before);
    expect(responses.map((response) => response.status)).toEqual([200, 405, 405]);
  });

  it('enforces nextData only for changed session mutation success paths', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 1)]);
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: NOW,
      sourceFingerprint: 'runtime-boundary',
      targetTemplateId: 'pull-a',
    });

    const responses: SessionMutationResponse[] = [
      handleSessionMutationRequest(makeAppData({ selectedTemplateId: 'push-a' }), {
        method: 'POST',
        path: '/sessions/start',
        nowIso: NOW,
      }),
      handleSessionMutationRequest(makeAppData({ activeSession }), { method: 'POST', path: '/sessions/start', nowIso: NOW }),
      handleSessionMutationRequest(makeAppData(), { method: 'POST', path: '/sessions/active/complete', nowIso: NOW }),
      handleSessionMutationRequest(makeAppData({ activeSession }), {
        method: 'POST',
        path: '/sessions/active/complete',
        nowIso: NOW,
      }),
      handleSessionMutationRequest(makeAppData({ activeSession, pendingSessionPatches: [pending], settings: { pendingSessionPatches: [pending] } }), {
        method: 'POST',
        path: '/sessions/active/patches',
        body: { pendingPatchId: 'missing' },
        nowIso: NOW,
      }),
      handleSessionMutationRequest(makeAppData(), { method: 'DELETE', path: '/sessions/start' }),
    ];

    responses.forEach(expectNextDataRule);
    responses
      .filter((response) => !(response.result.ok === true && response.result.changed === true))
      .forEach((response) => expect(response.nextData).toBeUndefined());
  });

  it('enforces nextData only for changed Record/DataHealth mutation success paths', () => {
    const responses: RecordDataHealthMutationResponse[] = [
      handleRecordDataHealthMutationRequest(makeRecordData(), {
        method: 'POST',
        path: '/history/record-mutation-session/data-flag',
        body: { dataFlag: 'excluded' },
        nowIso: NOW,
      }),
      handleRecordDataHealthMutationRequest(makeRecordData(), {
        method: 'POST',
        path: '/history/record-mutation-session/data-flag',
        body: { dataFlag: 'normal' },
        nowIso: NOW,
      }),
      handleRecordDataHealthMutationRequest(makeRecordData(), { method: 'POST', path: '/history/missing/edit', body: {} }),
      handleRecordDataHealthMutationRequest(makeRepairableWeightData(), {
        method: 'POST',
        path: '/data-health/repair/apply',
        body: { repairType: 'legacy_display_weight' },
        nowIso: NOW,
      }),
      handleRecordDataHealthMutationRequest(makeRepairableWeightData(), {
        method: 'POST',
        path: '/data-health/repair/apply',
        body: { repairType: 'legacy_display_weight', confirmRepair: true, rawData: { source: 'health-json', samples: [] } },
        nowIso: NOW,
      }),
      handleRecordDataHealthMutationRequest(makeRecordData(), { method: 'DELETE', path: '/history/record-mutation-session/data-flag' }),
    ];

    responses.forEach(expectNextDataRule);
    responses
      .filter((response) => !(response.result.ok === true && response.result.changed === true))
      .forEach((response) => expect(response.nextData).toBeUndefined());
  });

  it('keeps mutation boundaries independent from persistence, localStorage and SQLite adapters', () => {
    [
      'apps/api/src/sessionMutation.ts',
      'apps/api/src/recordDataHealthMutation.ts',
    ].forEach((file) =>
      expectSourceNotToContain(resolve(repoRoot(), file), [
        'saveData',
        'loadData',
        'localStorageAdapter',
        'sqliteRepository',
        'node:sqlite',
      ]),
    );
  });
});
