import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const misleadingInstructions = [
  /(^|\n)\s*(-\s*)?replace localStorage(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable mutation integration(\.|$)/i,
  /(^|\n)\s*(-\s*)?connect write routes(\.|$)/i,
  /(^|\n)\s*(-\s*)?deploy production backend(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable auth(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable sync(\.|$)/i,
];

describe('read-only runtime docs parity', () => {
  it('records Task 4.21 acceptance while keeping write-path migration blocked', () => {
    const plan = readSource('docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md');
    const contract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');
    const combined = [plan, contract, refactorPlan, checklist].join('\n');

    expect(plan).toContain('Task 4.21 Acceptance Result');
    expect(contract).toContain('Read-only Runtime Parity Acceptance');
    expect(refactorPlan).toContain('Task 4.21: Read-only Runtime Parity Acceptance V1');
    expect(checklist).toContain('read-only runtime parity accepted only for dev diagnostics');

    expect(combined).toContain('localStorage remains source of truth');
    expect(combined).toContain('API results never overwrite localStorage');
    expect(combined).toContain('no UI writes to API');
    expect(combined).toContain('no mutation route used by App');
    expect(combined).toContain('API unavailable fallback');
    expect(combined).toContain('write-path migration remains blocked');
    misleadingInstructions.forEach((pattern) => expect(combined).not.toMatch(pattern));
  });
});
