import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const misleadingInstructions = [
  /(^|\n)\s*(-\s*)?sync with API(\.|$)/i,
  /(^|\n)\s*(-\s*)?repair from API(\.|$)/i,
  /(^|\n)\s*(-\s*)?overwrite local data(\.|$)/i,
  /(^|\n)\s*(-\s*)?import from API(\.|$)/i,
  /(^|\n)\s*(-\s*)?reset from API(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable production backend(\.|$)/i,
];

describe('read-only diagnostics UX docs parity', () => {
  it('records Task 4.22 as read-only UX hardening without migration instructions', () => {
    const plan = readSource('docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md');
    const contract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');
    const combined = [plan, contract, refactorPlan, checklist].join('\n');

    expect(plan).toContain('Task 4.22 Diagnostics UX Hardening Result');
    expect(contract).toContain('Read-only Diagnostics UX Hardening');
    expect(refactorPlan).toContain('Task 4.22: Read-only Diagnostics UX Hardening V1');
    expect(checklist).toContain('Task 4.22 hardens read-only diagnostics UX');

    expect(combined).toContain('diagnostics read-only');
    expect(combined).toContain('No data was changed');
    expect(combined).toContain('localStorage remains source of truth');
    expect(combined).toContain('write-path migration remains blocked');
    misleadingInstructions.forEach((pattern) => expect(combined).not.toMatch(pattern));
  });
});
