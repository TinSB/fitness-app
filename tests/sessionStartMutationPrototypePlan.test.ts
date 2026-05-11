import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const doc = () => readFileSync(resolve(root, 'docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md'), 'utf8');

describe('session start mutation prototype plan', () => {
  it('contains all required planning sections', () => {
    const text = doc();

    [
      '## Scope / Non-goals',
      '## Future Route',
      '## Proposed Opt-in Gates',
      '## Accepted Request Payload Shape',
      '## Source Snapshot / Fingerprint Contract',
      '## Target Identity',
      '## Confirmation UX',
      '## Duplicate Start Prevention',
      '## Strict No-fake-success Contract',
      '## Recovery Behavior',
      '## Manual Acceptance Plan',
      '## Route Boundary',
      '## Required Gates Before Task 4.60',
      '## Decision Record',
      '## Final Recommendation',
    ].forEach((section) => expect(text).toContain(section));
  });

  it('defines the future route and request payload metadata without implementing it', () => {
    const text = doc();

    expect(text).toContain('`POST /sessions/start`');
    expect(text).toContain('"templateId": "string"');
    expect(text).toContain('"sourceSnapshotHash": "string"');
    expect(text).toContain('"sourceSnapshotVersion": "phase4-active-session-v1"');
    expect(text).toContain('"mutationId": "string"');
    expect(text).toContain('"idempotencyKey": "string"');
    expect(text).toContain('"requestFingerprint": "string"');
    expect(text).toContain('"confirmed": true');
    expect(text).toContain('This task does not implement `POST /sessions/start`');
  });

  it('locks confirmation, duplicate prevention, no-fake-success, and recovery requirements', () => {
    const text = doc();

    expect(text).toContain('explicit confirmation');
    expect(text).toContain('Cancel prevents POST');
    expect(text).toContain('repeated click sends one request');
    expect(text).toContain('no automatic retry');
    expect(text).toContain('Success requires all of:');
    expect(text).toContain('HTTP 2xx');
    expect(text).toContain('`result.ok === true`');
    expect(text).toContain('`result.changed === true`');
    expect(text).toContain('`result.status === "success"`');
    expect(text).toContain('snapshot metadata exists');
    expect(text).toContain('Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`');
  });

  it('keeps active patch, complete, discard, and source-of-truth migration blocked', () => {
    const text = doc();

    expect(text).toContain('`POST /sessions/active/patches`');
    expect(text).toContain('`POST /sessions/active/complete`');
    expect(text).toContain('`POST /sessions/active/discard`');
    expect(text).toContain('source-of-truth migration');
    expect(text).toContain('localStorage remains source of truth');
    expect(text).toContain('API results never overwrite AppData or localStorage');
  });
});
