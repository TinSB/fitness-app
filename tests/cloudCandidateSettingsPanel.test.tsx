import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CloudCandidateSettingsPanel } from '../src/uiOs/settings/CloudCandidateSettingsPanel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('CloudCandidateSettingsPanel', () => {
  it('renders manual candidate copy without casual sync controls', () => {
    const visible = text(
      renderToStaticMarkup(
        <CloudCandidateSettingsPanel copy="云端候选需要手动确认，不会自动覆盖本地数据；上传候选也需要再次确认。" />,
      ),
    );

    expect(visible).toContain('云端候选');
    expect(visible).toContain('手动候选');
    expect(visible).toContain('读取候选');
    expect(visible).toContain('上传候选');
    expect(visible).toContain('需要手动确认');
    expect(visible).toContain('一键同步');
    expect(visible).not.toContain('同步全部');
    expect(visible).not.toContain('云端默认');
  });
});
