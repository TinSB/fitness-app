import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobilePwaPersonalUsePanel } from '../src/personalProduction/MobilePwaPersonalUsePanel';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('MobilePwaPersonalUsePanel', () => {
  it('renders default local-first mobile PWA guidance', () => {
    const markup = renderToStaticMarkup(createElement(MobilePwaPersonalUsePanel));

    expect(markup).toContain('手机 / PWA 个人使用提示');
    expect(markup).toContain('手机训练使用就绪');
    expect(markup).toContain('PWA 安装提示');
    expect(markup).toContain('本地优先可用');
    expect(markup).toContain('避免误用云端候选');
    expect(markup).toContain('data-mobile-pwa-panel="presentational"');
  });

  it('renders source-of-truth warning when requested', () => {
    const markup = renderToStaticMarkup(createElement(MobilePwaPersonalUsePanel, {
      states: ['mobile_source_of_truth_unclear'],
    }));

    expect(markup).toContain('手机当前数据来源不清楚');
    expect(markup).toContain('回到本地优先或紧急本地模式');
  });

  it('returns no markup when hidden', () => {
    expect(renderToStaticMarkup(createElement(MobilePwaPersonalUsePanel, {
      visible: false,
    }))).toBe('');
  });

  it('does not include runtime sync push storage network or route behavior', () => {
    const source = readSource('src/personalProduction/MobilePwaPersonalUsePanel.tsx');

    for (const forbidden of [
      'navigator.serviceWorker',
      'PushManager',
      'Notification',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase',
      'window.localStorage',
      '.localStorage',
      'sessionStorage',
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
