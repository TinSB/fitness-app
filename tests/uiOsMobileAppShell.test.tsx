import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Flame } from 'lucide-react';
import { BottomNav } from '../src/uiOs/BottomNav';
import { LocalFirstSafetyStrip } from '../src/uiOs/LocalFirstSafetyStrip';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { PageContainer } from '../src/uiOs/PageContainer';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));

describe('UI-OS MobileAppShell', () => {
  it('renders children inside the shell', () => {
    const html = renderToStaticMarkup(
      <MobileAppShell navItems={items} activeTab="today" onNavigate={() => undefined} trainTabId="train">
        <div>shell child content</div>
      </MobileAppShell>,
    );

    expect(html).toContain('shell child content');
    expect(html).toContain('#0a0a0b');
    expect(html).toContain('backdrop-blur');
  });

  it('renders PageContainer content and auxiliary layout wrapper', () => {
    const html = renderToStaticMarkup(
      <PageContainer auxiliary={<div>auxiliary</div>}>
        <div>page content</div>
      </PageContainer>,
    );

    expect(html).toContain('page content');
    expect(html).toContain('auxiliary');
    expect(html).toContain('max-w-[1600px]');
  });
});

describe('UI-OS BottomNav', () => {
  it('renders exactly five tabs with the required labels', () => {
    const html = renderToStaticMarkup(<BottomNav items={items} activeId="today" onNavigate={() => undefined} />);
    const text = visibleText(html);

    expect(items.map((item) => item.label)).toEqual(['今日', '训练', '历史', '进步', '设置']);
    for (const label of ['今日', '训练', '历史', '进步', '设置']) expect(text).toContain(label);
    expect((html.match(/<button/g) || []).length).toBe(5);
  });

  it('marks the active tab and calls navigation callback', () => {
    const onNavigate = vi.fn();
    const element = BottomNav({ items, activeId: 'history', onNavigate });
    const buttons = React.Children.toArray((element.props.children as React.ReactElement).props.children) as React.ReactElement[];
    const historyButton = buttons[2];

    expect(historyButton.props['aria-current']).toBe('page');
    historyButton.props.onClick();
    expect(onNavigate).toHaveBeenCalledWith('history');
  });
});

describe('UI-OS LocalFirstSafetyStrip', () => {
  it('renders safe local-first copy only', () => {
    const html = renderToStaticMarkup(<LocalFirstSafetyStrip />);
    const text = visibleText(html);

    expect(text).toContain('当前使用本地数据');
    expect(text).toContain('云端候选不会自动同步');
    expect(text).toContain('本地训练记录仍可继续');
    expect(text).not.toContain('自动同步已启用');
    expect(text).not.toContain('后台同步');
    expect(text).not.toContain('已上传成功');
  });
});
