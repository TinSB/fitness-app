import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { focusFeedbackFromActionResult } from '../src/features/TrainingFocusView';
import type { FocusActionResult } from '../src/engines/workoutExecutionStateMachine';
import { Toast } from '../src/ui/Toast';

const visibleText = (result: FocusActionResult) => {
  const feedback = focusFeedbackFromActionResult(result);
  return renderToStaticMarkup(React.createElement(Toast, { tone: feedback.tone }, feedback.message));
};

describe('Focus feedback state contract', () => {
  it('does not render success styling or success wording for changed=false duplicate feedback', () => {
    const result: FocusActionResult = {
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前组未重复记录。',
      reasonCode: 'duplicate_submit',
    };
    const feedback = focusFeedbackFromActionResult(result);
    const html = visibleText(result);

    expect(feedback).toEqual({
      message: '当前组未重复记录。',
      tone: 'info',
    });
    expect(html).toContain('当前组未重复记录。');
    expect(html).toContain('border-sky-200');
    expect(html).not.toContain('border-emerald-200');
    expect(html).not.toMatch(/已完成|已复制|已套用|已标记|已替换/);
    expect(html).not.toMatch(/undefined|null|duplicate_submit|__auto_alt|__alt_/);
  });

  it('maps error tone to the existing danger Toast style without leaking raw enum text', () => {
    const result: FocusActionResult = {
      ok: false,
      changed: false,
      tone: 'error',
      message: '该替代动作暂不可用。',
      reasonCode: 'invalid_replacement',
    };
    const feedback = focusFeedbackFromActionResult(result);
    const html = visibleText(result);

    expect(feedback).toEqual({
      message: '该替代动作暂不可用。',
      tone: 'danger',
    });
    expect(html).toContain('该替代动作暂不可用。');
    expect(html).toContain('border-rose-200');
    expect(html).not.toMatch(/invalid_replacement|undefined|null|__auto_alt|__alt_/);
  });
});
