import { describe, expect, it } from 'vitest';
import { assertNodeSqliteAvailable, NODE_SQLITE_REQUIRED_MESSAGE } from '../apps/api/src/node';

describe('SQLite repository Node environment guard', () => {
  it('requires node:sqlite DatabaseSync support and does not silently skip tests', () => {
    let DatabaseSync: unknown;
    try {
      DatabaseSync = assertNodeSqliteAvailable();
    } catch (error) {
      throw new Error(NODE_SQLITE_REQUIRED_MESSAGE, { cause: error });
    }

    expect(typeof DatabaseSync).toBe('function');
  });
});
