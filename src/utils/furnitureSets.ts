import type { MapObject, FurnitureObject } from '../types/project';
import { getPlanSymbolMetadata } from '../symbols/symbolMetadata';

export type ChairSide = 'front' | 'back' | 'left' | 'right' | 'around';

export interface DeskChairSetOptions {
  centerX: number;
  centerY: number;
  rotation: number;
  layerId: string;

  deskWidth: number;
  deskHeight: number;
  chairWidth: number;
  chairHeight: number;

  chairCount: number;
  chairSide: ChairSide;

  timestamp?: number;
  idPrefix?: string;
  groupAsOne?: boolean;
}

/** Gap kept between the desk edge and the chairs placed against it, in mm. */
const DESK_CHAIR_GAP = 30;

interface ChairOffset {
  lx: number;
  ly: number;
  /** Degrees added to the set's base rotation so the chair faces the desk. */
  rotationOffset: number;
}

/** Evenly spaces `count` slots across `span`, centered on 0. */
const spreadAcross = (count: number, span: number): number[] => {
  if (count <= 1) return [0];
  const slot = span / count;
  return Array.from({ length: count }, (_, i) => -span / 2 + slot * (i + 0.5));
};

/** Local-space offsets (relative to the desk center) for `count` chairs placed on one side of
 * the desk. The desk itself always stays at the local origin. */
const chairOffsetsForSide = (
  side: 'front' | 'back' | 'left' | 'right',
  count: number,
  deskWidth: number,
  deskHeight: number,
  chairWidth: number,
  chairHeight: number,
): ChairOffset[] => {
  if (count <= 0) return [];

  switch (side) {
    case 'front': {
      const ly = -(deskHeight / 2 + DESK_CHAIR_GAP + chairHeight / 2);
      return spreadAcross(count, deskWidth).map((lx) => ({ lx, ly, rotationOffset: 180 }));
    }
    case 'back': {
      const ly = deskHeight / 2 + DESK_CHAIR_GAP + chairHeight / 2;
      return spreadAcross(count, deskWidth).map((lx) => ({ lx, ly, rotationOffset: 0 }));
    }
    case 'left': {
      const lx = -(deskWidth / 2 + DESK_CHAIR_GAP + chairWidth / 2);
      return spreadAcross(count, deskHeight).map((ly) => ({ lx, ly, rotationOffset: 90 }));
    }
    case 'right': {
      const lx = deskWidth / 2 + DESK_CHAIR_GAP + chairWidth / 2;
      return spreadAcross(count, deskHeight).map((ly) => ({ lx, ly, rotationOffset: -90 }));
    }
    default:
      return [];
  }
};

/** Splits `count` chairs across sides, front first, then back, then left/right, capped by how
 * many chairs can reasonably fit along the relevant desk edge. */
const distributeAround = (
  count: number,
  deskWidth: number,
  deskHeight: number,
  chairWidth: number,
  chairHeight: number,
): ChairOffset[] => {
  const widthCapacity = Math.max(1, Math.floor(deskWidth / chairWidth));
  const heightCapacity = Math.max(1, Math.floor(deskHeight / chairHeight));

  const offsets: ChairOffset[] = [];
  let remaining = count;

  const take = (side: 'front' | 'back' | 'left' | 'right', capacity: number) => {
    const n = Math.min(remaining, capacity);
    if (n <= 0) return;
    offsets.push(...chairOffsetsForSide(side, n, deskWidth, deskHeight, chairWidth, chairHeight));
    remaining -= n;
  };

  take('front', widthCapacity);
  take('back', widthCapacity);
  take('left', heightCapacity);
  take('right', heightCapacity);
  // Rare overflow (very high chair counts): pile any leftovers onto the right side.
  if (remaining > 0) {
    offsets.push(...chairOffsetsForSide('right', remaining, deskWidth, deskHeight, chairWidth, chairHeight));
  }

  return offsets;
};

const computeChairOffsets = (
  side: ChairSide,
  count: number,
  deskWidth: number,
  deskHeight: number,
  chairWidth: number,
  chairHeight: number,
): ChairOffset[] => {
  if (side === 'around') {
    return distributeAround(count, deskWidth, deskHeight, chairWidth, chairHeight);
  }
  return chairOffsetsForSide(side, count, deskWidth, deskHeight, chairWidth, chairHeight);
};

const rotatePoint = (lx: number, ly: number, rotation: number): { gx: number; gy: number } => {
  const rad = (rotation * Math.PI) / 180;
  const gx = lx * Math.cos(rad) - ly * Math.sin(rad);
  const gy = lx * Math.sin(rad) + ly * Math.cos(rad);
  return { gx, gy };
};

const normalizeRotation = (deg: number): number => ((deg % 360) + 360) % 360;

export function createDeskChairSet(options: DeskChairSetOptions): FurnitureObject[] {
  const {
    centerX, centerY, rotation, layerId,
    deskWidth, deskHeight, chairWidth, chairHeight,
    chairCount, chairSide,
    timestamp = Date.now(),
    idPrefix = 'desk_chair_set',
    groupAsOne = true,
  } = options;

  const setId = `${idPrefix}_${timestamp}`;
  const deskId = `${idPrefix}_desk_${timestamp}`;
  const groupId = groupAsOne ? setId : undefined;

  const desk: FurnitureObject = {
    id: deskId,
    type: 'furniture',
    layerId,
    furnitureType: 'student_desk',
    x: Math.round(centerX),
    y: Math.round(centerY),
    width: deskWidth,
    height: deskHeight,
    rotation: normalizeRotation(rotation),
    visible: true,
    locked: false,
    groupId,
    furnitureSetId: setId,
    furnitureSetRole: 'anchor',
    chairSide,
  };

  const offsets = computeChairOffsets(chairSide, chairCount, deskWidth, deskHeight, chairWidth, chairHeight);

  const chairs: FurnitureObject[] = offsets.map((offset, i) => {
    const { gx, gy } = rotatePoint(offset.lx, offset.ly, rotation);
    return {
      id: `${idPrefix}_chair_${timestamp}_${i}`,
      type: 'furniture',
      layerId,
      furnitureType: 'chair',
      x: Math.round(centerX + gx),
      y: Math.round(centerY + gy),
      width: chairWidth,
      height: chairHeight,
      rotation: normalizeRotation(rotation + offset.rotationOffset),
      visible: true,
      locked: false,
      groupId,
      furnitureSetId: setId,
      furnitureSetRole: 'chair',
      attachedToId: deskId,
      chairIndex: i,
      chairSide,
    };
  });

  return [desk, ...chairs];
}

export function relayoutDeskChairSet(
  objects: MapObject[],
  deskId: string,
  options?: Partial<{
    chairCount: number;
    chairSide: ChairSide;
    chairWidth: number;
    chairHeight: number;
  }>,
): MapObject[] {
  const desk = objects.find((o) => o.id === deskId) as FurnitureObject | undefined;
  if (!desk || desk.type !== 'furniture' || !desk.furnitureSetId) return objects;

  const setId = desk.furnitureSetId;
  const existingChairs = objects.filter(
    (o): o is FurnitureObject =>
      o.type === 'furniture' && (o as FurnitureObject).furnitureSetId === setId && (o as FurnitureObject).furnitureSetRole === 'chair',
  );

  const chairMeta = getPlanSymbolMetadata('chair');
  const chairSide = options?.chairSide ?? desk.chairSide ?? existingChairs[0]?.chairSide ?? 'front';
  const chairCount = options?.chairCount ?? existingChairs.length;
  const chairWidth = options?.chairWidth ?? existingChairs[0]?.width ?? chairMeta.defaultWidth;
  const chairHeight = options?.chairHeight ?? existingChairs[0]?.height ?? chairMeta.defaultHeight;

  const offsets = computeChairOffsets(chairSide, chairCount, desk.width, desk.height, chairWidth, chairHeight);
  const timestamp = Date.now();

  const newChairs: FurnitureObject[] = offsets.map((offset, i) => {
    const { gx, gy } = rotatePoint(offset.lx, offset.ly, desk.rotation);
    return {
      id: `${deskId}_chair_${timestamp}_${i}`,
      type: 'furniture',
      layerId: desk.layerId,
      furnitureType: 'chair',
      x: Math.round(desk.x + gx),
      y: Math.round(desk.y + gy),
      width: chairWidth,
      height: chairHeight,
      rotation: normalizeRotation(desk.rotation + offset.rotationOffset),
      visible: true,
      locked: false,
      groupId: desk.groupId,
      furnitureSetId: setId,
      furnitureSetRole: 'chair',
      attachedToId: deskId,
      chairIndex: i,
      chairSide,
    };
  });

  const existingChairIds = new Set(existingChairs.map((c) => c.id));
  return objects
    .filter((o) => !existingChairIds.has(o.id))
    .map((o) => (o.id === deskId ? { ...o, chairSide } as MapObject : o))
    .concat(newChairs);
}
