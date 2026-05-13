export type ProductionRuntimeSkeletonStatus = 'disabled' | 'scaffold_only';

export type ProductionRuntimeSkeletonCapabilities = {
  status: ProductionRuntimeSkeletonStatus;
  runtimeAvailable: false;
  autoListen: false;
  sourceOfTruth: false;
  auth: false;
  cloudSync: false;
  deploymentReady: false;
  monitoringReady: false;
  readContract: 'unsupported';
  writeContract: false;
  localStorageRole: 'default_fallback_migration_emergency';
};

export type ProductionRuntimeSkeleton = {
  kind: 'production-runtime-skeleton-boundary';
  status: ProductionRuntimeSkeletonStatus;
  autoListen: false;
  capabilities: ProductionRuntimeSkeletonCapabilities;
};

export const createProductionRuntimeCapabilities = (
  status: ProductionRuntimeSkeletonStatus = 'disabled',
): ProductionRuntimeSkeletonCapabilities => ({
  status,
  runtimeAvailable: false,
  autoListen: false,
  sourceOfTruth: false,
  auth: false,
  cloudSync: false,
  deploymentReady: false,
  monitoringReady: false,
  readContract: 'unsupported',
  writeContract: false,
  localStorageRole: 'default_fallback_migration_emergency',
});

export const createProductionRuntimeSkeleton = (
  status: ProductionRuntimeSkeletonStatus = 'disabled',
): ProductionRuntimeSkeleton => ({
  kind: 'production-runtime-skeleton-boundary',
  status,
  autoListen: false,
  capabilities: createProductionRuntimeCapabilities(status),
});
