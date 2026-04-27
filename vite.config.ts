import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const normalizeId = (id: string) => id.replaceAll('\\', '/');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  build: {
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

          return undefined;
        },
      },
    },
  },
});
