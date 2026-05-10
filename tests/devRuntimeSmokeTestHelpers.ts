import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import type { AppData } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import type { HttpJsonResponse } from './httpRuntimeAdapterTestHelpers';

export const DEV_RUNTIME_SMOKE_NOW = '2026-05-10T13:00:00.000Z';

export const makeTempDevRuntimeDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ironpath-dev-runtime-smoke-'));
  const dbFile = join(dir, 'dev-api.sqlite');
  const cleanup = () => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  };
  return { dir, dbFile, cleanup };
};

export const countSnapshotsInFile = (dbFile: string) => {
  const repository = createSqliteRepository({ filename: dbFile });
  try {
    return Number(
      (
        repository.database
          .prepare('SELECT COUNT(*) AS count FROM app_data_snapshots')
          .get() as { count: number }
      ).count,
    );
  } finally {
    repository.close();
  }
};

export const latestSnapshotLabelInFile = (dbFile: string) => {
  const repository = createSqliteRepository({ filename: dbFile });
  try {
    return (
      repository.database
        .prepare('SELECT label FROM app_data_snapshots ORDER BY row_id DESC LIMIT 1')
        .get() as { label?: string } | undefined
    )?.label;
  } finally {
    repository.close();
  }
};

export const readLatestAppDataFromFile = (dbFile: string) => {
  const repository = createSqliteRepository({ filename: dbFile });
  try {
    return repository.readSnapshot();
  } finally {
    repository.close();
  }
};

export const seedStartableAppDataSnapshot = (dbFile: string, data: AppData = makeAppData()) => {
  const repository = createSqliteRepository({ filename: dbFile });
  try {
    repository.writeSnapshot(data, {
      snapshotId: 'dev-runtime-startable-seed',
      createdAt: DEV_RUNTIME_SMOKE_NOW,
      label: 'dev-runtime:startable-seed',
    });
  } finally {
    repository.close();
  }
};

export const fetchJsonWithTimeout = async (
  url: string,
  init: RequestInit = {},
  timeoutMs = 500,
): Promise<HttpJsonResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const bodyText = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      bodyText,
      body: bodyText ? (JSON.parse(bodyText) as unknown) : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const expectShortHttpFailure = async (url: string) => {
  let error: unknown;
  try {
    await fetchJsonWithTimeout(url, {}, 250);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeTruthy();
  const text = String(error instanceof Error ? error.message : error);
  expect(text).toMatch(/fetch failed|aborted|ECONNREFUSED|ECONNRESET|UND_ERR|terminated/i);
};

export const expectNoRawRuntimeDetails = (body: unknown) => {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('SqliteRepositoryError');
  expect(serialized).not.toContain('Error:');
  expect(serialized).not.toContain('cause');
};

export const expectStableHttpErrorBody = (body: unknown) => {
  expect(body).toMatchObject({
    error: {
      code: expect.any(String),
      message: expect.any(String),
    },
  });
  expectNoRawRuntimeDetails(body);
};

export const expectNoSnapshotWrite = (dbFile: string, beforeCount: number) => {
  expect(countSnapshotsInFile(dbFile)).toBe(beforeCount);
};
