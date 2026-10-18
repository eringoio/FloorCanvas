import type { Project, ScaleConfig } from '../types/project';
import { getObjectBounds } from './bounds';
import type { BoundingBox } from './bounds';
import { getRealPaperSize, getDrawingScaleFactor } from './scale';

/**
 * Calculates the bounding box of all visible objects on visible layers in a project.
 */
export const getProjectContentBounds = (project: Project): BoundingBox | null => {
  const layerVisMap: Record<string, boolean> = {};
  project.layers.forEach((l) => {
    layerVisMap[l.id] = l.visible;
  });

  const visibleObjects = project.objects.filter((obj) => {
    if (obj.visible === false) return false;
    if (obj.layerId && layerVisMap[obj.layerId] === false) return false;
    return true;
  });

  if (visibleObjects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  visibleObjects.forEach((obj) => {
    const bounds = getObjectBounds(obj);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  });

  if (minX === Infinity) return null;

  return { minX, minY, maxX, maxY };
};

/**
 * Returns the real-world mm boundaries of the current sheet.
 */
export const getSheetRealBounds = (project: Project): BoundingBox => {
  const size = getRealPaperSize(project.canvas, project.scale);
  return {
    minX: 0,
    minY: 0,
    maxX: size.width,
    maxY: size.height,
  };
};

/**
 * Calculates the dx/dy vector needed to align the top-left of contentBounds 
 * to the top-left of the sheet bounds plus a margin.
 */
export const calculateMoveIntoSheetDelta = (
  contentBounds: BoundingBox,
  sheetBounds: BoundingBox,
  marginMm: number
): { dx: number; dy: number } => {
  const targetX = sheetBounds.minX + marginMm;
  const targetY = sheetBounds.minY + marginMm;
  return {
    dx: targetX - contentBounds.minX,
    dy: targetY - contentBounds.minY,
  };
};

/**
 * Calculates the displacement delta needed to center a bounding box (e.g. content)
 * within a sheet's bounding box, respecting the margin safe area.
 * If the margin is too large, it is clamped or ignored.
 */
export const calculateCenterInSheetDelta = (
  contentBounds: BoundingBox,
  sheetBounds: BoundingBox,
  marginMm: number
): { dx: number; dy: number } => {
  const contentCx = (contentBounds.minX + contentBounds.maxX) / 2;
  const contentCy = (contentBounds.minY + contentBounds.maxY) / 2;

  const sheetW = sheetBounds.maxX - sheetBounds.minX;
  const sheetH = sheetBounds.maxY - sheetBounds.minY;

  // Ensure margins don't overlap or exceed sheet dimensions
  const maxMarginX = sheetW / 2;
  const maxMarginY = sheetH / 2;

  const safeMarginX = Math.min(marginMm, maxMarginX);
  const safeMarginY = Math.min(marginMm, maxMarginY);

  const safeMinX = sheetBounds.minX + safeMarginX;
  const safeMinY = sheetBounds.minY + safeMarginY;
  const safeMaxX = sheetBounds.maxX - safeMarginX;
  const safeMaxY = sheetBounds.maxY - safeMarginY;

  const targetCx = (safeMinX + safeMaxX) / 2;
  const targetCy = (safeMinY + safeMaxY) / 2;

  const dx = isNaN(targetCx) || isNaN(contentCx) ? 0 : targetCx - contentCx;
  const dy = isNaN(targetCy) || isNaN(contentCy) ? 0 : targetCy - contentCy;

  return { dx: Math.round(dx), dy: Math.round(dy) };
};

/**
 * Computes custom sheet dimensions in paper mm to fit the current content bounds 
 * with a specified margin in real mm.
 */
export const calculateSheetSizeForContent = (
  contentBounds: BoundingBox,
  scale: ScaleConfig,
  marginMm: number
): { width: number; height: number } => {
  const scaleFactor = getDrawingScaleFactor(scale);
  
  // Since sheet starts at (0, 0), it needs to cover the maximum content coordinates
  const realWidth = Math.max(contentBounds.maxX, 0) + marginMm;
  const realHeight = Math.max(contentBounds.maxY, 0) + marginMm;

  return {
    width: Math.ceil(realWidth / scaleFactor),
    height: Math.ceil(realHeight / scaleFactor),
  };
};
