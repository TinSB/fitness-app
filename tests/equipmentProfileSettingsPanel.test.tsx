import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EquipmentProfileSettingsPanel } from '../src/uiOs/settings/EquipmentProfileSettingsPanel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('EquipmentProfileSettingsPanel', () => {
  it('renders required equipment profile examples and draft-only copy', () => {
    const visible = text(
      renderToStaticMarkup(
        <EquipmentProfileSettingsPanel copy="器械档案只影响显示和推荐解释，不会自动改写历史记录。" />,
      ),
    );

    expect(visible).toContain('Equipment Profiles');
    expect(visible).toContain('Olympic barbell');
    expect(visible).toContain('45 lb');
    expect(visible).toContain('Smith machine');
    expect(visible).toContain('25 lb');
    expect(visible).toContain('Dumbbell');
    expect(visible).toContain('每只手 / 5 lb 一跳');
    expect(visible).toContain('Selectorized machine');
    expect(visible).toContain('按机器插片');
    expect(visible).toContain('Plate-loaded');
    expect(visible).toContain('注意器械自重');
    expect(visible).toContain('草稿');
    expect(visible).toContain('查看器械档案草稿编辑器');
  });
});
