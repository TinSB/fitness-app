import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildDataHealthClaritySummary } from '../src/engines/dataHealthClaritySummary';
import { DataHealthClarityPanel } from '../src/uiOs/dataHealth/DataHealthClarityPanel';

describe('Data Health clarity UI panel', () => {
  it('renders overall status owner-friendly issue cards and safe next action', () => {
    const summary = buildDataHealthClaritySummary({
      issues: [{
        id: 'schema-validation-failed',
        title: 'Schema validation failed',
        userMessage: '数据结构验证失败。',
        severityLabel: '需要处理',
      }],
    });
    const html = renderToStaticMarkup(React.createElement(DataHealthClarityPanel, { summary }));

    expect(html).toContain('Data Health clarity');
    expect(html).toContain('先暂停高风险操作');
    expect(html).toContain('数据结构验证失败');
    expect(html).toContain('为什么重要');
    expect(html).toContain('安全下一步：检查数据结构');
    expect(html).toContain('云端候选已暂停');
  });

  it('does not render automatic repair action repair route full AppData or secrets', () => {
    const summary = buildDataHealthClaritySummary({
      issues: [{
        id: 'backup-missing',
        title: '缺少备份',
        userMessage: '没有可确认的备份。',
        technicalDetails: 'service_role_key should not be displayed in UI tests',
      }],
    });
    const html = renderToStaticMarkup(React.createElement(DataHealthClarityPanel, { summary }));

    expect(html).toContain('不提供自动修复');
    expect(html).not.toContain('自动修复按钮');
    expect(html).not.toContain('/data-health/repair/apply');
    expect(html).not.toContain('full AppData');
    expect(html).not.toContain('service_role_key');
  });

  it('renders healthy local training copy', () => {
    const summary = buildDataHealthClaritySummary({ issues: [] });
    const html = renderToStaticMarkup(React.createElement(DataHealthClarityPanel, { summary }));

    expect(html).toContain('数据健康正常');
    expect(html).toContain('没有发现明显异常');
    expect(html).toContain('本地训练记录可以继续');
  });
});
