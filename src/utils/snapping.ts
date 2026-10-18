import type { MapObject } from '../types/project';
import { getObjectBounds } from './bounds';
import { normalizeDegrees, rotationForFrontVector, snapRotation } from './rotationSnap';
import { supportsWallFacing } from '../symbols/symbolMetadata';

export interface SnapGuide {
  type: 'x' | 'y' | 'wall' | 'point';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
  rotation?: number;
  wallId?: string;
  wallAngleDeg?: number;
  wallNormalDeg?: number;
  objectRotation?: number;
}

const SNAP_THRESHOLD = 150; // mm

export const snapToGrid = (val: number, gridSize: number): number => {
  return Math.round(val / gridSize) * gridSize;
};

// Projection of a point onto a line segment
export const getProjectionOnSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1, dist: Math.hypot(px - x1, py - y1), t: 0 };
  
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return {
    x: projX,
    y: projY,
    dist: Math.hypot(px - projX, py - projY),
    t
  };
};

/**
 * Perform all snapping calculations for a center-based object being dragged/placed.
 */
export const snapObject = (
  obj: MapObject,
  tentativeX: number,
  tentativeY: number,
  allObjects: MapObject[],
  layerLocked: Record<string, boolean>,
  grid: { snap: boolean; size: number }
): SnapResult => {
  let x = tentativeX;
  let y = tentativeY;
  const guides: SnapGuide[] = [];
  
  if (!grid.snap) {
    return { x, y, guides };
  }

  // 1. Snapping Door/Window to Walls
  if (obj.type === 'door' || obj.type === 'window') {
    let closestWall: any = null;
    let minDistance = Infinity;
    let bestProj: any = null;

    allObjects.forEach((other) => {
      if (other.type !== 'wall') return;
      if (other.visible === false) return;
      if (other.layerId && layerLocked[other.layerId]) return;

      const proj = getProjectionOnSegment(tentativeX, tentativeY, other.x1, other.y1, other.x2, other.y2);
      if (proj.dist < minDistance) {
        minDistance = proj.dist;
        closestWall = other;
        bestProj = proj;
      }
    });

    if (closestWall && minDistance < SNAP_THRESHOLD) {
      const wallDx = closestWall.x2 - closestWall.x1;
      const wallDy = closestWall.y2 - closestWall.y1;
      const wallAngleRad = Math.atan2(wallDy, wallDx);
      const wallAngleDeg = (wallAngleRad * 180 / Math.PI + 360) % 360;

      guides.push({
        type: 'wall',
        x1: closestWall.x1,
        y1: closestWall.y1,
        x2: closestWall.x2,
        y2: closestWall.y2,
        color: '#3b82f6'
      });

      return {
        x: bestProj.x,
        y: bestProj.y,
        guides,
        rotation: Math.round(wallAngleDeg),
        wallId: closestWall.id
      };
    }
  }

  // 2. Snapping to Wall Lines (generic snap center to wall, or back edge for wall-facing symbols)
  let snappedToWall = false;
  let wallAngleDeg: number | undefined;
  let wallNormalDeg: number | undefined;
  let objectRotation: number | undefined;
  if (obj.type === 'furniture' || obj.type === 'column') {
    let closestWall: any = null;
    let minDistance = Infinity;
    let bestProj: any = null;

    allObjects.forEach((other) => {
      if (other.type !== 'wall') return;
      if (other.visible === false) return;
      if (other.layerId && layerLocked[other.layerId]) return;

      const proj = getProjectionOnSegment(tentativeX, tentativeY, other.x1, other.y1, other.x2, other.y2);
      if (proj.dist < minDistance) {
        minDistance = proj.dist;
        closestWall = other;
        bestProj = proj;
      }
    });

    if (closestWall && minDistance < SNAP_THRESHOLD) {
      const wallDx = closestWall.x2 - closestWall.x1;
      const wallDy = closestWall.y2 - closestWall.y1;
      const wallAngleRad = Math.atan2(wallDy, wallDx);
      wallAngleDeg = normalizeDegrees(wallAngleRad * 180 / Math.PI);

      const normalA = { x: -Math.sin(wallAngleRad), y: Math.cos(wallAngleRad) };
      const normalB = { x: Math.sin(wallAngleRad), y: -Math.cos(wallAngleRad) };
      const objectVector = { x: tentativeX - bestProj.x, y: tentativeY - bestProj.y };
      const dotA = objectVector.x * normalA.x + objectVector.y * normalA.y;
      const dotB = objectVector.x * normalB.x + objectVector.y * normalB.y;
      const chosenNormal = dotA >= dotB ? normalA : normalB;

      x = bestProj.x;
      y = bestProj.y;
      if (obj.type === 'furniture' && supportsWallFacing(obj.furnitureType)) {
        const depth = obj.height || 0;
        x = bestProj.x + chosenNormal.x * (depth / 2);
        y = bestProj.y + chosenNormal.y * (depth / 2);
        wallNormalDeg = normalizeDegrees(Math.atan2(chosenNormal.y, chosenNormal.x) * 180 / Math.PI);
        objectRotation = snapRotation(rotationForFrontVector(wallNormalDeg), 10);
      }

      snappedToWall = true;
      guides.push({
        type: 'wall',
        x1: closestWall.x1,
        y1: closestWall.y1,
        x2: closestWall.x2,
        y2: closestWall.y2,
        color: '#3b82f6'
      });
    }
  }

  // 3. snapToObjectCenters / snapToObjectEdges
  if (!snappedToWall) {
    let snappedX = false;
    let snappedY = false;

    const bounds = getObjectBounds({ ...obj, x, y } as any);
    const halfW = (bounds.maxX - bounds.minX) / 2;
    const halfH = (bounds.maxY - bounds.minY) / 2;

    for (const other of allObjects) {
      if (other.id === obj.id) continue;
      if (other.visible === false) continue;
      if (other.layerId && layerLocked[other.layerId]) continue;
      
      const otherBounds = getObjectBounds(other);
      const otherCx = (otherBounds.minX + otherBounds.maxX) / 2;
      const otherCy = (otherBounds.minY + otherBounds.maxY) / 2;

      // --- Snapping X ---
      if (!snappedX) {
        if (Math.abs(x - otherCx) < SNAP_THRESHOLD) {
          x = otherCx;
          snappedX = true;
          guides.push({
            type: 'x',
            x1: otherCx,
            y1: Math.min(bounds.minY, otherBounds.minY) - 500,
            x2: otherCx,
            y2: Math.max(bounds.maxY, otherBounds.maxY) + 500,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.minX - otherBounds.minX) < SNAP_THRESHOLD) {
          x = otherBounds.minX + halfW;
          snappedX = true;
          guides.push({
            type: 'x',
            x1: otherBounds.minX,
            y1: Math.min(bounds.minY, otherBounds.minY) - 500,
            x2: otherBounds.minX,
            y2: Math.max(bounds.maxY, otherBounds.maxY) + 500,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.maxX - otherBounds.maxX) < SNAP_THRESHOLD) {
          x = otherBounds.maxX - halfW;
          snappedX = true;
          guides.push({
            type: 'x',
            x1: otherBounds.maxX,
            y1: Math.min(bounds.minY, otherBounds.minY) - 500,
            x2: otherBounds.maxX,
            y2: Math.max(bounds.maxY, otherBounds.maxY) + 500,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.minX - otherBounds.maxX) < SNAP_THRESHOLD) {
          x = otherBounds.maxX + halfW;
          snappedX = true;
          guides.push({
            type: 'x',
            x1: otherBounds.maxX,
            y1: Math.min(bounds.minY, otherBounds.minY) - 500,
            x2: otherBounds.maxX,
            y2: Math.max(bounds.maxY, otherBounds.maxY) + 500,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.maxX - otherBounds.minX) < SNAP_THRESHOLD) {
          x = otherBounds.minX - halfW;
          snappedX = true;
          guides.push({
            type: 'x',
            x1: otherBounds.minX,
            y1: Math.min(bounds.minY, otherBounds.minY) - 500,
            x2: otherBounds.minX,
            y2: Math.max(bounds.maxY, otherBounds.maxY) + 500,
            color: '#10b981'
          });
        }
      }

      // --- Snapping Y ---
      if (!snappedY) {
        if (Math.abs(y - otherCy) < SNAP_THRESHOLD) {
          y = otherCy;
          snappedY = true;
          guides.push({
            type: 'y',
            x1: Math.min(bounds.minX, otherBounds.minX) - 500,
            y1: otherCy,
            x2: Math.max(bounds.maxX, otherBounds.maxX) + 500,
            y2: otherCy,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.minY - otherBounds.minY) < SNAP_THRESHOLD) {
          y = otherBounds.minY + halfH;
          snappedY = true;
          guides.push({
            type: 'y',
            x1: Math.min(bounds.minX, otherBounds.minX) - 500,
            y1: otherBounds.minY,
            x2: Math.max(bounds.maxX, otherBounds.maxX) + 500,
            y2: otherBounds.minY,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.maxY - otherBounds.maxY) < SNAP_THRESHOLD) {
          y = otherBounds.maxY - halfH;
          snappedY = true;
          guides.push({
            type: 'y',
            x1: Math.min(bounds.minX, otherBounds.minX) - 500,
            y1: otherBounds.maxY,
            x2: Math.max(bounds.maxX, otherBounds.maxX) + 500,
            y2: otherBounds.maxY,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.minY - otherBounds.maxY) < SNAP_THRESHOLD) {
          y = otherBounds.maxY + halfH;
          snappedY = true;
          guides.push({
            type: 'y',
            x1: Math.min(bounds.minX, otherBounds.minX) - 500,
            y1: otherBounds.maxY,
            x2: Math.max(bounds.maxX, otherBounds.maxX) + 500,
            y2: otherBounds.maxY,
            color: '#10b981'
          });
        }
        else if (Math.abs(bounds.maxY - otherBounds.minY) < SNAP_THRESHOLD) {
          y = otherBounds.minY - halfH;
          snappedY = true;
          guides.push({
            type: 'y',
            x1: Math.min(bounds.minX, otherBounds.minX) - 500,
            y1: otherBounds.minY,
            x2: Math.max(bounds.maxX, otherBounds.maxX) + 500,
            y2: otherBounds.minY,
            color: '#10b981'
          });
        }
      }

      if (snappedX && snappedY) break;
    }

    if (!snappedX) {
      x = snapToGrid(x, grid.size);
    }
    if (!snappedY) {
      y = snapToGrid(y, grid.size);
    }
  }

  return { x, y, guides, wallAngleDeg, wallNormalDeg, objectRotation };
};

/**
 * Snaps a wall endpoint (x1, y1) or (x2, y2) to other wall endpoints.
 */
export const snapEndpoint = (
  ex: number,
  ey: number,
  allObjects: MapObject[],
  layerLocked: Record<string, boolean>,
  grid: { snap: boolean; size: number },
  excludeObjId?: string
): { x: number; y: number; guides: SnapGuide[] } => {
  let x = ex;
  let y = ey;
  const guides: SnapGuide[] = [];

  if (!grid.snap) {
    return { x, y, guides };
  }

  let snapped = false;

  // 1. Prioritize snapping to exact points (Wall endpoints, Room corners/midpoints, Column points)
  for (const other of allObjects) {
    if (other.visible === false) continue;
    if (other.layerId && layerLocked[other.layerId]) continue;

    // A. Wall Endpoints
    if (other.type === 'wall' && other.id !== excludeObjId) {
      const dist1 = Math.hypot(ex - other.x1, ey - other.y1);
      if (dist1 < SNAP_THRESHOLD) {
        x = other.x1;
        y = other.y1;
        snapped = true;
        guides.push({
          type: 'point',
          x1: other.x1,
          y1: other.y1,
          x2: other.x1,
          y2: other.y1,
          color: '#f59e0b'
        });
        break;
      }

      const dist2 = Math.hypot(ex - other.x2, ey - other.y2);
      if (dist2 < SNAP_THRESHOLD) {
        x = other.x2;
        y = other.y2;
        snapped = true;
        guides.push({
          type: 'point',
          x1: other.x2,
          y1: other.y2,
          x2: other.x2,
          y2: other.y2,
          color: '#f59e0b'
        });
        break;
      }
    }

    // B. Room corners and side midpoints
    if (other.type === 'room') {
      const room = other as any;
      const w = room.width;
      const h = room.height;
      const rad = (room.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localPts = [
        { x: -w/2, y: -h/2 }, // TL
        { x: w/2, y: -h/2 },  // TR
        { x: w/2, y: h/2 },   // BR
        { x: -w/2, y: h/2 },  // BL
        { x: 0, y: -h/2 },    // Top mid
        { x: w/2, y: 0 },     // Right mid
        { x: 0, y: h/2 },     // Bottom mid
        { x: -w/2, y: 0 },    // Left mid
      ];

      for (const pt of localPts) {
        const gx = room.x + pt.x * cos - pt.y * sin;
        const gy = room.y + pt.x * sin + pt.y * cos;
        const dist = Math.hypot(ex - gx, ey - gy);
        if (dist < SNAP_THRESHOLD) {
          x = gx;
          y = gy;
          snapped = true;
          guides.push({
            type: 'point',
            x1: gx,
            y1: gy,
            x2: gx,
            y2: gy,
            color: '#f59e0b'
          });
          break;
        }
      }
      if (snapped) break;
    }

    // C. Column corners & center
    if (other.type === 'column') {
      const col = other as any;
      const w = col.width;
      const h = col.height;
      const rad = (col.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localPts = [
        { x: 0, y: 0 },       // Center
        { x: -w/2, y: -h/2 }, // TL
        { x: w/2, y: -h/2 },  // TR
        { x: w/2, y: h/2 },   // BR
        { x: -w/2, y: h/2 },  // BL
      ];

      for (const pt of localPts) {
        const gx = col.x + pt.x * cos - pt.y * sin;
        const gy = col.y + pt.x * sin + pt.y * cos;
        const dist = Math.hypot(ex - gx, ey - gy);
        if (dist < SNAP_THRESHOLD) {
          x = gx;
          y = gy;
          snapped = true;
          guides.push({
            type: 'point',
            x1: gx,
            y1: gy,
            x2: gx,
            y2: gy,
            color: '#f59e0b'
          });
          break;
        }
      }
      if (snapped) break;
    }
  }

  // 2. Fall back to segment snapping (project onto wall segments or room boundary walls)
  if (!snapped) {
    for (const other of allObjects) {
      if (other.visible === false) continue;
      if (other.layerId && layerLocked[other.layerId]) continue;

      // Project onto standalone Wall lines
      if (other.type === 'wall' && other.id !== excludeObjId) {
        const proj = getProjectionOnSegment(ex, ey, other.x1, other.y1, other.x2, other.y2);
        if (proj.dist < SNAP_THRESHOLD) {
          x = proj.x;
          y = proj.y;
          snapped = true;
          guides.push({
            type: 'wall',
            x1: other.x1,
            y1: other.y1,
            x2: other.x2,
            y2: other.y2,
            color: '#3b82f6'
          });
          break;
        }
      }

      // Project onto Room walls
      if (other.type === 'room') {
        const room = other as any;
        const w = room.width;
        const h = room.height;
        const rad = (room.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Calculate global room corners
        const TL = { x: room.x - (w / 2) * cos - (-h / 2) * sin, y: room.y - (w / 2) * sin + (-h / 2) * cos };
        const TR = { x: room.x + (w / 2) * cos - (-h / 2) * sin, y: room.y + (w / 2) * sin + (-h / 2) * cos };
        const BR = { x: room.x + (w / 2) * cos - (h / 2) * sin, y: room.y + (w / 2) * sin + (h / 2) * cos };
        const BL = { x: room.x - (w / 2) * cos - (h / 2) * sin, y: room.y - (w / 2) * sin + (h / 2) * cos };

        const segments = [
          { p1: TL, p2: TR },
          { p1: TR, p2: BR },
          { p1: BR, p2: BL },
          { p1: BL, p2: TL },
        ];

        for (const seg of segments) {
          const proj = getProjectionOnSegment(ex, ey, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
          if (proj.dist < SNAP_THRESHOLD) {
            x = proj.x;
            y = proj.y;
            snapped = true;
            guides.push({
              type: 'wall',
              x1: seg.p1.x,
              y1: seg.p1.y,
              x2: seg.p2.x,
              y2: seg.p2.y,
              color: '#3b82f6'
            });
            break;
          }
        }
        if (snapped) break;
      }
    }
  }

  // 3. Fall back to grid snap if no object-based snap occurred
  if (!snapped) {
    x = snapToGrid(x, grid.size);
    y = snapToGrid(y, grid.size);
  }

  return { x, y, guides };
};
