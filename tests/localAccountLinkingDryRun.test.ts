import { describe, expect, it } from 'vitest';
import {
  createAnonymousLocalOwner,
  createBackendPrimaryCandidateOwner,
  createCloudAccountCandidateOwner,
  createDeviceLocalOwner,
} from '../src/cloudProduction/accountScopedAppData';
import { runLocalAccountLinkingDryRun } from '../src/cloudProduction/localAccountLinkingDryRun';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('local account linking dry run', () => {
  it('reports a safe link candidate with explicit confirmation', () => {
    const ownerBefore = createAnonymousLocalOwner('local-owner-1', 'device-1');
    const cloudAccountCandidate = createCloudAccountCandidateOwner('account-1', 'device-1');

    expect(runLocalAccountLinkingDryRun({
      ownerBefore,
      cloudAccountCandidate,
      manualConfirmation: true,
    })).toEqual({
      ok: true,
      safeToLink: true,
      warnings: [],
      blockingErrors: [],
      ownerBefore,
      ownerAfterCandidate: cloudAccountCandidate,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('detects owner scope mismatch for non-cloud target owner', () => {
    expect(runLocalAccountLinkingDryRun({
      ownerBefore: createAnonymousLocalOwner('local-owner-1'),
      cloudAccountCandidate: createDeviceLocalOwner('local-owner-1', 'device-1'),
      manualConfirmation: true,
    })).toMatchObject({
      ok: false,
      safeToLink: false,
      blockingErrors: ['owner_scope_mismatch'],
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('blocks missing account candidate and missing owner', () => {
    expect(runLocalAccountLinkingDryRun({
      ownerBefore: createAnonymousLocalOwner('local-owner-1'),
      manualConfirmation: true,
    })).toMatchObject({
      ok: false,
      blockingErrors: ['account_candidate_missing'],
    });

    expect(runLocalAccountLinkingDryRun({
      cloudAccountCandidate: createCloudAccountCandidateOwner('account-1'),
      manualConfirmation: true,
    })).toMatchObject({
      ok: false,
      blockingErrors: ['owner_missing'],
    });
  });

  it('reports already linked candidate unless explicitly allowed', () => {
    const alreadyLinked = createCloudAccountCandidateOwner('account-1', 'device-1');

    expect(runLocalAccountLinkingDryRun({
      ownerBefore: alreadyLinked,
      cloudAccountCandidate: createCloudAccountCandidateOwner('account-2', 'device-1'),
      manualConfirmation: true,
    })).toMatchObject({
      ok: false,
      blockingErrors: ['already_linked_candidate'],
    });

    expect(runLocalAccountLinkingDryRun({
      ownerBefore: alreadyLinked,
      cloudAccountCandidate: createCloudAccountCandidateOwner('account-1', 'device-1'),
      allowAlreadyLinked: true,
      manualConfirmation: true,
    })).toMatchObject({
      ok: true,
      safeToLink: true,
      blockingErrors: [],
    });
  });

  it('supports unlink dry-run without changing data', () => {
    const ownerBefore = createCloudAccountCandidateOwner('account-1', 'device-1');

    expect(runLocalAccountLinkingDryRun({
      mode: 'unlink',
      ownerBefore,
      manualConfirmation: true,
    })).toEqual({
      ok: true,
      safeToLink: false,
      warnings: ['unlink_dry_run_only'],
      blockingErrors: [],
      ownerBefore,
      ownerAfterCandidate: ownerBefore,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('reports warning-only results when manual confirmation is pending', () => {
    const result = runLocalAccountLinkingDryRun({
      ownerBefore: createDeviceLocalOwner('local-owner-1', 'device-1'),
      cloudAccountCandidate: createCloudAccountCandidateOwner('account-1', 'device-1'),
    });

    expect(result).toMatchObject({
      ok: true,
      safeToLink: false,
      warnings: ['device_owner_will_remain_local', 'manual_confirmation_required'],
      blockingErrors: [],
    });
  });

  it('does not mutate owner inputs in place', () => {
    const ownerBefore = createBackendPrimaryCandidateOwner('local-owner-1', 'device-1');
    const cloudAccountCandidate = createCloudAccountCandidateOwner('account-1', 'device-1');
    const result = runLocalAccountLinkingDryRun({
      ownerBefore,
      cloudAccountCandidate,
      manualConfirmation: true,
    });

    expect(result.ownerBefore).not.toBe(ownerBefore);
    expect(result.ownerAfterCandidate).not.toBe(cloudAccountCandidate);
    expect(ownerBefore).toEqual(createBackendPrimaryCandidateOwner('local-owner-1', 'device-1'));
    expect(cloudAccountCandidate).toEqual(createCloudAccountCandidateOwner('account-1', 'device-1'));
  });

  it('does not call networks add provider SDKs or switch source-of-truth', () => {
    const source = readSource('src/cloudProduction/localAccountLinkingDryRun.ts');

    for (const forbidden of [
      '@supabase',
      '@clerk',
      'next-auth',
      'firebase',
      'auth0',
      'fetch(',
      'XMLHttpRequest',
      'process.env',
      '/auth',
      '/login',
      '/signup',
      'OAuth',
      'password',
      'token storage',
      'document.cookie',
      'localStorage.setItem',
      'localStorage.removeItem',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents linking dry-run boundaries and next task', () => {
    const doc = readSource('docs/LOCAL_ACCOUNT_LINKING_DRY_RUN.md');

    for (const expected of [
      'Task 11.7 Local Account Linking Dry Run V1',
      'Do not upload local data.',
      'Do not mutate local data.',
      'Do not mutate cloud or backend data.',
      'safeToLink',
      'ownerBefore',
      'ownerAfterCandidate',
      'Recommended next task: Task 11.8 Account-Scoped Backend-Primary Auth Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
