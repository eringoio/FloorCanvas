import type { Project } from '../types/project';
import { cloneProject } from '../utils/projectValidation';
import { adaptSampleProjectToCanvas } from '../utils/samplePlanAdapter';
import smallOffice from './samples/small-office.floormap.json';
import apartment from './samples/apartment.floormap.json';
import cafeShop from './samples/cafe-shop.floormap.json';

/**
 * Built-in fictional samples for FloorCanvas.
 *
 * These are completely fictional example plans authored independently for
 * FloorCanvas. They are bundled as static JSON resources, so they load in
 * every environment (browser / local Vite / Electron) without any Electron
 * or filesystem dependency.
 *
 * Built-in samples are edit templates: opening one loads an editable copy
 * into the editor. It is not a writable workspace project until the user
 * saves it (desktop: Save creates a project folder in the workspace).
 */
export interface BuiltinSample {
  id: string;
  label: string;
  loadData: unknown;
}

export const BUILTIN_SAMPLE_LABELS = {
  smallOffice: 'Small Office (Sample)',
  apartment: 'Apartment (Sample)',
  cafeShop: 'Café / Small Retail (Sample)',
} as const;

export const BUILTIN_SAMPLES: BuiltinSample[] = [
  { id: 'sample-small-office', label: BUILTIN_SAMPLE_LABELS.smallOffice, loadData: smallOffice },
  { id: 'sample-apartment', label: BUILTIN_SAMPLE_LABELS.apartment, loadData: apartment },
  { id: 'sample-cafe-shop', label: BUILTIN_SAMPLE_LABELS.cafeShop, loadData: cafeShop },
];

/** Returns the built-in sample definition for an id, if it exists. */
export function findBuiltinSample(id: string): BuiltinSample | undefined {
  return BUILTIN_SAMPLES.find((s) => s.id === id);
}

/**
 * Loads a built-in sample as a fresh editable project (deep clone, so the
 * bundled data is never mutated by edits). The clone is centered on its own
 * sheet with a sensible drawing scale, like the classic template flow.
 */
export function loadBuiltinSampleProject(id: string): Project {
  const sample = findBuiltinSample(id);
  if (!sample) throw new Error(`Unknown built-in sample: ${id}`);
  const clone = cloneProject(sample.loadData as Project);
  return adaptSampleProjectToCanvas(clone, clone.canvas, { marginMm: 800 });
}

/** Stable handle for a built-in sample (not tied to any writable file). */
export function builtinSampleHandle(id: string) {
  const sample = findBuiltinSample(id);
  if (!sample) return null;
  return {
    id: sample.id,
    folderPath: '',
    projectPath: '',
    title: sample.label,
    isSample: true,
  };
}
