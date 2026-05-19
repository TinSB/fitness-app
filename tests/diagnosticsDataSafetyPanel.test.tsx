import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildDataHealthClaritySummary } from '../src/engines/dataHealthClaritySummary';
import { DiagnosticsDataSafetyPanel } from '../src/uiOs/settings/DiagnosticsDataSafetyPanel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('DiagnosticsDataSafetyPanel', () => {
  it('renders redacted diagnostics data health and no automatic repair', () => {
    const summary = buildDataHealthClaritySummary({
      issues: [{ id: 'schema_validation_failed', title: 'Schema validation', userMessage: 'schema validation issue' }],
    });
    const visible = text(
      renderToStaticMarkup(
        <DiagnosticsDataSafetyPanel
          diagnosticsCopy="诊断摘要不会上传完整训练数据；只显示 redacted summary。"
          dataHealthSummary={summary}
        />,
      ),
    );

    expect(visible).toContain('Diagnostics / Data Health');
    expect(visible).toContain('诊断与数据安全');
    expect(visible).toContain('redacted');
    expect(visible).toContain('不会上传完整训练数据');
    expect(visible).toContain('不提供自动修复');
    expect(visible).toContain('修复应用接口仍然不可用');
    expect(visible).not.toContain('POST /data-health/repair/apply');
    expect(visible).not.toContain('full AppData');
  });
});
