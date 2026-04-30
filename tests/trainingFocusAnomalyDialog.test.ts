import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from '../src/ui/ConfirmDialog';

describe('training focus anomaly confirmation dialog', () => {
  it('renders non-empty cancel and confirm buttons for set anomalies', () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        title: '确认保存这组？',
        description: createElement('div', null, '系统检测到重量、次数或 RIR 可能异常，请确认不是输入错误。'),
        cancelText: '返回修改',
        confirmText: '仍然保存',
        variant: 'warning',
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    );

    expect(html).toContain('返回修改');
    expect(html).toContain('仍然保存');
    expect(html).toContain('aria-label="返回修改"');
    expect(html).toContain('aria-label="仍然保存"');
  });

  it('falls back to visible labels when confirm or cancel text is blank', () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        title: '确认保存这组？',
        description: '请确认不是输入错误。',
        cancelText: '',
        confirmText: '',
        variant: 'warning',
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    );

    expect(html).toContain('返回修改');
    expect(html).toContain('仍然保存');
    expect(html).not.toContain('aria-label=""');
    expect(html).not.toMatch(/\b(undefined|null|warning|critical)\b/);
  });

  it('wires the Focus Mode anomaly dialog to continue or cancel the save', () => {
    const source = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

    expect(source).toContain("confirmText={isSetAnomaly ? '仍然保存' : '确认跳过'}");
    expect(source).toContain("cancelText={isSetAnomaly ? '返回修改' : '返回'}");
    expect(source).toContain('onConfirm={confirmPendingAction}');
    expect(source).toContain('onCancel={cancelPendingAction}');
  });
});
