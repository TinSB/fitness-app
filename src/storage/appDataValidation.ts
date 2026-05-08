import Ajv2020 from 'ajv/dist/2020';
import schema from '../models/training-program.schema.json';
import appDataSchema from '../models/training-data.schema.json';

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });

export const validateProgramSchema = ajv.compile(schema);
export const validateAppDataSchema = ajv.compile(appDataSchema);
