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
            diagnosticsCopy="诊断摘要不会上传完整训练数据；只显示脱敏摘要。"
          dataHealthSummary={summary}
        />,
      ),
    );

    expect(visible).toContain('诊断');
    expect(visible).toContain('诊断与数据安全');
    expect(visible).toContain('脱敏摘要');
    expect(visible).toContain('已脱敏');
    expect(visible).not.toContain('POST /data-health/repair/apply');
    expect(visible).not.toContain('full AppData');
  });
});
