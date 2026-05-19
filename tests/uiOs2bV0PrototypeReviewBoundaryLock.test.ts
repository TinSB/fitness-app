import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('UI-OS 2B v0 prototype review boundary lock', () => {
  const prototypePath = 'src/prototype/IronPathOS2.tsx';
  const previewPath = 'src/prototypePreview.tsx';
  const htmlPath = 'prototype.html';
  const docPath = 'docs/UI_OS_2B_V0_PROTOTYPE_REVIEW_BOUNDARY_LOCK.md';
  const prototype = () => readSource(prototypePath);
  const doc = () => readSource(docPath);

  it('confirms actual prototype files exist and are documented', () => {
    for (const path of [prototypePath, previewPath, htmlPath, docPath]) {
      expect(existsSync(resolve(repoRoot(), path))).toBe(true);
      expect(doc()).toContain(path);
    }

    expect(doc()).toContain('Task UI-OS 2B');
    expect(doc()).toContain('PR #273');
    expect(doc()).toContain('ironpath-ui-prototype');
    expect(doc()).toContain('96ef57aa73c4e22dc397e5ab9d0df8ec23d78b99');
  });

  it('contains five primary tabs', () => {
    const content = prototype();

    for (const expected of ['今日', '训练', '历史', '进步', '设置']) {
      expect(content).toContain(expected);
    }
  });

  it('contains Apple-inspired visual markers', () => {
    const content = prototype();

    for (const expected of [
      '#0a0a0b',
      'backdrop-blur-xl',
      'backdrop-blur-2xl',
      'SegmentedControl',
      'FloatingBottomNav',
      'BottomSheet',
      'rounded-2xl',
    ]) {
      expect(content).toContain(expected);
    }
    expect(doc()).toContain('near-black background');
    expect(doc()).toContain('glass cards');
    expect(doc()).toContain('floating bottom nav');
    expect(doc()).toContain('segmented control');
    expect(doc()).toContain('bottom sheet');
  });

  it('locks the equipment-aware training hero behavior', () => {
    const content = prototype();

    expect(content).toContain('EquipmentAwareLoadCard');
    expect(content).toContain('空杆 45 lb × 10');
    expect(content).toContain('理论 17 lb');
    expect(content).toContain('实际 45 lb');

    const heroIndex = content.indexOf('mainDisplay="空杆 45 lb × 10"');
    expect(heroIndex).toBeGreaterThan(-1);
    expect(content).not.toContain('mainDisplay="17 lb');
    expect(doc()).toContain('primary visual uses feasible load');
  });

  it('locks local-first safety copy and allows only the negative automatic-sync phrase', () => {
    const content = prototype();

    for (const expected of [
      '当前使用本地数据',
      '云端候选不会自动同步',
      '需要手动确认',
      '紧急本地模式可用',
      '本地训练记录仍可继续',
    ]) {
      expect(content).toContain(expected);
    }

    expect(content.replace('云端候选不会自动同步', '')).not.toContain('自动同步');
    for (const forbidden of ['后台同步', '云端已成为默认', 'SaaS', '已上传成功']) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('documents reviewed scope and next task without starting UI-OS 3', () => {
    const content = doc();

    for (const expected of [
      'prototype is isolated',
      'App.tsx is not integrated with the prototype',
      'No runtime source-of-truth change was made',
      'No training algorithm change was made',
      'No cloud sync was added',
      'No route change was made',
      'No package dependency change was made',
      'UI-OS 3 — Codex App Shell Integration V1 is recommended next.',
      'UI-OS 3 is not started by UI-OS 2B.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
