/**
 * Centralized utility functions for paper size, drawing scale, and conversion.
 * 
 * Concept:
 * 1. Paper size is in paper mm (e.g., A3 landscape is 420 x 297 mm).
 * 2. Drawing scale is a string (e.g., "1:100"). The scale factor is 100.
 * 3. Real-world size = paper size * scale factor (e.g., A3 landscape at 1:100 is 42,000 x 29,700 real-world mm).
 * 4. pixelsPerUnit determines how many screen/SVG pixels represent 1 real-world unit (e.g., 0.025 pixels per mm).
 * 5. Pixel size = Real-world size * pixelsPerUnit (e.g., 42,000 * 0.025 = 1050 px).
 */

import type { CanvasConfig, ScaleConfig } from '../types/project';

/**
 * Parses scale string (e.g., "1:100") to retrieve the scale factor (e.g., 100).
 */
export const getDrawingScaleFactor = (scale: ScaleConfig | string): number => {
  const scaleStr = typeof scale === 'string' ? scale : scale.drawingScale;
  const parts = scaleStr.split(':');
  if (parts.length === 2) {
    const val = parseFloat(parts[1]);
    if (!isNaN(val)) return val;
  }
  return 100; // default fallback
};

/**
 * Returns the real-world dimensions in mm of the paper sheet.
 */
export const getRealPaperSize = (canvas: CanvasConfig, scale: ScaleConfig): { width: number; height: number } => {
  const scaleFactor = getDrawingScaleFactor(scale);
  return {
    width: canvas.width * scaleFactor,
    height: canvas.height * scaleFactor,
  };
};

/**
 * Returns the dimensions in screen pixels of the paper boundary.
 */
export const getPaperPixelSize = (canvas: CanvasConfig, scale: ScaleConfig): { width: number; height: number } => {
  const realSize = getRealPaperSize(canvas, scale);
  return {
    width: Math.round(realSize.width * scale.pixelsPerUnit),
    height: Math.round(realSize.height * scale.pixelsPerUnit),
  };
};

/**
 * Convert real-world unit (mm) to screen/SVG pixels.
 */
export const realToPx = (value: number, scale: ScaleConfig): number => {
  return value * scale.pixelsPerUnit;
};

/**
 * Convert screen/SVG pixels to real-world units (mm).
 */
export const pxToReal = (value: number, scale: ScaleConfig): number => {
  return value / scale.pixelsPerUnit;
};
