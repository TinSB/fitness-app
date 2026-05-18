import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyTrainingStatusPanel } from '../src/personalProduction/DailyTrainingStatusPanel';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('DailyTrainingStatusPanel', () => {
  it('renders current state safe next action and supporting safety copy', () => {
    const markup = renderToStaticMarkup(createElement(DailyTrainingStatusPanel, {
      state: 'active_session_in_progress',
      backupRecommended: true,
      emergencyLocalAvailable: true,
      cloudCandidatePaused: true,
      recoveryActionRecommended: true,
    }));

    expect(markup).toContain('个人训练日常状态');
    expect(markup).toContain('训练正在进行');
    expect(markup).toContain('安全下一步：继续当前训练');
    expect(markup).toContain('建议先做手动备份');
    expect(markup).toContain('紧急本地模式可用');
    expect(markup).toContain('云端候选已暂停');
    expect(markup).toContain('建议执行恢复检查');
    expect(markup).toContain('data-daily-training-panel="presentational"');
  });

  it('renders source-of-truth and owner warnings when provided', () => {
    const markup = renderToStaticMarkup(createElement(DailyTrainingStatusPanel, {
      state: 'empty_history',
      sourceOfTruthClear: false,
      ownerActionRequired: true,
    }));

    expect(markup).toContain('本地历史为空');
    expect(markup).toContain('当前数据来源不清楚');
    expect(markup).toContain('需要 owner 手动处理');
    expect(markup).toContain('检查当前数据来源');
  });

  it('returns no markup when hidden', () => {
    expect(renderToStaticMarkup(createElement(DailyTrainingStatusPanel, {
      visible: false,
      state: 'local_first_ready',
    }))).toBe('');
  });

  it('does not import unsafe modules access storage or call network APIs', () => {
    const source = readSource('src/personalProduction/DailyTrainingStatusPanel.tsx');

    for (const forbidden of [
      'node:',
      '@supabase',
      'localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'useEffect',
      'onClick=',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
