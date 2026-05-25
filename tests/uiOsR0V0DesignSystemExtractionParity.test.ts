import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Dumbbell } from 'lucide-react';
import { ActionButton } from '../src/uiOs/primitives/ActionButton';
import { GlassCard } from '../src/uiOs/primitives/GlassCard';
import { SegmentedControl } from '../src/uiOs/primitives/SegmentedControl';
import { StatusBadge } from '../src/uiOs/primitives/StatusBadge';
import { BottomSheet } from '../src/uiOs/surfaces/BottomSheet';
import { SafetyStrip } from '../src/uiOs/surfaces/SafetyStrip';
import { FloatingBottomNav } from '../src/uiOs/navigation/FloatingBottomNav';
import { EquipmentAwareLoadCard } from '../src/uiOs/training/EquipmentAwareLoadCard';

const read = (path: string) => readFileSync(path, 'utf8');
const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('UI-OS R0 v0 design system extraction parity', () => {
  it('extracts required production component files outside prototype', () => {
    for (const path of [
      'src/uiOs/primitives/GlassCard.tsx',
      'src/uiOs/primitives/ActionButton.tsx',
      'src/uiOs/primitives/SegmentedControl.tsx',
      'src/uiOs/primitives/StatusBadge.tsx',
      'src/uiOs/surfaces/BottomSheet.tsx',
      'src/uiOs/surfaces/SafetyStrip.tsx',
      'src/uiOs/navigation/FloatingBottomNav.tsx',
      'src/uiOs/training/EquipmentAwareLoadCard.tsx',
      'src/uiOs/training/TrainingFocusHero.tsx',
      'src/uiOs/settings/SettingsGroupCard.tsx',
    ]) {
      expect(existsSync(path), path).toBe(true);
      expect(path).not.toContain('src/prototype');
    }
  });

  it('renders v0 glass card action segmented and badge visual markers', () => {
    const onClick = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(
        GlassCard,
        { padding: 'lg', highlight: true, onClick },
        React.createElement(ActionButton, { size: 'lg', fullWidth: true }, '开始训练'),
        React.createElement(SegmentedControl, {
          value: 'today',
          onChange: () => undefined,
          options: [
            { value: 'today', label: '今日' },
            { value: 'train', label: '训练' },
          ],
        }),
        React.createElement(StatusBadge, { state: 'manual-required' }, '需要手动确认'),
      ),
    );

    expect(html).toContain('backdrop-blur-xl');
    expect(html).toContain('rgba(44, 44, 46, 0.6)');
    expect(html).toContain('ring-1');
    expect(html).toContain('min-h-[60px]');
    expect(html).toContain('rgba(118, 118, 128, 0.24)');
    expect(html).toContain('bg-orange-500/15');
    expect(visibleText(html)).toContain('开始训练');
  });

  it('renders v0 bottom sheet floating nav safety strip and equipment hero markers', () => {
    const navHtml = renderToStaticMarkup(
      React.createElement(FloatingBottomNav, {
        activeId: 'train',
        trainTabId: 'train',
        activeSession: true,
        onNavigate: () => undefined,
        items: [
          { id: 'today', label: '今日', icon: Dumbbell },
          { id: 'train', label: '训练', icon: Dumbbell },
          { id: 'history', label: '历史', icon: Dumbbell },
          { id: 'progress', label: '进步', icon: Dumbbell },
          { id: 'settings', label: '设置', icon: Dumbbell },
        ],
      }),
    );
    const sheetHtml = renderToStaticMarkup(
      React.createElement(BottomSheet, { isOpen: true, onClose: () => undefined, title: '记录本组', confirmRequired: true }, '实际重量'),
    );
    const safetyHtml = renderToStaticMarkup(React.createElement(SafetyStrip, { includeSecondaryCopy: true }));
    const loadHtml = renderToStaticMarkup(
      React.createElement(EquipmentAwareLoadCard, {
        mainDisplay: '空杆 45 lb × 10',
        subInfo: '每边 0 lb',
        note: '杆重 45 lb 已计入',
      }),
    );

    expect(navHtml).toContain('fixed bottom-0 left-0 right-0');
    expect(navHtml).toContain('data-bottom-nav-safe-area="covered"');
    expect(navHtml).toContain('data-bottom-nav-chrome="transparent-icons"');
    expect(navHtml).toContain('rounded-2xl');
    expect(navHtml).toContain('bg-transparent');
    expect(navHtml).not.toContain('backdrop-blur-2xl');
    expect(sheetHtml).toContain('rounded-t-3xl');
    expect(sheetHtml).toContain('bg-black/60');
    expect(sheetHtml).toContain('需要手动确认');
    expect(safetyHtml).toContain('当前使用本地数据');
    expect(safetyHtml).toContain('云端候选不会自动同步');
    expect(safetyHtml).toContain('本地训练记录仍可继续');
    expect(loadHtml).toContain('text-5xl');
    expect(visibleText(loadHtml)).toContain('空杆 45 lb × 10');
  });

  it('documents extraction map and production parity scope', () => {
    const doc = read('docs/UI_OS_R0_V0_DESIGN_SYSTEM_EXTRACTION_PARITY.md');
    for (const expected of [
      'Task UI-OS R0',
      'product acceptance failed',
      'v0 Component Inventory',
      'Production Extraction Map',
      'GlassCard',
      'FloatingBottomNav',
      'EquipmentAwareLoadCard',
      'Production Surfaces Updated',
      'Prototype Isolation',
      'UI-OS R2 is not started by R0',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
