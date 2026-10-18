import type { Project } from '../types/project';

/**
 * Minimum set of top-level fields a serialized floor-map project must contain to
 * be considered structurally valid. Shared by the file-open flow and the
 * built-in (JSON) sample loader so both behave consistently.
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

export interface ProjectValidationResult {
  valid: boolean;
  /** Human-readable reason when `valid` is false. */
  error?: string;
  /** Names of the required fields that were missing or malformed. */
  missing: string[];
}

/**
 * Validates that `value` looks like a serialized `Project`. This is a shallow,
 * structural check (not a full schema validation): it confirms the required
 * top-level fields are present and that the array-typed fields are arrays.
 */
export function validateProject(value: unknown): ProjectValidationResult {
  if (!value || typeof value !== 'object') {
    return { valid: false, error: 'Not a valid JSON object', missing: [...REQUIRED_PROJECT_FIELDS] };
  }

  const candidate = value as Record<string, unknown>;
  const missing: string[] = [];

  for (const field of REQUIRED_PROJECT_FIELDS) {
    if (!(field in candidate) || candidate[field] === undefined || candidate[field] === null) {
      missing.push(field);
    }
  }

  // The array-typed fields must actually be arrays.
  for (const field of ['layers', 'objects', 'backgrounds'] as const) {
    if (!missing.includes(field) && !Array.isArray(candidate[field])) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing or invalid required project fields: ${missing.join(', ')}`,
      missing,
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
