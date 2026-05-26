import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const normalizeId = (id: string) => id.replaceAll('\\', '/');

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
