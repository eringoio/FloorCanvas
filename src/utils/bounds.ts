import type { MapObject } from '../types/project';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Calculates the Axis-Aligned Bounding Box (AABB) of a MapObject in real-world mm.
 */
export const getObjectBounds = (obj: MapObject): BoundingBox => {
  switch (obj.type) {
    case 'wall':
    case 'dimension': {
      return {
        minX: Math.min(obj.x1, obj.x2),
        minY: Math.min(obj.y1, obj.y2),
        maxX: Math.max(obj.x1, obj.x2),
        maxY: Math.max(obj.y1, obj.y2),
      };
    }

    case 'shape': {
      const shapeType = (obj as any).shapeType;
      if (shapeType === 'line' || shapeType === 'polyline' || shapeType === 'polygon') {
        const pts = (obj as any).points || [];
        if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
      } else {
        const w = obj.width ?? ((obj as any).radius ? (obj as any).radius * 2 : 0);
        const h = (obj as any).height ?? ((obj as any).radius ? (obj as any).radius * 2 : 0);
        const rad = ((obj.rotation ?? 0) * Math.PI) / 180;
        const hu = w / 2;
        const hv = h / 2;
        const ex = Math.abs(Math.cos(rad) * hu) + Math.abs(Math.sin(rad) * hv);
        const ey = Math.abs(Math.sin(rad) * hu) + Math.abs(Math.cos(rad) * hv);
        return {
          minX: (obj.x ?? 0) - ex,
          minY: (obj.y ?? 0) - ey,
          maxX: (obj.x ?? 0) + ex,
          maxY: (obj.y ?? 0) + ey,
        };
      }
    }

    case 'column':
    case 'furniture':
    case 'stair':
    case 'elevator':
    case 'background':
    case 'window':
    case 'room': {
      const w = obj.width;
      const h = obj.type === 'window' ? (obj.thickness ?? 200) : (obj as any).height ?? 0;
      
      const rad = ((obj.rotation ?? 0) * Math.PI) / 180;
      const hu = w / 2;
      const hv = h / 2;

      // Half-extents of the rotated rectangle bounding box
      const ex = Math.abs(Math.cos(rad) * hu) + Math.abs(Math.sin(rad) * hv);
      const ey = Math.abs(Math.sin(rad) * hu) + Math.abs(Math.cos(rad) * hv);

      return {
        minX: obj.x - ex,
        minY: obj.y - ey,
        maxX: obj.x + ex,
        maxY: obj.y + ey,
      };
    }

    case 'door': {
      const w = obj.width;
      // Door hinge is at x, y and swings. The swing sweeps a quadrant of radius w.
      // So a safe AABB covers a square of size w around the hinge.

      // Approximate swing bounds relative to hinge
      const extents = w;
      return {
        minX: obj.x - extents,
        minY: obj.y - extents,
        maxX: obj.x + extents,
        maxY: obj.y + extents,
      };
    }

    case 'text': {
      const textStr = obj.text ?? '';
      const lines = textStr.split('\n');
      const maxLen = Math.max(...lines.map((l) => l.length), 1);
      const fontSize = obj.fontSize ?? 200;
      
      const estimatedW = fontSize * maxLen * 0.65;
      const estimatedH = fontSize * lines.length * 1.2;

      let offsetX = 0;
      if (obj.align === 'center') {
        offsetX = -estimatedW / 2;
      } else if (obj.align === 'right') {
        offsetX = -estimatedW;
      }

      // Estimate baseline y offset
      const minY = obj.y - fontSize;
      const maxY = obj.y + estimatedH - fontSize;

      return {
        minX: obj.x + offsetX,
        minY: minY,
        maxX: obj.x + offsetX + estimatedW,
        maxY: maxY,
      };
    }

    default:
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
};

/**
 * Checks if two bounding boxes intersect.
 */
export const rectsIntersect = (a: BoundingBox, b: BoundingBox): boolean => {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
};
