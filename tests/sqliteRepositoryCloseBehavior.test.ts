import { describe, expect, it } from 'vitest';
import { createSqliteRepository, SqliteRepositoryError, type SqliteRepositoryErrorCode } from '../apps/api/src/node';
import { exportAppData } from '../src/storage/backup';
import { makeAppData } from './fixtures';

const expectRepositoryError = (operation: () => unknown, code: SqliteRepositoryErrorCode) => {
  try {
    operation();
    throw new Error('Expected SqliteRepositoryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(SqliteRepositoryError);
    expect((error as SqliteRepositoryError).code).toBe(code);
  }
};

describe('SQLite repository close behavior', () => {
  it('allows repeated close and returns database_closed for every repository operation afterward', () => {
    const repo = createSqliteRepository();
    const backup = exportAppData(makeAppData());

    repo.close();
    repo.close();

    expectRepositoryError(() => repo.readSnapshot(), 'database_closed');
    expectRepositoryError(() => repo.writeSnapshot(makeAppData()), 'database_closed');
    expectRepositoryError(() => repo.exportBackupFromSnapshot(), 'database_closed');
    expectRepositoryError(() => repo.importBackupToSnapshot(backup), 'database_closed');
  });
});
