import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getVisibleHealthImportWarnings, HealthDataImportErrorState } from '../src/features/HealthDataPanel';

describe('HealthDataPanel stability UI', () => {
  it('renders the health import error fallback with recovery actions', () => {
    const html = renderToStaticMarkup(
      React.createElement(HealthDataImportErrorState, {
        onRetry: () => undefined,
        onClear: () => undefined,
      }),
    );

    expect(html).toContain('健康数据导入失败');
    expect(html).toContain('文件可能过大或格式不受支持');
    expect(html).toContain('重新选择文件');
    expect(html).toContain('清除导入状态');
  });

  it('keeps loading, cancellation, and retry states in the panel source', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/HealthDataPanel.tsx'), 'utf8');

    expect(source).toContain('<ErrorBoundary');
    expect(source).toContain('正在解析 Apple Health XML');
    expect(source).toContain('取消导入');
    expect(source).toContain('onRetry={retryImport}');
    expect(source).toContain('onClear={clearImportState}');
  });

  it('truncates visible import warnings and reports the hidden count', () => {
    const warnings = Array.from({ length: 25 }, (_, index) => `警告 ${index + 1}`);
    const result = getVisibleHealthImportWarnings(warnings);

    expect(result.visibleWarnings).toHaveLength(20);
    expect(result.hiddenWarningCount).toBe(5);
  });
});
