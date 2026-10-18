import type { RoomObject, DimensionObject } from '../types/project';

/**
 * Shared utility functions for formatting and sizing measurements and labels.
 * 
 * Units Reference:
 * - Real-world size: in real-world millimeters (mm).
 * - Paper size: in paper millimeters (mm) (e.g. A3 is 420x297).
 * - SVG pixels: screen display size in pixels.
 * - pixelsPerUnit: scale factor representing SVG pixels per real-world mm.
 */

/**
 * Clamps a number between a minimum and a maximum value.
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Calculates the real-world area of a room in square meters (㎡).
 * Real-world width and height are in millimeters.
 */
export const getRoomAreaSqM = (room: RoomObject): number => {
  return (room.width * room.height) / 1000000;
};

/**
 * Formats a room area value for display.
 * Avoids trailing ".0" decimals (e.g. "43.0㎡" -> "43㎡", but "43.5㎡" -> "43.5㎡").
 */
export const formatAreaLabel = (areaSqM: number, decimals: number = 1): string => {
  const formatted = areaSqM.toFixed(decimals);
  const parsed = parseFloat(formatted);
  if (parsed % 1 === 0) {
    return `${parsed.toFixed(0)}㎡`;
  }
  return `${formatted}㎡`;
};

/**
 * Gets the auto-calculated area label for a room.
 */
export const getRoomAutoAreaLabel = (room: RoomObject): string => {
  const area = getRoomAreaSqM(room);
  return formatAreaLabel(area);
};

/**
 * Computes the optimal font size in SVG pixels for a room label.
 * Small rooms (e.g. W.C., kitchenette) stay readable at a minimum size.
 * Large rooms get larger labels.
 */
export const getRoomLabelFontSizePx = (room: RoomObject, pixelsPerUnit: number): number => {
  const minSidePx = Math.min(room.width, room.height) * pixelsPerUnit;
  return clamp(minSidePx * 0.16, 10, 30);
};

/**
 * Calculates the straight-line length of a dimension line in real-world mm.
 */
export const getDimensionLengthMm = (dimension: DimensionObject): number => {
  const dx = dimension.x2 - dimension.x1;
  const dy = dimension.y2 - dimension.y1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Formats a dimension length for display based on the mode.
 * - 'mm': comma-separated real-world millimeters (e.g. 4600 -> "4,600")
 * - 'm': meters to two decimal places (e.g. 4600 -> "4.60m")
 * - 'auto': meters if length is >= 10,000 mm, otherwise millimeters
 */
export const formatDimensionLabel = (lengthMm: number, mode: 'auto' | 'mm' | 'm' = 'auto'): string => {
  if (mode === 'mm') {
    return Math.round(lengthMm).toLocaleString();
  } else if (mode === 'm') {
    return `${(lengthMm / 1000).toFixed(2)}m`;
  } else {
    // auto
    if (lengthMm >= 10000) {
      return `${(lengthMm / 1000).toFixed(2)}m`;
    }
    return Math.round(lengthMm).toLocaleString();
  }
};

/**
 * Computes the optimal font size in SVG pixels for a dimension label.
 */
export const getDimensionLabelFontSizePx = (lengthMm: number, pixelsPerUnit: number): number => {
  const linePx = lengthMm * pixelsPerUnit;
  return clamp(linePx / 22, 9, 18);
};

export const getRoomLabelFinalFontSizePx = (
  room: RoomObject,
  pixelsPerUnit: number
): number => {
  const base = getRoomLabelFontSizePx(room, pixelsPerUnit);
  return clamp(base * (room.labelFontScale ?? 1), 6, 80);
};

export const getDimensionLabelFinalFontSizePx = (
  dimension: DimensionObject,
  pixelsPerUnit: number
): number => {
  const len = getDimensionLengthMm(dimension);
  const base = getDimensionLabelFontSizePx(len, pixelsPerUnit);
  return clamp(base * (dimension.labelFontScale ?? 1), 6, 60);
};
