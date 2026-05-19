import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Flame } from 'lucide-react';
import { ActionButton } from '../src/uiOs/primitives/ActionButton';
import { GlassCard } from '../src/uiOs/primitives/GlassCard';
import { SegmentedControl } from '../src/uiOs/primitives/SegmentedControl';
import { StatusBadge, type UiOsBadgeState } from '../src/uiOs/primitives/StatusBadge';
import { BottomSheet } from '../src/uiOs/surfaces/BottomSheet';
import { FloatingBottomNav } from '../src/uiOs/navigation/FloatingBottomNav';
import { EquipmentAwareLoadCard } from '../src/uiOs/training/EquipmentAwareLoadCard';
import { SettingsGroupCard } from '../src/uiOs/settings/SettingsGroupCard';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));

describe('UI-OS R7 component state regression lock', () => {
  it('locks ActionButton disabled loading success danger and primary states', () => {
    const disabledClick = vi.fn();
    const disabled = ActionButton({ children: '不可用', disabled: true, onClick: disabledClick });
    disabled.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

    const loadingHtml = renderToStaticMarkup(React.createElement(ActionButton, { loading: true }, '保存中'));
    const primaryHtml = renderToStaticMarkup(React.createElement(ActionButton, { fullWidth: true }, '主操作'));
    const successHtml = renderToStaticMarkup(React.createElement(ActionButton, { variant: 'success' }, '已完成'));
    const dangerHtml = renderToStaticMarkup(React.createElement(ActionButton, { variant: 'danger' }, '危险操作'));

    expect(disabledClick).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(disabled)).toContain('disabled=""');
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('aria-label="loading"');
    expect(primaryHtml).toContain('bg-emerald-500');
    expect(primaryHtml).toContain('w-full');
    expect(successHtml).toContain('text-emerald-300');
    expect(dangerHtml).toContain('text-red-400');
  });

  it('locks StatusBadge states and keeps manual-required distinct from safe', () => {
    const states: UiOsBadgeState[] = ['safe', 'info', 'warning', 'danger', 'disabled', 'manual-required'];
    const html = states
      .map((state) => renderToStaticMarkup(React.createElement(StatusBadge, { state }, state)))
      .join('\n');

    expect(html).toContain('text-emerald-400');
    expect(html).toContain('text-blue-400');
    expect(html).toContain('text-amber-400');
    expect(html).toContain('text-red-400');
    expect(html).toContain('text-white/40');
    expect(html).toContain('text-orange-400');
    expect(renderToStaticMarkup(React.createElement(StatusBadge, { state: 'manual-required' }, '需要确认'))).not.toContain('text-emerald-400');
  });

  it('locks SegmentedControl selected and disabled behavior', () => {
    const onChange = vi.fn();
    const element = SegmentedControl({
      options: [
        { value: 'system', label: '系统' },
        { value: 'light', label: '浅色' },
        { value: 'dark', label: '深色', disabled: true },
      ],
      value: 'system',
      onChange,
      ariaLabel: '主题',
    });
    const buttons = React.Children.toArray(element.props.children) as React.ReactElement[];

    buttons[0].props.onClick();
    buttons[2].props.onClick();

    const html = renderToStaticMarkup(element);
    expect(onChange).toHaveBeenCalledWith('system');
    expect(onChange).not.toHaveBeenCalledWith('dark');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('disabled=""');
  });

  it('locks BottomSheet closed open confirm-required and danger states', () => {
    const onClose = vi.fn();
    const closedHtml = renderToStaticMarkup(
      React.createElement(BottomSheet, { isOpen: false, onClose, title: '关闭面板' }, 'hidden'),
    );
    const openElement = BottomSheet({
      isOpen: true,
      onClose,
      title: '危险确认',
      confirmRequired: true,
      tone: 'danger',
      children: React.createElement('p', null, '危险内容'),
    }) as React.ReactElement;
    const overlay = React.Children.toArray(openElement.props.children)[0] as React.ReactElement;
    overlay.props.onClick();
    const openHtml = renderToStaticMarkup(openElement);

    expect(closedHtml).toBe('');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openHtml).toContain('role="dialog"');
    expect(openHtml).toContain('data-bottom-sheet-tone="danger"');
    expect(openHtml).toContain('需要手动确认');
    expect(openHtml).toContain('text-red-300');
  });

  it('locks FloatingBottomNav five-tab active and active-session states', () => {
    const html = renderToStaticMarkup(
      React.createElement(FloatingBottomNav, { items, activeId: 'train', onNavigate: () => undefined, trainTabId: 'train', activeSession: true }),
    );

    expect((html.match(/<button/g) || []).length).toBe(5);
    expect((html.match(/data-active="true"/g) || []).length).toBe(1);
    expect(html).toContain('fixed bottom-0');
    expect(html).toContain('env(safe-area-inset-bottom)');
    expect(html).toContain('bg-emerald-400');
  });

  it('locks glass and grouped card material markers', () => {
    const glassHtml = renderToStaticMarkup(React.createElement(GlassCard, { highlight: true }, '训练卡片'));
    const settingsHtml = renderToStaticMarkup(React.createElement(SettingsGroupCard, null, '设置分组'));
    const darkSettingsHtml = renderToStaticMarkup(React.createElement(SettingsGroupCard, { tone: 'dark' }, '深色设置'));

    expect(glassHtml).toContain('backdrop-blur-xl');
    expect(glassHtml).toContain('ring-emerald-500/30');
    expect(glassHtml).toContain('rgba(44, 44, 46, 0.6)');
    expect(settingsHtml).toContain('bg-white/90');
    expect(darkSettingsHtml).toContain('backdrop-blur-xl');
  });

  it('locks equipment-aware load card display states', () => {
    const emptyBar = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'barbell', mainDisplay: '空杆 45 lb × 10', subInfo: '每边 0 lb' }));
    const onePlate = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'barbell', mainDisplay: '135 lb total', subInfo: '每边 45 lb' }));
    const dumbbell = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'dumbbell', mainDisplay: '每只手 45 lb', subInfo: 'per-hand' }));
    const stack = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'machine-stack', mainDisplay: '插片 45 lb', subInfo: 'machine stack' }));
    const plateLoaded = renderToStaticMarkup(
      React.createElement(EquipmentAwareLoadCard, { type: 'plate-loaded', mainDisplay: '90 lb added', state: 'warning', note: 'plate-loaded base/sled warning' }),
    );
    const combined = visibleText([emptyBar, onePlate, dumbbell, stack, plateLoaded].join('\n'));

    expect(combined).toContain('空杆 45 lb × 10');
    expect(combined).toContain('135 lb total');
    expect(combined).toContain('每边 45 lb');
    expect(combined).toContain('每只手 45 lb');
    expect(combined).toContain('插片 45 lb');
    expect(combined).toContain('plate-loaded base/sled warning');
    expect(plateLoaded).toContain('from-amber-500/12');
  });
});
