export type WallFacingMode = 'none' | 'front-away-from-wall';

export type PlanSymbolId =
  | 'chair'
  | 'office_chair'
  | 'student_desk'
  | 'teacher_desk'
  | 'table'
  | 'conference_table'
  | 'sofa'
  | 'armchair'
  | 'cabinet'
  | 'closet'
  | 'shelf'
  | 'locker'
  | 'toilet'
  | 'urinal'
  | 'sink'
  | 'kitchen_sink'
  | 'portable_sink'
  | 'whiteboard'
  | 'bed'
  | 'ramp'
  | 'door_opening'
  | 'double_door'
  | 'desk_with_chair'
  | 'vehicle_outline';

export interface PlanSymbolMetadata {
  id: PlanSymbolId;
  label: string;
  category: 'seating' | 'desks' | 'tables' | 'storage' | 'sanitary' | 'classroom' | 'circulation' | 'doors' | 'fallback';
  defaultWidth: number;
  defaultHeight: number;
  frontDirection: 'up';
  wallFacing: WallFacingMode;
}

export const PLAN_SYMBOLS: Record<PlanSymbolId, PlanSymbolMetadata> = {
  chair: { id: 'chair', label: 'Chair', category: 'seating', defaultWidth: 400, defaultHeight: 400, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  office_chair: { id: 'office_chair', label: 'Office Chair', category: 'seating', defaultWidth: 500, defaultHeight: 500, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  student_desk: { id: 'student_desk', label: 'Student Desk', category: 'desks', defaultWidth: 700, defaultHeight: 450, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  teacher_desk: { id: 'teacher_desk', label: 'Teacher Desk', category: 'desks', defaultWidth: 1200, defaultHeight: 500, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  table: { id: 'table', label: 'Table', category: 'tables', defaultWidth: 900, defaultHeight: 900, frontDirection: 'up', wallFacing: 'none' },
  conference_table: { id: 'conference_table', label: 'Conference Table', category: 'tables', defaultWidth: 1800, defaultHeight: 900, frontDirection: 'up', wallFacing: 'none' },
  sofa: { id: 'sofa', label: 'Sofa', category: 'seating', defaultWidth: 1800, defaultHeight: 850, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  armchair: { id: 'armchair', label: 'Armchair', category: 'seating', defaultWidth: 850, defaultHeight: 850, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  cabinet: { id: 'cabinet', label: 'Cabinet', category: 'storage', defaultWidth: 900, defaultHeight: 400, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  closet: { id: 'closet', label: 'Closet', category: 'storage', defaultWidth: 900, defaultHeight: 550, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  shelf: { id: 'shelf', label: 'Shelf', category: 'storage', defaultWidth: 1200, defaultHeight: 300, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  locker: { id: 'locker', label: 'Locker', category: 'storage', defaultWidth: 900, defaultHeight: 450, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  toilet: { id: 'toilet', label: 'Toilet', category: 'sanitary', defaultWidth: 450, defaultHeight: 650, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  urinal: { id: 'urinal', label: 'Urinal', category: 'sanitary', defaultWidth: 350, defaultHeight: 450, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  sink: { id: 'sink', label: 'Sink', category: 'sanitary', defaultWidth: 600, defaultHeight: 500, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  kitchen_sink: { id: 'kitchen_sink', label: 'Kitchen Sink', category: 'sanitary', defaultWidth: 600, defaultHeight: 500, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  portable_sink: { id: 'portable_sink', label: 'Portable Sink', category: 'sanitary', defaultWidth: 450, defaultHeight: 400, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  whiteboard: { id: 'whiteboard', label: 'Whiteboard', category: 'classroom', defaultWidth: 1800, defaultHeight: 120, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  bed: { id: 'bed', label: 'Bed', category: 'seating', defaultWidth: 1000, defaultHeight: 2000, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  ramp: { id: 'ramp', label: 'Ramp', category: 'circulation', defaultWidth: 1200, defaultHeight: 2500, frontDirection: 'up', wallFacing: 'none' },
  door_opening: { id: 'door_opening', label: 'Door Opening', category: 'doors', defaultWidth: 900, defaultHeight: 180, frontDirection: 'up', wallFacing: 'none' },
  double_door: { id: 'double_door', label: 'Double Door', category: 'doors', defaultWidth: 1800, defaultHeight: 400, frontDirection: 'up', wallFacing: 'none' },
  desk_with_chair: { id: 'desk_with_chair', label: 'Desk with Chair', category: 'classroom', defaultWidth: 700, defaultHeight: 900, frontDirection: 'up', wallFacing: 'front-away-from-wall' },
  vehicle_outline: { id: 'vehicle_outline', label: 'Vehicle Outline', category: 'circulation', defaultWidth: 2200, defaultHeight: 4400, frontDirection: 'up', wallFacing: 'none' },
};

/**
 * Older saved projects may reference furniture types that have since been merged into
 * another symbol. Resolve those ids here so existing floor plans keep rendering correctly.
 */
export const LEGACY_SYMBOL_ALIASES: Record<string, PlanSymbolId> = {
  male_toilet: 'urinal',
};

export const resolveSymbolId = (value: string): string => LEGACY_SYMBOL_ALIASES[value] ?? value;

export const isPlanSymbolId = (value: string): value is PlanSymbolId => resolveSymbolId(value) in PLAN_SYMBOLS;

export const getPlanSymbolMetadata = (value: string): PlanSymbolMetadata => {
  const resolved = resolveSymbolId(value);
  return isPlanSymbolId(resolved) ? PLAN_SYMBOLS[resolved as PlanSymbolId] : {
    id: 'table',
    label: 'Unknown Symbol',
    category: 'fallback',
    defaultWidth: 800,
    defaultHeight: 500,
    frontDirection: 'up',
    wallFacing: 'none',
  };
};

export const supportsWallFacing = (value: string): boolean => {
  return getPlanSymbolMetadata(value).wallFacing === 'front-away-from-wall';
};
