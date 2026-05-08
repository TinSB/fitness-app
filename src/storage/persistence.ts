import type { AppData } from '../models/training-model';
import { emptyData, sanitizeData, validateSupportLibraryReferences, validateSupportLibraryShape } from './appDataSanitize';
import { readStoredAppDataFromLocalStorage, writeAppDataToLocalStorage } from './localStorageAdapter';

export { migrateTrainingData } from './appDataMigration';
export {
  DEFAULT_HEALTH_INTEGRATION_SETTINGS,
  emptyData,
  sanitizeData,
  sanitizeHealthIntegrationSettings,
  sanitizeProgramTemplate,
  sanitizeScreeningProfile,
  sanitizeSessionLog,
  sanitizeUserProfile,
  validateSupportLibraryReferences,
  validateSupportLibraryShape,
} from './appDataSanitize';
export { validateAppDataSchema, validateProgramSchema } from './appDataValidation';

export const loadData = (): AppData => {
  validateSupportLibraryShape();
  validateSupportLibraryReferences();

  const result = readStoredAppDataFromLocalStorage();
  if (!result.ok) {
    console.error('Failed to load training data', result.error);
    return emptyData();
  }
  if (!result.found) return emptyData();

  try {
    return sanitizeData(result.rawData);
  } catch (error) {
    console.error('Failed to load training data', error);
    return emptyData();
  }
};

export const saveData = (data: AppData) => {
  const sanitized = sanitizeData(data);
  const result = writeAppDataToLocalStorage(sanitized);
  if (!result.ok) {
    console.error('Failed to save training data', result.error);
  }
};
