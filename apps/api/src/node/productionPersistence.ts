export type ProductionPersistenceResult<T> =
  | { ok: true; value: T }
  | {
    ok: false;
    error: {
      code: 'production_persistence_not_found' | 'production_persistence_unsupported';
      message: string;
    };
  };

export type ProductionAppDataSummary = {
  snapshotId: string;
  generatedFrom: 'synthetic-fixture';
  workouts: number;
  activeSession: boolean;
};

export type ProductionSessionsSummary = {
  activeSession: boolean;
  completedSessions: number;
};

export type ProductionHistoryItem = {
  id: string;
  completedAt: string;
  title: string;
};

export type ProductionDataHealthSummary = {
  issueCount: number;
  dismissedIssueCount: number;
};

export type ProductionPersistenceSeed = {
  appDataSummary: ProductionAppDataSummary;
  sessionsSummary: ProductionSessionsSummary;
  history: readonly ProductionHistoryItem[];
  dataHealthSummary: ProductionDataHealthSummary;
};

export type ProductionPersistenceAdapter = {
  kind: 'production-persistence-adapter';
  sourceOfTruth: false;
  storage: 'in-memory-synthetic-fixture';
  readAppDataSummary: () => ProductionPersistenceResult<ProductionAppDataSummary>;
  readSessionsSummary: () => ProductionPersistenceResult<ProductionSessionsSummary>;
  readHistory: () => ProductionPersistenceResult<readonly ProductionHistoryItem[]>;
  readHistoryItem: (id: string) => ProductionPersistenceResult<ProductionHistoryItem>;
  readDataHealthSummary: () => ProductionPersistenceResult<ProductionDataHealthSummary>;
  writeShadow: () => ProductionPersistenceResult<never>;
};

const unsupported = (): ProductionPersistenceResult<never> => ({
  ok: false,
  error: {
    code: 'production_persistence_unsupported',
    message: 'Production persistence boundary does not implement writes or source-of-truth behavior.',
  },
});

export const createInMemoryProductionPersistenceAdapter = (
  seed: ProductionPersistenceSeed,
): ProductionPersistenceAdapter => ({
  kind: 'production-persistence-adapter',
  sourceOfTruth: false,
  storage: 'in-memory-synthetic-fixture',
  readAppDataSummary: () => ({ ok: true, value: seed.appDataSummary }),
  readSessionsSummary: () => ({ ok: true, value: seed.sessionsSummary }),
  readHistory: () => ({ ok: true, value: seed.history }),
  readHistoryItem: (id) => {
    const item = seed.history.find((entry) => entry.id === id);
    if (item === undefined) {
      return {
        ok: false,
        error: {
          code: 'production_persistence_not_found',
          message: 'Production persistence fixture history item was not found.',
        },
      };
    }
    return { ok: true, value: item };
  },
  readDataHealthSummary: () => ({ ok: true, value: seed.dataHealthSummary }),
  writeShadow: unsupported,
});
