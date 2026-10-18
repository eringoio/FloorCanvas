import type { MapObject } from '../types/project';

interface Point {
  x: number;
  y: number;
}

export function rotatePoint(pt: Point, center: Point, angleDeg: number): Point {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function scalePoint(pt: Point, center: Point, scaleX: number, scaleY: number): Point {
  return {
    x: center.x + (pt.x - center.x) * scaleX,
    y: center.y + (pt.y - center.y) * scaleY,
  };
}

export function getObjectTransformPolicy(obj: MapObject): { allowStretch: boolean; lockAspectRatio: boolean } {
  // Check explicit properties first if they exist
  const customObj = obj as any;
  if (customObj.allowStretch !== undefined || customObj.lockAspectRatio !== undefined) {
    return {
      allowStretch: customObj.allowStretch ?? !(customObj.lockAspectRatio ?? true),
      lockAspectRatio: customObj.lockAspectRatio ?? !(customObj.allowStretch ?? false),
    };
  }

  // Type-based defaults
  switch (obj.type) {
    case 'wall':
    case 'room':
    case 'dimension':
    case 'stair':
      return { allowStretch: true, lockAspectRatio: false };
    case 'furniture':
    case 'text':
    case 'door':
    case 'window':
    case 'background':
    case 'column':
    case 'shape':
    default:
      return { allowStretch: false, lockAspectRatio: true };
  }
}

export function transformObject(
  obj: MapObject,
  transform: {
    type: 'move' | 'rotate' | 'scale';
    dx?: number;
    dy?: number;
    center?: Point;
    angleDeg?: number;
    scaleX?: number;
    scaleY?: number;
    freeStretch?: boolean;
  }
): MapObject {
  const newObj = JSON.parse(JSON.stringify(obj)) as any;

  if (transform.type === 'move') {
    const dx = transform.dx ?? 0;
    const dy = transform.dy ?? 0;
    
    if ('x1' in newObj && typeof newObj.x1 === 'number') {
      newObj.x1 += dx;
      newObj.x2 += dx;
      newObj.y1 += dy;
      newObj.y2 += dy;
    } else {
      newObj.x += dx;
      newObj.y += dy;
    }

    if (newObj.points && Array.isArray(newObj.points)) {
      newObj.points = newObj.points.map((pt: Point) => ({
        x: pt.x + dx,
        y: pt.y + dy,
      }));
    }
    return newObj;
  }

  if (transform.type === 'rotate') {
    const center = transform.center ?? { x: 0, y: 0 };
    const angleDeg = transform.angleDeg ?? 0;

    if ('x1' in newObj && typeof newObj.x1 === 'number') {
      const p1 = rotatePoint({ x: newObj.x1, y: newObj.y1 }, center, angleDeg);
      const p2 = rotatePoint({ x: newObj.x2, y: newObj.y2 }, center, angleDeg);
      newObj.x1 = Math.round(p1.x);
      newObj.y1 = Math.round(p1.y);
      newObj.x2 = Math.round(p2.x);
      newObj.y2 = Math.round(p2.y);
    } else {
      const newPt = rotatePoint({ x: newObj.x, y: newObj.y }, center, angleDeg);
      newObj.x = Math.round(newPt.x);
      newObj.y = Math.round(newPt.y);
      newObj.rotation = Math.round(((newObj.rotation ?? 0) + angleDeg + 360) % 360);
    }

    if (newObj.points && Array.isArray(newObj.points)) {
      newObj.points = newObj.points.map((pt: Point) => {
        const rotated = rotatePoint(pt, center, angleDeg);
        return { x: Math.round(rotated.x), y: Math.round(rotated.y) };
      });
    }
    return newObj;
  }

  if (transform.type === 'scale') {
    const center = transform.center ?? { x: 0, y: 0 };
    const scaleX = transform.scaleX ?? 1;
    const scaleY = transform.scaleY ?? 1;
    const freeStretch = transform.freeStretch ?? false;

    const policy = getObjectTransformPolicy(obj);
    const canStretch = freeStretch && policy.allowStretch;

    if ('x1' in newObj && typeof newObj.x1 === 'number') {
      // Line-like scale
      const p1 = scalePoint({ x: newObj.x1, y: newObj.y1 }, center, scaleX, scaleY);
      const p2 = scalePoint({ x: newObj.x2, y: newObj.y2 }, center, scaleX, scaleY);
      newObj.x1 = Math.round(p1.x);
      newObj.y1 = Math.round(p1.y);
      newObj.x2 = Math.round(p2.x);
      newObj.y2 = Math.round(p2.y);
    } else {
      // Box-like scale
      const newPt = scalePoint({ x: newObj.x, y: newObj.y }, center, scaleX, scaleY);
      newObj.x = Math.round(newPt.x);
      newObj.y = Math.round(newPt.y);

      const uScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));

      if (canStretch) {
        // Project scale factors onto local rotated axes of the box
        const angleRad = ((newObj.rotation ?? 0) * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        const localScaleX = Math.sqrt((scaleX * cos) ** 2 + (scaleY * sin) ** 2);
        const localScaleY = Math.sqrt((scaleX * -sin) ** 2 + (scaleY * cos) ** 2);

        if (newObj.width !== undefined) newObj.width = Math.round(newObj.width * localScaleX);
        if (newObj.height !== undefined) newObj.height = Math.round(newObj.height * localScaleY);
      } else {
        // Proportional scale
        if (newObj.width !== undefined) newObj.width = Math.round(newObj.width * uScale);
        if (newObj.height !== undefined) newObj.height = Math.round(newObj.height * uScale);
        
        if (newObj.type === 'text' && newObj.fontSize !== undefined) {
          newObj.fontSize = Math.round(newObj.fontSize * uScale);
        }
      }
    }

    if (newObj.points && Array.isArray(newObj.points)) {
      const uScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
      const sX = canStretch ? scaleX : (scaleX < 0 ? -uScale : uScale);
      const sY = canStretch ? scaleY : (scaleY < 0 ? -uScale : uScale);
      newObj.points = newObj.points.map((pt: Point) => {
        const scaled = scalePoint(pt, center, sX, sY);
        return { x: Math.round(scaled.x), y: Math.round(scaled.y) };
      });
    }
    return newObj;
  }

  return newObj;
}
