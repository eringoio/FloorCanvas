import type { Project } from '../types/project';

/**
 * Minimum set of top-level fields a serialized FloorCanvas project must
 * contain to be considered structurally valid. Shared by the file-open flow
 * and the built-in (JSON) sample loader so both behave consistently.
 */
export const REQUIRED_PROJECT_FIELDS = [
  'version',
  'title',
  'unit',
  'scale',
  'canvas',
  'grid',
  'layers',
  'objects',
  'backgrounds',
] as const;

/** Units the editor currently understands. */
export const VALID_UNITS: readonly string[] = ['mm', 'cm', 'm'];

export interface ProjectValidationResult {
  valid: boolean;
  /** Human-readable reason when `valid` is false. */
  error?: string;
  /**
   * Names of the required fields that were missing or malformed. Item-level
   * problems are reported as e.g. `objects[2].id`.
   */
  missing: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Validates that `value` looks like a serialized `Project`. This is a
 * defensive, structural check (not a full schema validation): it confirms
 * the required top-level fields are present with plausible types, that
 * array fields are arrays, and that array items are non-null objects with
 * usable `id`/`type` identifiers — enough to reject absurd malformed JSON
 * without rejecting valid older FloorCanvas files.
 */
export function validateProject(value: unknown): ProjectValidationResult {
  if (!isPlainObject(value)) {
    return { valid: false, error: 'Not a valid JSON object', missing: [...REQUIRED_PROJECT_FIELDS] };
  }

  const candidate = value as Record<string, unknown>;
  const problems: string[] = [];

  for (const field of REQUIRED_PROJECT_FIELDS) {
    if (!(field in candidate) || candidate[field] === undefined || candidate[field] === null) {
      problems.push(field);
    }
  }

  // Scalar-typed top-level fields.
  if (!problems.includes('version') && typeof candidate.version !== 'string') {
    problems.push('version');
  }
  if (!problems.includes('title') && typeof candidate.title !== 'string') {
    problems.push('title');
  }
  if (!problems.includes('unit')) {
    const unit = candidate.unit;
    if (typeof unit !== 'string' || !VALID_UNITS.includes(unit)) {
      problems.push('unit');
    }
  }

  // Object-typed top-level fields must be plain objects.
  for (const field of ['scale', 'canvas', 'grid'] as const) {
    if (!problems.includes(field) && !isPlainObject(candidate[field])) {
      problems.push(field);
    }
  }

  // Array-typed top-level fields must be arrays.
  for (const field of ['layers', 'objects', 'backgrounds'] as const) {
    if (!problems.includes(field) && !Array.isArray(candidate[field])) {
      problems.push(field);
    }
  }

  if (problems.length > 0) {
    return {
      valid: false,
      error: `Missing or invalid required project fields: ${problems.join(', ')}`,
      missing: problems,
    };
  }

  // Layers: each item must be a non-null object with a usable id.
  (candidate.layers as unknown[]).forEach((layer, index) => {
    if (!isPlainObject(layer)) {
      problems.push(`layers[${index}]`);
    } else if (!isNonEmptyString(layer.id)) {
      problems.push(`layers[${index}].id`);
    }
  });

  // Objects: each item must be a non-null object with usable id/type (and a
  // string layerId when present — absence is tolerated for compatibility).
  const checkMapObject = (obj: unknown, arrayName: string, index: number) => {
    if (!isPlainObject(obj)) {
      problems.push(`${arrayName}[${index}]`);
      return;
    }
    if (!isNonEmptyString(obj.id)) {
      problems.push(`${arrayName}[${index}].id`);
    }
    if (!isNonEmptyString(obj.type)) {
      problems.push(`${arrayName}[${index}].type`);
    }
    if (obj.layerId !== undefined && !isNonEmptyString(obj.layerId)) {
      problems.push(`${arrayName}[${index}].layerId`);
    }
  };
  (candidate.objects as unknown[]).forEach((obj, index) => checkMapObject(obj, 'objects', index));
  (candidate.backgrounds as unknown[]).forEach((bg, index) => checkMapObject(bg, 'backgrounds', index));

  if (problems.length > 0) {
    return {
      valid: false,
      error: `Malformed project data: ${problems.join(', ')}`,
      missing: problems,
    };
  }

  return { valid: true, missing: [] };
}

/**
 * Parses and validates a raw project object, throwing on failure and (on
 * success) normalizing an absent `backgrounds` field to an empty array.
 * Returns the validated value typed as `Project`.
 */
export function ensureValidProject(value: unknown): Project {
  // `backgrounds` may legitimately be absent in older files; normalize before validating.
  if (value && typeof value === 'object' && (value as Record<string, unknown>).backgrounds == null) {
    (value as Record<string, unknown>).backgrounds = [];
  }

  const result = validateProject(value);
  if (!result.valid) {
    throw new Error(result.error ?? 'Invalid project file');
  }
  return value as Project;
}

/**
 * Returns a deep clone of a project suitable for loading into the editor. Used
 * when loading built-in JSON samples so the imported module object is never
 * mutated by subsequent edits.
 */
export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}
