import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Today recommendation explanation', () => {
  const source = readFileSync('src/features/TodayView.tsx', 'utf8');
  const panelSource = readFileSync('src/ui/RecommendationExplanationPanel.tsx', 'utf8');

  it('uses the current recommendation trace for not-started and in-progress states', () => {
    expect(source).toContain("todayTrainingState.status === 'in_progress'");
    expect(source).toContain('explanationTemplate');
    expect(source).toContain('selectedTemplate');
  });

  it('uses the next suggestion trace after completion', () => {
    expect(source).toContain("todayTrainingState.status === 'completed'");
    expect(source).toContain('suggestedTemplate');
    expect(source).toContain('为什么这样建议下次训练？');
    expect(source).not.toContain('为什么这样建议今日训练？');
  });

  it('keeps the trace-missing fallback lightweight', () => {
    expect(panelSource).toContain('当前推荐主要来自默认模板，继续记录后会更精准。');
  });
});
