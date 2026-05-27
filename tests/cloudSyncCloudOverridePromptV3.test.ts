import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloudSyncSettingsSection } from '../src/cloudSync/CloudSyncSettingsSection';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';
import { buildCloudSyncSettingsSectionPropsFromRuntime } from '../src/uiOs/settings/cloudSyncRuntimeSettingsAdapter';

// V3 regression: the conflict_review_required state must surface a dedicated
// "用本地覆盖云端" prompt instead of silently appending an instruction to the
// warnings pill bag. The V1/V2 design pushed "再次点开启同步以用本地覆盖云端"
// into syncStatus.warnings, which users perceived as the toggle reverting
// after the first tap. The V3 banner is the explicit two-step override
// affordance — a separate visual block with its own button.
//
// These tests lock the three properties that matter for the iPhone PWA
// reproduction:
//   1. Section renders the prompt when cloudOverridePrompt is set.
//   2. Section omits the prompt when cloudOverridePrompt is null.
//   3. Adapter plumbs cloudOverridePrompt from input verbatim — the panel
//      controls visibility, the adapter must not invent its own.

const renderSection = (props: Parameters<typeof CloudSyncSettingsSection>[0] = {}) =>
  renderToStaticMarkup(
    createElement(
      UiThemeProvider,
      { value: { selectedThemeMode: 'dark', resolvedTheme: 'dark', focusModeImmersiveDark: true } },
      createElement(CloudSyncSettingsSection, props),
    ),
  );

describe('Cloud sync settings section — V3 cloud-override prompt', () => {
  it('renders the dedicated override banner with title + body + action button when cloudOverridePrompt is set', () => {
    const onAction = vi.fn();
    const markup = renderSection({
      authCard: { authStatus: 'signed_in', currentUserEmail: 'user@example.com' },
      accountSettings: {
        accountEmail: 'user@example.com',
        syncOptIn: false,
        localBackupAvailable: true,
        onToggleSync: () => {},
      },
      firstSyncFlow: {
        backupReady: true,
        dryRunReady: true,
        preflightReady: true,
        explicitOptIn: true,
        canVerify: true,
      },
      syncStatus: {
        syncRuntimeEnabled: false,
        readinessStatus: 'ready',
        warnings: [],
        cloudOverridePrompt: {
          title: '云端有不同的同步数据',
          body: '云端发现一份与本地不同的备份。',
          actionLabel: '用本地覆盖云端',
          cancelLabel: '不想覆盖可以放着不动',
          onAction,
        },
      },
    });

    expect(markup).toContain('data-testid="ironpath-sync-cloud-override-prompt"');
    expect(markup).toContain('data-testid="ironpath-sync-cloud-override-prompt-title"');
    expect(markup).toContain('云端有不同的同步数据');
    expect(markup).toContain('data-testid="ironpath-sync-cloud-override-prompt-body"');
    expect(markup).toContain('云端发现一份与本地不同的备份');
    expect(markup).toContain('data-testid="ironpath-sync-cloud-override-prompt-action"');
    expect(markup).toContain('用本地覆盖云端');
    expect(markup).toContain('data-testid="ironpath-sync-cloud-override-prompt-hint"');
    expect(markup).toContain('不想覆盖可以放着不动');
    // The pre-V3 inline instruction must NOT also appear — that's the
    // duplicate the banner is replacing.
    expect(markup).not.toContain('再次点开启同步');
  });

  it('omits the banner entirely when cloudOverridePrompt is null', () => {
    const markup = renderSection({
      authCard: { authStatus: 'signed_in', currentUserEmail: 'user@example.com' },
      accountSettings: {
        accountEmail: 'user@example.com',
        syncOptIn: false,
        localBackupAvailable: true,
        onToggleSync: () => {},
      },
      firstSyncFlow: {
        backupReady: true,
        dryRunReady: true,
        preflightReady: true,
        explicitOptIn: true,
        canVerify: true,
      },
      syncStatus: {
        syncRuntimeEnabled: false,
        readinessStatus: 'ready',
        warnings: [],
        cloudOverridePrompt: null,
      },
    });

    expect(markup).not.toContain('data-testid="ironpath-sync-cloud-override-prompt"');
  });

  it('shows the pending label on the action button while the override is in flight', () => {
    const markup = renderSection({
      authCard: { authStatus: 'signed_in', currentUserEmail: 'user@example.com' },
      accountSettings: {
        accountEmail: 'user@example.com',
        syncOptIn: false,
        localBackupAvailable: true,
        onToggleSync: () => {},
      },
      firstSyncFlow: {
        backupReady: true,
        dryRunReady: true,
        preflightReady: true,
        explicitOptIn: true,
        canVerify: true,
      },
      syncStatus: {
        syncRuntimeEnabled: false,
        readinessStatus: 'ready',
        warnings: [],
        cloudOverridePrompt: {
          title: '云端有不同的同步数据',
          body: '云端发现一份与本地不同的备份。',
          actionLabel: '用本地覆盖云端',
          onAction: () => {},
          isPending: true,
        },
      },
    });

    expect(markup).toContain('正在覆盖云端…');
    expect(markup).toContain('disabled=""');
  });

  it('adapter plumbs cloudOverridePrompt from input to syncStatus verbatim — the panel owns the policy', () => {
    const prompt = {
      title: 't',
      body: 'b',
      actionLabel: 'a',
      onAction: () => {},
    };
    const props = buildCloudSyncSettingsSectionPropsFromRuntime({
      cloudOverridePrompt: prompt,
    });
    expect(props.syncStatus?.cloudOverridePrompt).toBe(prompt);
  });

  it('adapter exposes cloudOverridePrompt=null when nothing is passed (default)', () => {
    const props = buildCloudSyncSettingsSectionPropsFromRuntime({});
    expect(props.syncStatus?.cloudOverridePrompt).toBeNull();
  });
});
