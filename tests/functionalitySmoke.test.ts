import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('functionality smoke wiring', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const focusSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

  it('keeps session creation, completion, and history write wired in App', () => {
    expect(appSource).toContain('createSession(');
    expect(appSource).toContain('completeTrainingSessionIntoHistory');
    expect(appSource).toContain("setActiveTab('record')");
  });

  it('keeps workout execution actions wired through the state machine', () => {
    expect(appSource).toContain('dispatchWorkoutExecutionEvent');
    expect(appSource).toContain("type: 'COMPLETE_STEP'");
    expect(appSource).toContain("type: 'APPLY_REPLACEMENT'");
  });

  it('keeps focus-mode critical user actions reachable', () => {
    expect(focusSource).toContain('completeCurrentSet');
    expect(focusSource).toContain('copyPrevious');
    expect(focusSource).toContain('markPain(!painMarked)');
    expect(focusSource).toContain('markPain');
    expect(focusSource).toContain('chooseReplacement');
  });
});
