import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const normalizeId = (id: string) => id.replaceAll('\\', '/');

// Short build identifier for the in-app diagnostic surface. The cloud-sync
// V2 root cause investigation needs to confirm the iPhone PWA is actually
// running the newest build (not a service-worker-cached stale bundle). We
// prefer Vercel's commit SHA env var when present (production deploys) and
// fall back to `git rev-parse --short HEAD` for local dev so the diagnostic
// always renders a real value. Everything is hex / short — no secrets.
const resolveBuildIdentifier = (): { sha: string; iso: string } => {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha && vercelSha.length >= 7) {
    return { sha: vercelSha.slice(0, 7), iso: new Date().toISOString() };
  }
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return { sha: sha || 'dev', iso: new Date().toISOString() };
  } catch {
    return { sha: 'dev', iso: new Date().toISOString() };
  }
};

const buildIdentifier = resolveBuildIdentifier();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __IRONPATH_BUILD_SHA__: JSON.stringify(buildIdentifier.sha),
    __IRONPATH_BUILD_ISO__: JSON.stringify(buildIdentifier.iso),
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    maxWorkers: '50%',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        prototype: resolve(__dirname, 'prototype.html'),
      },
    },
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalized = normalizeId(id);

          if (normalized.includes('/node_modules/react') || normalized.includes('/node_modules/react-dom')) {
            return 'vendor-react';
          }

          if (normalized.includes('/node_modules/ajv')) {
            return 'vendor-validation';
          }

          if (normalized.includes('/src/content/evidenceRules') || normalized.includes('/src/content/evidenceSources')) {
            return 'content-evidence';
          }

          if (normalized.includes('/src/features/ProgressView')) {
            return 'features-progress';
          }

          if (normalized.includes('/src/features/PlanView')) {
            return 'features-plan';
          }

          if (normalized.includes('/src/features/AssessmentView')) {
            return 'features-assessment';
          }

          if (normalized.includes('/src/features/TrainingView')) {
            return 'features-training';
          }

          if (
            normalized.includes('/src/engines/programAdjustmentEngine') ||
            normalized.includes('/src/engines/adjustmentReviewEngine') ||
            normalized.includes('/src/engines/weeklyCoachActionEngine')
          ) {
            return 'engines-adjustment';
          }

          if (
            normalized.includes('/src/engines/analytics') ||
            normalized.includes('/src/engines/effectiveSetEngine') ||
            normalized.includes('/src/engines/e1rmEngine') ||
            normalized.includes('/src/engines/loadFeedbackEngine')
          ) {
            return 'engines-analytics';
          }

          if (normalized.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase';
          }

          if (
            normalized.includes('/src/cloudProduction/') ||
            normalized.includes('/src/productionApi/') ||
            normalized.includes('/src/productionCutover/') ||
            normalized.includes('/src/personalProduction/')
          ) {
            return 'cloud-production';
          }

          if (
            normalized.includes('/src/cloudSync/') ||
            normalized.includes('/src/sync/') ||
            normalized.includes('/src/auth/')
          ) {
            return 'cloud-sync';
          }

          if (normalized.includes('/src/storage/appDataSanitize') || normalized.includes('/src/storage/appDataValidation')) {
            return 'storage-sanitize';
          }

          if (
            normalized.includes('/src/engines/appleHealth') ||
            normalized.includes('/src/engines/healthImportEngine') ||
            normalized.includes('/src/engines/healthSummaryEngine')
          ) {
            return 'engines-health';
          }

          if (
            normalized.includes('/src/engines/dataHealthEngine') ||
            normalized.includes('/src/engines/dataHealthRepairEngine') ||
            normalized.includes('/src/engines/dataRepairEngine')
          ) {
            return 'engines-data-health';
          }

          return undefined;
        },
      },
    },
  },
});
