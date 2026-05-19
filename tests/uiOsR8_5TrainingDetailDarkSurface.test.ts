import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Drawer } from '../src/ui/Drawer';
import { ActionButton } from '../src/ui/ActionButton';
import { ListItem } from '../src/ui/ListItem';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('UI-OS R8.5 Training Detail dark surface', () => {
  it('renders training detail drawer root and body as semantic dark surfaces', () => {
    const html = renderToStaticMarkup(
      React.createElement(Drawer, { open: true, title: '训练详情', onClose: () => undefined }, React.createElement(ListItem, { title: '备注', description: '动作记录' })),
    );

    expect(html).toContain('data-theme-surface="modal_surface"');
    expect(html).toContain('data-training-detail-surface="dark"');
    expect(html).toContain('bg-[#0a0a0b]');
    expect(html).not.toMatch(/\bbg-white(?:\s|["'`])/);
    expect(html).toContain('[&amp;_.border-slate-200]:border-white/10');
  });

  it('uses dark semantic row and action surfaces for details and danger actions', () => {
    const rowHtml = renderToStaticMarkup(React.createElement(ListItem, { title: '修正记录', description: '功能补丁' }));
    const dangerHtml = renderToStaticMarkup(React.createElement(ActionButton, { variant: 'danger' }, '删除记录'));

    expect(rowHtml).toContain('data-theme-surface="compact_row"');
    expect(rowHtml).toContain('bg-white/[0.05]');
    expect(dangerHtml).toContain('bg-rose-400/10');
    expect(dangerHtml).not.toMatch(/\bbg-white(?:\s|["'`])/);
  });

  it('keeps RecordView detail flows reachable through the dark drawer owner', () => {
    const recordSource = read('src/features/RecordView.tsx');
    const drawerSource = read('src/ui/Drawer.tsx');

    expect(recordSource).toContain("from '../ui/Drawer'");
    expect(recordSource).toContain('训练详情');
    expect(recordSource).toContain('修正记录');
    expect(recordSource).toContain('删除记录');
    expect(drawerSource).toContain('data-training-detail-surface="dark"');
  });
});
