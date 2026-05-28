import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');
const readDoc = (relative: string): string => readFileSync(resolve(repoRoot, relative), 'utf8');

const PLANNING_DOC = 'docs/DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md';
const TASKS_DOC = 'docs/DATA_INTEGRITY_REMEDIATION_TASKS_V1.md';

describe('dataIntegrityRemediationPlanningDocsParity', () => {
  it('dataIntegrityRemediationPlanningDocsExist', () => {
    expect(() => readDoc(PLANNING_DOC)).not.toThrow();
    expect(() => readDoc(TASKS_DOC)).not.toThrow();
  });

  it('dataIntegrityRemediationPlanningDocsArePlanningOnly', () => {
    const planning = readDoc(PLANNING_DOC);
    expect(planning).toMatch(/planning-only/i);
    expect(planning).toMatch(/no code under `src\/` is modified/i);
  });

  it('dataIntegrityRemediationPlanningDocsForbidIdentityAutoRewriteWithoutCurated', () => {
    const planning = readDoc(PLANNING_DOC);
    expect(planning.toLowerCase()).toContain('curated remap');
    expect(planning).toMatch(/runtime canonicalize only/i);
    expect(planning).toMatch(/no destructive identity rewrite/i);
  });

  it('dataIntegrityRemediationPlanningDocsForbidSetIdRewriteBeforeConsumerAudit', () => {
    const planning = readDoc(PLANNING_DOC);
    expect(planning.toLowerCase()).toContain('do not rewrite');
    expect(planning).toMatch(/derive new uniqueness on demand/i);
    expect(planning).toMatch(/stableSetUid/);
  });

  it('dataIntegrityRemediationPlanningDocsKeepCompletionQualityDerivedInV1', () => {
    const planning = readDoc(PLANNING_DOC);
    expect(planning).toMatch(/derived only/i);
    expect(planning).toMatch(/V1: derived only/);
    expect(planning).toMatch(/V2 \(separate gated PR\)/i);
    expect(planning).toMatch(/schema bump/i);
  });

  it('dataIntegrityRemediationPlanningDocsListFiveFutureTasks', () => {
    const tasks = readDoc(TASKS_DOC);
    expect(tasks).toContain('Task 1 — Partial Completion Quality V1');
    expect(tasks).toContain('Task 2 — Replacement Equivalence Curated Remap V1');
    expect(tasks).toContain('Task 3 — Duplicate Set ID Consumer Audit V1');
    expect(tasks).toContain('Task 4 — Optional: Stable Set UID V1');
    expect(tasks).toContain('Task 5 — Optional: Exercise Identity Migration V1');
  });

  it('dataIntegrityRemediationPlanningDocsCiteDataRepairPolicy', () => {
    const planning = readDoc(PLANNING_DOC);
    const tasks = readDoc(TASKS_DOC);
    expect(planning).toContain('DATA_REPAIR_POLICY.md');
    expect(tasks).toContain('DATA_REPAIR_POLICY.md');
  });

  it('dataIntegrityRemediationPlanningDocsRequireApprovalGateForSchemaBumpAndPersistedRewrite', () => {
    const tasks = readDoc(TASKS_DOC);
    expect(tasks).toMatch(/schema bump/i);
    expect(tasks).toMatch(/V3\+/);
    expect(tasks).toMatch(/Approval gate/i);
    expect(tasks).toMatch(/content owner has co-signed/i);
  });

  it('dataIntegrityRemediationPlanningDocsDoNotMutateAppData', () => {
    const planning = readDoc(PLANNING_DOC);
    expect(planning).toMatch(/no AppData mutation/i);
    expect(planning).toMatch(/runtime guard/i);
    expect(planning).toMatch(/no `appDataHash` change/i);
  });

  it('dataIntegrityRemediationPlanningDocsForbidAdminMergeBypass', () => {
    const tasks = readDoc(TASKS_DOC);
    expect(tasks).toMatch(/No `--admin` merge/);
    expect(tasks).toMatch(/No `--no-verify`/);
    expect(tasks).toMatch(/No branch-protection bypass/);
  });
});
