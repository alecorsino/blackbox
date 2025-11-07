// Schema validation with $ref resolution for Blackbox Protocol v1.3

import type { DataSchema, DataSchemaField, ValidationResult } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(`Validation failed: ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validate value against schema with $ref resolution
 */
export function validateSchema(
  value: any,
  schema: DataSchema,
  models: Record<string, DataSchema> = {},
  context: string = 'Value'
): void {
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    const fieldValue = value[key];
    const fieldContext = `${context}.${key}`;

    // Check required fields
    if (field.required && fieldValue === undefined) {
      errors.push(`${fieldContext}: required field missing`);
      continue;
    }

    // Skip validation if undefined and not required
    if (fieldValue === undefined) {
      continue;
    }

    // Resolve $ref if present
    const resolvedField = resolveFieldRef(field, models);

    // Type validation
    if (resolvedField.type) {
      const actualType = getActualType(fieldValue);
      if (actualType !== resolvedField.type) {
        errors.push(`${fieldContext}: expected ${resolvedField.type}, got ${actualType}`);
        continue;
      }

      // Type-specific validation
      validateTypeSpecific(fieldValue, resolvedField, fieldContext, errors, models);
    }

    // String validation
    if (resolvedField.type === 'string') {
      validateString(fieldValue, resolvedField, fieldContext, errors);
    }

    // Number validation
    if (resolvedField.type === 'number') {
      validateNumber(fieldValue, resolvedField, fieldContext, errors);
    }

    // Array validation
    if (resolvedField.type === 'array' && resolvedField.items) {
      validateArray(fieldValue, resolvedField.items, models, fieldContext, errors);
    }

    // Object validation
    if (resolvedField.type === 'object' && resolvedField.properties) {
      validateSchema(fieldValue, resolvedField.properties, models, fieldContext);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '));
  }
}

/**
 * Resolve $ref in field
 */
export function resolveFieldRef(
  field: DataSchemaField,
  models: Record<string, DataSchema>
): DataSchemaField {
  if (field.$ref) {
    const modelName = field.$ref.replace('#/models/', '');
    const model = models[modelName];

    if (!model) {
      throw new ValidationError(`Model reference not found: ${field.$ref}`);
    }

    // Convert DataSchema to DataSchemaField format
    return {
      type: 'object',
      properties: model,
      ...field  // Preserve other properties like required, default
    };
  }

  return field;
}

/**
 * Resolve model $ref
 */
export function resolveModelRef(
  ref: string,
  models: Record<string, DataSchema>
): DataSchema | undefined {
  if (!ref.startsWith('#/models/')) {
    return undefined;
  }

  const modelName = ref.replace('#/models/', '');
  return models[modelName];
}

/**
 * Get actual type of value
 */
function getActualType(value: any): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';  // null is object in JSON
  return typeof value;
}

/**
 * Type-specific validation
 */
function validateTypeSpecific(
  value: any,
  field: DataSchemaField,
  context: string,
  errors: string[],
  models: Record<string, DataSchema>
): void {
  // Validation happens in specialized functions
}

/**
 * Validate string field
 */
function validateString(
  value: string,
  field: DataSchemaField,
  context: string,
  errors: string[]
): void {
  if (field.minLength !== undefined && value.length < field.minLength) {
    errors.push(`${context}: length must be >= ${field.minLength}`);
  }

  if (field.maxLength !== undefined && value.length > field.maxLength) {
    errors.push(`${context}: length must be <= ${field.maxLength}`);
  }

  if (field.pattern) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(value)) {
      errors.push(`${context}: must match pattern ${field.pattern}`);
    }
  }
}

/**
 * Validate number field
 */
function validateNumber(
  value: number,
  field: DataSchemaField,
  context: string,
  errors: string[]
): void {
  if (field.min !== undefined && value < field.min) {
    errors.push(`${context}: must be >= ${field.min}`);
  }

  if (field.max !== undefined && value > field.max) {
    errors.push(`${context}: must be <= ${field.max}`);
  }
}

/**
 * Validate array elements
 */
function validateArray(
  value: any[],
  itemSchema: DataSchemaField,
  models: Record<string, DataSchema>,
  context: string,
  errors: string[]
): void {
  const resolvedItemSchema = resolveFieldRef(itemSchema, models);

  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    const itemContext = `${context}[${i}]`;

    if (resolvedItemSchema.type) {
      const actualType = getActualType(item);
      if (actualType !== resolvedItemSchema.type) {
        errors.push(`${itemContext}: expected ${resolvedItemSchema.type}, got ${actualType}`);
        continue;
      }
    }

    // Validate object items against properties
    if (resolvedItemSchema.type === 'object' && resolvedItemSchema.properties) {
      try {
        validateSchema(item, resolvedItemSchema.properties, models, itemContext);
      } catch (err) {
        if (err instanceof ValidationError) {
          errors.push(err.message.replace('Validation failed: ', ''));
        }
      }
    }
  }
}

/**
 * Validate plugs against operations
 */
export function validatePlugs(
  plugs: Record<string, any>,
  operations: Record<string, any>
): ValidationResult {
  const errors: string[] = [];

  // Check all operations have plugs
  for (const opName of Object.keys(operations)) {
    if (!plugs[opName]) {
      errors.push(`Missing plug for operation "${opName}"`);
    }
  }

  // Warn about extra plugs (not an error, just info)
  for (const plugName of Object.keys(plugs)) {
    if (!operations[plugName]) {
      console.warn(`Plug "${plugName}" has no operation contract - will not be validated`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
