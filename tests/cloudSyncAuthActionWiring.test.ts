import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildAuthRuntimeWiring,
  createSyntheticAuthRuntimeAdapter,
  type Phase20cAuthRuntimeAdapter,
} from '../src/cloudProduction/authRuntimeWiring';
import { buildSupabaseProjectRuntimeReadinessCheck } from '../src/cloudProduction/supabaseProjectRuntimeReadinessCheck';
import {
  buildCloudSyncAuthActionRuntime,
} from '../src/uiOs/settings/cloudSyncAuthActionController';
import { buildCloudSyncSettingsSectionPropsFromRuntime } from '../src/uiOs/settings/cloudSyncRuntimeSettingsAdapter';
import { CloudSyncPolishSettingsPanel } from '../src/uiOs/settings/CloudSyncPolishSettingsPanel';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';

const nowIso = '2026-05-24T23:20:00.000Z';

const render = (element: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      UiThemeProvider,
      { value: { selectedThemeMode: 'dark', resolvedTheme: 'dark', focusModeImmersiveDark: true } },
      element,
    ),
  );

const textOnly = (markup: string) => markup.replace(/<[^>]+>/g, '');

const ready20b = () =>
  buildSupabaseProjectRuntimeReadinessCheck({
    enabled: true,
    phase20aAuthorization: {
      runtimeImplementationAuthorized: true,
      canStart20B: true,
      liveCloudSyncActivated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    browserEnv: {
      VITE_SUPABASE_URL: 'https://ironpath-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
      VITE_IRONPATH_AUTH_CALLBACK_URL: 'http://127.0.0.1:3000/auth/callback',
      VITE_IRONPATH_CLOUD_ENVIRONMENT: 'production',
    },
    runtimeBoundary: {
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    serviceRoleKeyPresent: false,
    browserConfig: { publicBrowserConfigOnly: true },
    nowIso,
  });

const syntheticUser = () => ({
  userId: 'synthetic-user-1',
  accountId: 'synthetic-account-1',
  displayName: 'ironpath@example.test',
});

const signedInAuth = () =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: ready20b(),
    adapter: createSyntheticAuthRuntimeAdapter(syntheticUser()),
    action: 'check_session',
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

describe('Cloud Sync auth action wiring to Settings UI', () => {
  it('keeps the signed-out Settings login button available without enabling sync', () => {
    const markup = render(createElement(CloudSyncPolishSettingsPanel, { readiness: ready20b() }));
    const text = textOnly(markup);

    expect(markup).toContain('data-testid="ironpath-auth-card"');
    expect(markup).toContain('data-testid="ironpath-auth-sign-in"');
    expect(text).toContain('登录账号');
    expect(text).toContain('未登录');
    expect(text).toContain('同步未开启');
    expect(text).not.toContain('已选择开启');
    expect(text).not.toContain('云端优先');
  });

  it('renders a signing-in loading state from the Settings adapter', () => {
    const props = buildCloudSyncSettingsSectionPropsFromRuntime({
      readiness: ready20b(),
      authActionPending: true,
    });

    expect(props.authCard?.authStatus).toBe('signing_in');
    expect(props.authCard?.isSigningIn).toBe(true);

    const markup = render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authActionPending: true,
    }));
    expect(textOnly(markup)).toContain('登录中');
  });

  it('runs sign-in through the Phase 20C auth runtime contract after explicit user action', () => {
    const result = buildCloudSyncAuthActionRuntime({
      action: 'sign_in',
      readiness: ready20b(),
      adapter: createSyntheticAuthRuntimeAdapter(syntheticUser()),
      userInitiated: true,
      nowIso,
    });

    expect(result.errorMessage).toBeNull();
    expect(result.authRuntime).toMatchObject({
      ok: true,
      status: 'signed_in',
      authenticated: true,
      user: syntheticUser(),
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      serviceRoleExposed: false,
      secretsExposed: false,
    });
  });

  it('runs sign-out only as an explicit auth runtime action', () => {
    const blocked = buildCloudSyncAuthActionRuntime({
      action: 'sign_out',
      readiness: ready20b(),
      adapter: createSyntheticAuthRuntimeAdapter(syntheticUser()),
      userInitiated: false,
      nowIso,
    });
    const signedOut = buildCloudSyncAuthActionRuntime({
      action: 'sign_out',
      readiness: ready20b(),
      adapter: createSyntheticAuthRuntimeAdapter(syntheticUser()),
      userInitiated: true,
      nowIso,
    });

    expect(blocked.authRuntime.status).toBe('user_action_required');
    expect(blocked.errorMessage).toBe('请先确认操作。');
    expect(signedOut.authRuntime).toMatchObject({
      ok: true,
      status: 'signed_out',
      authenticated: false,
      user: null,
      tokenStored: false,
      localStorageChanged: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
    });
  });

  it('renders signed-in account copy and sign-out action from auth runtime state', () => {
    const markup = render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
    }));
    const text = textOnly(markup);

    expect(markup).toContain('data-testid="ironpath-auth-sign-out"');
    expect(markup).toContain('data-testid="ironpath-account-sign-out"');
    expect(text).toContain('ironpath@example.test');
    expect(text).toContain('已登录');
    expect(text).toContain('退出登录');
  });

  it('renders concise Chinese error copy when the safe auth adapter is unavailable', () => {
    const result = buildCloudSyncAuthActionRuntime({
      action: 'sign_in',
      readiness: ready20b(),
      adapter: null,
      userInitiated: true,
      nowIso,
    });
    const markup = render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authErrorMessage: result.errorMessage,
    }));
    const text = textOnly(markup);

    expect(result.authRuntime.status).toBe('adapter_missing');
    expect(text).toContain('登录失败');
    expect(text).toContain('登录暂不可用。');
    expect(text).toContain('登录账号');
  });

  it('blocks unsafe adapter results without surfacing tokens or enabling sync', () => {
    const unsafeAdapter: Phase20cAuthRuntimeAdapter = {
      providerName: 'synthetic-auth-runtime',
      checkSession: () => ({
        ok: true,
        status: 'unauthenticated',
        user: null,
        message: 'unused',
        networkAttempted: false,
        tokenStored: false,
        localStorageChanged: false,
        secretsExposed: false,
      }),
      signIn: () => ({
        ok: true,
        status: 'authenticated',
        user: syntheticUser(),
        message: 'unsafe',
        networkAttempted: false,
        tokenStored: true,
        localStorageChanged: true,
        secretsExposed: true,
      }),
      signOut: () => ({
        ok: true,
        status: 'signed_out',
        user: null,
        message: 'unused',
        networkAttempted: false,
        tokenStored: false,
        localStorageChanged: false,
        secretsExposed: false,
      }),
    };

    const result = buildCloudSyncAuthActionRuntime({
      action: 'sign_in',
      readiness: ready20b(),
      adapter: unsafeAdapter,
      userInitiated: true,
      nowIso,
    });

    expect(result.authRuntime.status).toBe('runtime_boundary_unsafe');
    expect(result.errorMessage).toBe('登录已暂停，请先检查设置。');
    expect(result.authRuntime).toMatchObject({
      authenticated: false,
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      serviceRoleExposed: false,
      secretsExposed: false,
    });
  });

  it('does not render environment values secrets or forbidden unsafe sync copy', () => {
    const markup = render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
    }));
    const text = textOnly(markup);

    for (const forbidden of [
      'https://ironpath-project.supabase.co',
      'synthetic-public-anon-key',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE',
      'service role',
      'API key',
      'token',
      '自动同步已开启',
      '云端优先',
      '默认开启',
      '自动覆盖',
      '删除本地数据',
      '上传',
      '下载云端',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
