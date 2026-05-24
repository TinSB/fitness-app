import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthUiSkeletonPanel } from '../src/uiOs/settings/AuthUiSkeletonPanel';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 19F auth UI skeleton panel', () => {
  it('renders passive account candidate copy without controls', () => {
    const markup = renderToStaticMarkup(createElement(AuthUiSkeletonPanel));

    for (const expected of [
      '账号',
      '账号候选',
      '仅预览',
      '不需要登录',
      '默认关闭',
      '仍保存在本机',
      '后续单独确认',
      '不改变计划和记录',
    ]) {
      expect(markup).toContain(expected);
    }

    for (const forbidden of [
      '<button',
      '<input',
      '<form',
      'href=',
      'onClick',
      '生成账号',
      '开始同步',
      '立即登录',
    ]) {
      expect(markup).not.toContain(forbidden);
    }
  });

  it('is mounted from Profile settings without auth client runtime imports', () => {
    const profile = readSource('src/features/ProfileView.tsx');

    expect(profile).toContain("import { AuthUiSkeletonPanel } from '../uiOs/settings/AuthUiSkeletonPanel';");
    expect(profile).toContain('<AuthUiSkeletonPanel />');
    expect(profile).not.toContain('authClientSkeletonEnvGuard');
    expect(profile).not.toContain('buildPhase19eAuthClientSkeleton');
  });

  it('visible source copy stays passive and non-durable', () => {
    const source = readSource('src/uiOs/settings/AuthUiSkeletonPanel.tsx');

    for (const expected of [
      '账号候选',
      '不需要登录',
      '默认关闭',
      '仍保存在本机',
      '后续单独确认',
    ]) {
      expect(source).toContain(expected);
    }

    for (const forbidden of [
      '应用到计划',
      '保存云端',
      '开始同步',
      '自动同步',
      '自动上传',
      '立即登录',
      '生成账号',
      '连接 Supabase',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
