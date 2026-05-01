import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('finish session entry guard', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const trainingViewSource = readFileSync('src/features/TrainingView.tsx', 'utf8');
  const focusViewSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

  it('keeps all component finish actions routed through App.finishSession', () => {
    expect(trainingViewSource).not.toContain('completeTrainingSessionIntoHistory');
    expect(focusViewSource).not.toContain('completeTrainingSessionIntoHistory');
    expect(trainingViewSource).toContain('onFinish');
    expect(focusViewSource).toContain('onFinish');
    expect(appSource).toContain('const finishSession');
    expect(appSource).toContain('completeTrainingSessionIntoHistory');
  });

  it('requires confirmation before saving a session with unfinished main work', () => {
    expect(appSource).toContain('buildIncompleteMainWorkGuard');
    expect(appSource).toContain('仍有未完成动作，是否结束训练？');
    expect(appSource).toContain('未完成动作会保留在历史详情中，但不会计入有效组、总量、PR 或 e1RM。');
    expect(appSource).toContain('结束并保存');
    expect(appSource).toContain('继续训练');
    expect(appSource).toContain('if (!confirmed) return;');
  });
});
