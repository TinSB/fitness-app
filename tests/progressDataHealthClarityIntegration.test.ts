import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Progress and Data Health clarity integration', () => {
  const recordSource = read('src/features/RecordView.tsx');
  const progressHero = read('src/uiOs/progress/ProgressInsightHero.tsx');
  const dataHealthPanel = read('src/uiOs/dataHealth/DataHealthClarityPanel.tsx');

  it('wires Progress around clarity hero pressure cards strength trends and effective-set explanations', () => {
    for (const expected of [
      'buildProgressClaritySummary',
      'ProgressInsightHero',
      'ReadinessPressureCard',
      'StrengthTrendCards',
      'EffectiveSetsVolumeCard',
      'progressClarity',
    ]) {
      expect(recordSource).toContain(expected);
    }
    expect(progressHero).toContain('训练状态解读');
    expect(progressHero).toContain('下次建议');
  });

  it('wires Data Health around owner-friendly clarity and filters repair actions', () => {
    expect(recordSource).toContain('buildDataHealthClaritySummary');
    expect(recordSource).toContain('DataHealthClarityPanel');
    expect(recordSource).toContain('!isRepairDataHealthAction');
    expect(dataHealthPanel).toContain('Data Health clarity');
    expect(dataHealthPanel).toContain('不提供自动修复');
  });

  it('keeps existing detailed data access but does not show repair apply route', () => {
    expect(recordSource).toContain('标记测试');
    expect(recordSource).toContain('恢复正常');
    expect(recordSource).toContain('删除');
    expect(recordSource).not.toContain('/data-health/repair/apply');
  });
});
