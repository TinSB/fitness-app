import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CloudCandidateSettingsPanel } from '../src/uiOs/settings/CloudCandidateSettingsPanel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('CloudCandidateSettingsPanel', () => {
  it('renders manual candidate copy without casual sync controls', () => {
    const visible = text(
      renderToStaticMarkup(
        <CloudCandidateSettingsPanel copy="云端候选是 manual candidate only。云端候选不会自动同步；Cloud pull 不会自动覆盖本地数据；Cloud push 需要手动确认。" />,
      ),
    );

    expect(visible).toContain('Cloud Candidate');
    expect(visible).toContain('manual candidate only');
    expect(visible).toContain('云端候选不会自动同步');
    expect(visible).toContain('Cloud pull');
    expect(visible).toContain('Cloud push');
    expect(visible).toContain('需要手动确认');
    expect(visible).toContain('不提供 casual sync 按钮');
    expect(visible).not.toContain('同步全部');
    expect(visible).not.toContain('云端默认');
  });
});
