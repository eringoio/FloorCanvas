import type { Project, CanvasConfig } from '../types/project';
import { getProjectContentBounds } from './contentBounds';
import { getObjectBounds } from './bounds';
import { getDrawingScaleFactor } from './scale';

const CANDIDATE_SCALES = ['1:50', '1:75', '1:100', '1:125', '1:150', '1:200', '1:250', '1:300'];

export function fitPlanToPage(project: Project): void {
  const targetCanvas = project.canvas;
  const scale = project.scale;
  const scaleFactor = getDrawingScaleFactor(scale);
  const sheetRealW = targetCanvas.width * scaleFactor;
  const sheetRealH = targetCanvas.height * scaleFactor;

  // 1. Calculate structural bounds (excluding background, dimensions, and title text)
  const layerVisMap: Record<string, boolean> = {};
  project.layers.forEach((l) => {
    layerVisMap[l.id] = l.visible;
  });

  const structuralObjects = project.objects.filter((obj) => {
    if (obj.visible === false) return false;
    if (obj.layerId && layerVisMap[obj.layerId] === false) return false;
    if (obj.type === 'background') return false;
    if (obj.type === 'dimension') return false;
    if (obj.type === 'text') {
      const textObj = obj as any;
      if (textObj.id.includes('title')) return false;
    }
    return true;
  });

  if (structuralObjects.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  structuralObjects.forEach((obj) => {
    const bounds = getObjectBounds(obj);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  });

  if (minX === Infinity) return;

  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;

  // Center of sheet
  const sheetCenterX = sheetRealW / 2;
  const sheetCenterY = sheetRealH / 2;

  // Shift calculation
  const dx = sheetCenterX - contentCenterX;
  const dy = sheetCenterY - contentCenterY;

  // Shift all drawing objects except page-relative title
  project.objects = project.objects.map((obj) => {
    if (obj.type === 'text' && obj.id.includes('title')) {
      return obj; // Do not shift title text
    }
    return shiftObject(obj, dx, dy);
  });
}

export function adaptSampleProjectToCanvas(
  sampleProject: Project,
  targetCanvas: CanvasConfig,
  options?: {
    marginMm?: number;
    preferExistingScale?: boolean;
  }
): Project {
  const marginMm = options?.marginMm ?? 1000;
  const preferExistingScale = options?.preferExistingScale ?? false;

  // 1. Deep clone the sample project
  const adapted = JSON.parse(JSON.stringify(sampleProject)) as Project;

  // 2. Use target paper configuration
  adapted.canvas = { ...targetCanvas };

  // 3. Compute visible content bounds
  const bounds = getProjectContentBounds(adapted);
  if (!bounds) {
    // If no objects, just return the cloned project with the new canvas size
    return adapted;
  }

  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;

  // 4. Try candidate scales to find one where content fits inside sheet with margin
  let selectedScale = adapted.scale.drawingScale;
  
  if (!preferExistingScale) {
    let bestScale = CANDIDATE_SCALES[CANDIDATE_SCALES.length - 1]; // default fallback (largest scale factor)
    
    for (const scaleStr of CANDIDATE_SCALES) {
      // Parse scale factor (e.g. 100 for '1:100')
      const parts = scaleStr.split(':');
      if (parts.length === 2) {
        const factor = parseFloat(parts[1]);
        if (!isNaN(factor)) {
          const realPaperW = targetCanvas.width * factor;
          const realPaperH = targetCanvas.height * factor;
          
          // Check if content fits with margin on both sides
          if (contentW <= realPaperW - marginMm * 2 && contentH <= realPaperH - marginMm * 2) {
            bestScale = scaleStr;
            break; // Since we ordered them from smallest factor to largest, the first one that fits is the best/most detailed scale!
          }
        }
      }
    }
    selectedScale = bestScale;
  }

  // Update scale string in the config
  adapted.scale.drawingScale = selectedScale;

  // Run page fitting
  fitPlanToPage(adapted);

  return adapted;
}

function shiftObject(obj: any, dx: number, dy: number): any {
  const newObj = { ...obj };
  if ('x1' in newObj && typeof newObj.x1 === 'number') {
    newObj.x1 += dx;
  }
  if ('x2' in newObj && typeof newObj.x2 === 'number') {
    newObj.x2 += dx;
  }
  if ('y1' in newObj && typeof newObj.y1 === 'number') {
    newObj.y1 += dy;
  }
  if ('y2' in newObj && typeof newObj.y2 === 'number') {
    newObj.y2 += dy;
  }
  if ('x' in newObj && typeof newObj.x === 'number') {
    newObj.x += dx;
  }
  if ('y' in newObj && typeof newObj.y === 'number') {
    newObj.y += dy;
  }
  if (newObj.points && Array.isArray(newObj.points)) {
    newObj.points = newObj.points.map((pt: any) => ({
      x: pt.x + dx,
      y: pt.y + dy,
    }));
  }
  return newObj;
}
