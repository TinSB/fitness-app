import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmergencyLocalSettingsPanel } from '../src/uiOs/settings/EmergencyLocalSettingsPanel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('EmergencyLocalSettingsPanel', () => {
  it('renders emergency local availability and local training copy', () => {
    const visible = text(renderToStaticMarkup(<EmergencyLocalSettingsPanel copy="紧急本地模式可用；本地训练记录仍可继续。" />));

    expect(visible).toContain('Emergency Local Mode');
    expect(visible).toContain('紧急本地模式');
    expect(visible).toContain('本地训练记录仍可继续');
    expect(visible).toContain('没有 cloud operation implied');
  });
});
