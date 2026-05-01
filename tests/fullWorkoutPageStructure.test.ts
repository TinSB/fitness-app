import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('full workout page structure', () => {
  const source = readFileSync('src/features/TrainingView.tsx', 'utf8');
  const appSource = readFileSync('src/App.tsx', 'utf8');

  it('renders the full workout review and editing shell', () => {
    expect(source).toContain('本次训练进度');
    expect(source).toContain('完整动作列表');
    expect(source).toContain('训练备注');
    expect(source).toContain('WorkoutActionBar');
  });

  it('shows exercise status and completed set summaries', () => {
    expect(source).toContain('not_started');
    expect(source).toContain('in_progress');
    expect(source).toContain('completed');
    expect(source).toContain('skipped');
    expect(source).toContain('已完成组');
  });

  it('keeps focus mode and unfinished-finish confirmation reachable', () => {
    expect(source).toContain('返回极简模式');
    expect(source).toContain('onFinish');
    expect(appSource).toContain('仍有未完成动作，是否结束训练？');
    expect(appSource).toContain('结束并保存');
  });
});
