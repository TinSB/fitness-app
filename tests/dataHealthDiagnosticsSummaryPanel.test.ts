import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataHealthDiagnosticsSummaryPanel } from '../src/personalProduction/DataHealthDiagnosticsSummaryPanel';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('DataHealthDiagnosticsSummaryPanel', () => {
  it('renders owner-friendly diagnostic summary and redaction reminder', () => {
    const markup = renderToStaticMarkup(createElement(DataHealthDiagnosticsSummaryPanel, {
      category: 'owner_review_required',
      cloudCandidateEnabled: true,
    }));

    expect(markup).toContain('数据健康 / 诊断摘要');
    expect(markup).toContain('需要检查数据归属');
    expect(markup).toContain('安全下一步：inspect_owner_scope');
    expect(markup).toContain('修复操作允许：否');
    expect(markup).toContain('隐藏敏感凭证和完整 AppData');
    expect(markup).toContain('pause_cloud_candidate');
  });

  it('renders emergency local and repair blocked states', () => {
    const emergency = renderToStaticMarkup(createElement(DataHealthDiagnosticsSummaryPanel, {
      category: 'emergency_local_recommended',
    }));
    const repair = renderToStaticMarkup(createElement(DataHealthDiagnosticsSummaryPanel, {
      category: 'repair_blocked',
    }));

    expect(emergency).toContain('建议使用紧急本地模式');
    expect(emergency).toContain('use_emergency_local_mode');
    expect(repair).toContain('自动修复被阻止');
    expect(repair).toContain('do_not_repair_apply');
  });

  it('returns no markup when hidden', () => {
    expect(renderToStaticMarkup(createElement(DataHealthDiagnosticsSummaryPanel, {
      visible: false,
      category: 'no_issue',
    }))).toBe('');
  });

  it('does not import unsafe modules access storage call routes or trigger callbacks', () => {
    const source = readSource('src/personalProduction/DataHealthDiagnosticsSummaryPanel.tsx');

    for (const forbidden of [
      'node:',
      '@supabase',
      'localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '/data-health/repair/apply',
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
