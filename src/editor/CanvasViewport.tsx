import React, { useEffect, useState, useRef } from 'react';
import { PaperBoundary } from './PaperBoundary';
import { SvgCanvas } from './SvgCanvas';
import { FloatingCanvasControls } from './FloatingCanvasControls';
import { useProjectStore } from '../store/projectStore';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';
import type { MapObject, ShapeObject, TextObject } from '../types/project';
import { getPaperPixelSize } from '../utils/scale';
import { getObjectBounds, rectsIntersect } from '../utils/bounds';
import { createRoomObject } from '../utils/room';
import { snapEndpoint } from '../utils/snapping';
import type { Point } from '../utils/coordinates';
import { clientToPaperPoint, paperToWorldPoint, getPointInsidePaper } from '../utils/coordinates';
import { getStyle } from '../utils/style';

function isOrthogonalRectangle(pts: Point[]): boolean {
  const uniquePts = pts[pts.length - 1] && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < 10
    ? pts.slice(0, -1)
    : pts;
  if (uniquePts.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const p1 = uniquePts[i];
    const p2 = uniquePts[(i + 1) % 4];
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    if (dx > 25 && dy > 25) return false; // tolerate minor diagonal/offset
  }
  return true;
}

function calculatePolygonArea(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function calculatePolygonCentroid(pts: Point[]): Point {
  let cx = 0;
  let cy = 0;
  let area = 0;
  const uniquePts = pts[pts.length - 1] && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < 10
    ? pts.slice(0, -1)
    : pts;
  const n = uniquePts.length;
  if (n < 3) {
    const xs = uniquePts.map(p => p.x);
    const ys = uniquePts.map(p => p.y);
    return {
      x: xs.reduce((a, b) => a + b, 0) / (n || 1),
      y: ys.reduce((a, b) => a + b, 0) / (n || 1)
    };
  }
  for (let i = 0; i < n; i++) {
    const p1 = uniquePts[i];
    const p2 = uniquePts[(i + 1) % n];
    const factor = (p1.x * p2.y - p2.x * p1.y);
    area += factor;
    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
  }
  area = area / 2;
  if (Math.abs(area) < 0.1) {
    const xs = uniquePts.map(p => p.x);
    const ys = uniquePts.map(p => p.y);
    return {
      x: xs.reduce((a, b) => a + b, 0) / n,
      y: ys.reduce((a, b) => a + b, 0) / n
    };
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { x: Math.round(cx), y: Math.round(cy) };
}

interface DimensionPreviewProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pixelsPerUnit: number;
  snap: (v: number) => number;
}

const DimensionPreview: React.FC<DimensionPreviewProps> = ({ x1, y1, x2, y2, pixelsPerUnit, snap }) => {
  const stylePreset = useProjectStore((state) => state.project.stylePreset);
  const s = getStyle(stylePreset);

  const sx2 = snap(x2);
  const sy2 = snap(y2);
  
  const dx = sx2 - x1;
  const dy = sy2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const nx = -dy / len;
  const ny = dx / len;
  const offset = -800; // default offset

  const toPx = (v: number) => v * pixelsPerUnit;

  const px1 = toPx(x1 + nx * offset);
  const py1 = toPx(y1 + ny * offset);
  const px2 = toPx(sx2 + nx * offset);
  const py2 = toPx(sy2 + ny * offset);

  const midX = (px1 + px2) / 2;
  const midY = (py1 + py2) / 2;

  const angleRad = Math.atan2(dy, dx);
  let angleDeg = angleRad * (180 / Math.PI);
  if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

  const tickSize = 6;
  const ux = dx / len;
  const uy = dy / len;
  const tx = (ux - nx) * tickSize;
  const ty = (uy - ny) * tickSize;

  const strokeColor = stylePreset === 'architectural-reference' ? s.dimensionStroke : '#3b82f6';
  const extStrokeColor = stylePreset === 'architectural-reference' ? s.dimensionExtensionStroke : '#3b82f6';
  const labelColor = stylePreset === 'architectural-reference' ? s.labelFill : '#3b82f6';

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Extension lines */}
      <line x1={toPx(x1)} y1={toPx(y1)} x2={px1} y2={py1} stroke={extStrokeColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      <line x1={toPx(sx2)} y1={toPx(sy2)} x2={px2} y2={py2} stroke={extStrokeColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      
      {/* Dimension Line */}
      <line x1={px1} y1={py1} x2={px2} y2={py2} stroke={strokeColor} strokeWidth={1.5} strokeDasharray={stylePreset === 'architectural-reference' ? "3 3" : undefined} />
      
      {/* Ticks/Caps */}
      {stylePreset === 'architectural-reference' ? (
        <>
          <line x1={px1 - nx * 8} y1={py1 - ny * 8} x2={px1 + nx * 8} y2={py1 + ny * 8} stroke={strokeColor} strokeWidth={1.5} />
          <line x1={px2 - nx * 8} y1={py2 - ny * 8} x2={px2 + nx * 8} y2={py2 + ny * 8} stroke={strokeColor} strokeWidth={1.5} />
        </>
      ) : (
        <>
          <line x1={px1 - tx} y1={py1 - ty} x2={px1 + tx} y2={py1 + ty} stroke={strokeColor} strokeWidth={2} />
          <line x1={px2 - tx} y1={py2 - ty} x2={px2 + tx} y2={py2 + ty} stroke={strokeColor} strokeWidth={2} />
        </>
      )}

      {/* Label */}
      <g transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}>
        <rect x={-20} y={-9} width={40} height={14} fill="#ffffff" stroke={strokeColor} strokeWidth={0.5} rx={2} />
        <text
          fontSize="9px"
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          fill={labelColor}
          textAnchor="middle"
          dominantBaseline="middle"
          y={0}
        >
          {Math.round(len).toLocaleString()}
        </text>
      </g>
    </g>
  );
};

// Wall Preview Component
// Wall Preview Component
const WallPreview: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  pixelsPerUnit: number;
  snap: (v: number) => number;
  shiftKey: boolean;
  zoom: number;
}> = ({ x1, y1, x2, y2, thickness, pixelsPerUnit, snap, shiftKey, zoom }) => {
  let sx2 = snap(x2);
  let sy2 = snap(y2);

  if (shiftKey) {
    const dx = sx2 - x1;
    const dy = sy2 - y1;
    const angle = Math.atan2(dy, dx);
    // Round to nearest 45 degrees
    const constrainedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.sqrt(dx * dx + dy * dy);
    sx2 = snap(x1 + Math.cos(constrainedAngle) * dist);
    sy2 = snap(y1 + Math.sin(constrainedAngle) * dist);
  }

  const toPx = (v: number) => v * pixelsPerUnit;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <line
        x1={toPx(x1)}
        y1={toPx(y1)}
        x2={toPx(sx2)}
        y2={toPx(sy2)}
        stroke="#3b82f6"
        strokeWidth={toPx(thickness)}
        strokeOpacity={0.6}
        strokeLinecap="square"
      />
      <circle cx={toPx(x1)} cy={toPx(y1)} r={4 / zoom} fill="#3b82f6" />
      <circle cx={toPx(sx2)} cy={toPx(sy2)} r={4 / zoom} fill="#3b82f6" />
    </g>
  );
};

// Rect Preview Component
const RectPreview: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  pixelsPerUnit: number;
  snap: (v: number) => number;
  zoom: number;
}> = ({ x1, y1, x2, y2, thickness, pixelsPerUnit, snap, zoom }) => {
  const sx2 = snap(x2);
  const sy2 = snap(y2);
  
  const toPx = (v: number) => v * pixelsPerUnit;
  const tPx = toPx(thickness);

  return (
    <g style={{ pointerEvents: 'none' }}>
      <line x1={toPx(x1)} y1={toPx(y1)} x2={toPx(sx2)} y2={toPx(y1)} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.5} strokeLinecap="square" />
      <line x1={toPx(sx2)} y1={toPx(y1)} x2={toPx(sx2)} y2={toPx(sy2)} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.5} strokeLinecap="square" />
      <line x1={toPx(sx2)} y1={toPx(sy2)} x2={toPx(x1)} y2={toPx(sy2)} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.5} strokeLinecap="square" />
      <line x1={toPx(x1)} y1={toPx(sy2)} x2={toPx(x1)} y2={toPx(y1)} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.5} strokeLinecap="square" />
      <circle cx={toPx(x1)} cy={toPx(y1)} r={4 / zoom} fill="#3b82f6" />
      <circle cx={toPx(sx2)} cy={toPx(sy2)} r={4 / zoom} fill="#3b82f6" />
    </g>
  );
};

// Room Preview Component
const RoomPreview: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  pixelsPerUnit: number;
  snap: (v: number) => number;
  zoom: number;
}> = ({ x1, y1, x2, y2, thickness, pixelsPerUnit, snap, zoom }) => {
  const sx2 = snap(x2);
  const sy2 = snap(y2);
  
  const toPx = (v: number) => v * pixelsPerUnit;
  const tPx = toPx(thickness);

  const px1 = toPx(x1);
  const py1 = toPx(y1);
  const px2 = toPx(sx2);
  const py2 = toPx(sy2);

  const w = Math.abs(px2 - px1);
  const h = Math.abs(py2 - py1);
  const minX = Math.min(px1, px2);
  const minY = Math.min(py1, py2);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Translucent fill */}
      <rect
        x={minX}
        y={minY}
        width={w}
        height={h}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="none"
      />
      {/* Wall outlines */}
      <line x1={px1} y1={py1} x2={px2} y2={py1} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.6} strokeLinecap="square" />
      <line x1={px2} y1={py1} x2={px2} y2={py2} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.6} strokeLinecap="square" />
      <line x1={px2} y1={py2} x2={px1} y2={py2} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.6} strokeLinecap="square" />
      <line x1={px1} y1={py2} x2={px1} y2={py1} stroke="#3b82f6" strokeWidth={tPx} strokeOpacity={0.6} strokeLinecap="square" />
      <circle cx={px1} cy={py1} r={4 / zoom} fill="#3b82f6" />
      <circle cx={px2} cy={py2} r={4 / zoom} fill="#3b82f6" />
    </g>
  );
};

export const CanvasViewport: React.FC = () => {
  const { t } = useI18n();
  const canvas = useProjectStore((state) => state.project.canvas);
  const scale = useProjectStore((state) => state.project.scale);
  const objects = useProjectStore((state) => state.project.objects);
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const zoom = useProjectStore((state) => state.zoom);
  const pan = useProjectStore((state) => state.pan);
  
  const clearSelection = useProjectStore((state) => state.clearSelection);
  const deleteObject = useProjectStore((state) => state.deleteObject);
  const addObject = useProjectStore((state) => state.addObject);
  const setSelectedIds = useProjectStore((state) => state.setSelectedIds);
  const deleteObjects = useProjectStore((state) => state.deleteObjects);
  const duplicateObjects = useProjectStore((state) => state.duplicateObjects);
  const nudgeObjects = useProjectStore((state) => state.nudgeObjects);
  const setZoom = useProjectStore((state) => state.setZoom);
  const setPan = useProjectStore((state) => state.setPan);
  const setCursorCoords = useProjectStore((state) => state.setCursorCoords);
  const viewTrigger = useProjectStore((state) => state.viewTrigger);
  const triggerCenterView = useProjectStore((state) => state.triggerCenterView);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const copySelectedObjects = useProjectStore((state) => state.copySelectedObjects);
  const cutSelectedObjects = useProjectStore((state) => state.cutSelectedObjects);
  const pasteClipboard = useProjectStore((state) => state.pasteClipboard);

  // Calibration store states
  const isCalibrating = useProjectStore((state) => state.isCalibrating);
  const calibrationPoints = useProjectStore((state) => state.calibrationPoints);
  const addCalibrationPoint = useProjectStore((state) => state.addCalibrationPoint);
  const cancelCalibration = useProjectStore((state) => state.cancelCalibration);
  const applyCalibration = useProjectStore((state) => state.applyCalibration);

  // Drawing tool states
  const activeTool = useProjectStore((state) => state.activeTool);
  const setActiveTool = useProjectStore((state) => state.setActiveTool);
  const currentWallConfig = useProjectStore((state) => state.currentWallConfig);
  
  // Grid & snap states
  const grid = useProjectStore((state) => state.project.grid);
  const setGrid = useProjectStore((state) => state.setGrid);
  const updateObjectWithHistory = useProjectStore((state) => state.updateObjectWithHistory);
  const updateObjectDirect = useProjectStore((state) => state.updateObject);
  const convertWallsToRoom = useProjectStore((state) => state.convertWallsToRoom);
  const cursorCoords = useProjectStore((state) => state.cursorCoords);

  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoverPaperPoint, setHoverPaperPoint] = useState<Point | null>(null);
  const suppressNextCanvasClick = useRef(false);

  type DrawingSession =
    | {
        tool: 'wall' | 'room' | 'rect' | 'dimension' | 'poly_wall';
        startWorld: Point;
        currentWorld: Point;
        hasMoved: boolean;
      }
    | null;
  const [drawingSession, setDrawingSession] = useState<DrawingSession>(null);
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [polyWallIds, setPolyWallIds] = useState<string[]>([]);

  // Calibration Modal inputs
  const [calDistance, setCalDistance] = useState('4600');
  const [calUnit, setCalUnit] = useState<'mm' | 'cm' | 'm'>('mm');
  const hasBackground = objects.some(o => o.type === 'background');
  const [calTarget, setCalTarget] = useState<'background' | 'project'>('background');

  useEffect(() => {
    if (!hasBackground) {
      setCalTarget('project');
    } else {
      setCalTarget('background');
    }
  }, [hasBackground]);

  const pixelSize = getPaperPixelSize(canvas, scale);
  const widthPx = pixelSize.width;
  const heightPx = pixelSize.height;

  const snapVal = (v: number) => {
    return grid.snap ? Math.round(v / grid.size) * grid.size : Math.round(v);
  };



  // Pan and Click handler
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCalibrating) return;
    if (activeTool !== 'select' && activeTool !== 'pan') return;

    const isTouch = e.pointerType === 'touch';
    const isMiddleButton = e.button === 1;
    const isLeftButton = e.button === 0;

    if (
      isMiddleButton || 
      (isLeftButton && (isSpacePressed || activeTool === 'pan')) ||
      (isTouch && activeTool === 'select')
    ) {
      e.preventDefault();
      setIsDragging(true);
      
      const startX = e.clientX;
      const startY = e.clientY;
      const initialPan = { ...pan };

      const handleMouseMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        setPan({
          x: initialPan.x + deltaX,
          y: initialPan.y + deltaY,
        });
      };

      const handleMouseUp = (upEvent: PointerEvent) => {
        setIsDragging(false);
        window.removeEventListener('pointermove', handleMouseMove);
        window.removeEventListener('pointerup', handleMouseUp);

        // If touch, check if it's a simple tap (no drag movement)
        if (isTouch) {
          const deltaX = upEvent.clientX - startX;
          const deltaY = upEvent.clientY - startY;
          const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dist < 5) {
            clearSelection();
          }
        }
      };

      window.addEventListener('pointermove', handleMouseMove);
      window.addEventListener('pointerup', handleMouseUp);
      return;
    }

    // Left click on empty canvas in Select tool starts marquee selection!
    if (isLeftButton && activeTool === 'select') {
      if (paperRef.current) {
        const paperPt = clientToPaperPoint(e, paperRef.current, zoom);
        const px = paperPt.x;
        const py = paperPt.y;
        
        setMarqueeStart({ x: px, y: py });
        setMarqueeEnd({ x: px, y: py });

        const handleMouseMoveMarquee = (moveEvent: PointerEvent) => {
          if (!paperRef.current) return;
          const currentPaperPt = clientToPaperPoint(moveEvent, paperRef.current, zoom);
          setMarqueeEnd({ x: currentPaperPt.x, y: currentPaperPt.y });
        };

        const handleMouseUpMarquee = (upEvent: PointerEvent) => {
          window.removeEventListener('pointermove', handleMouseMoveMarquee);
          window.removeEventListener('pointerup', handleMouseUpMarquee);

          if (!paperRef.current) return;
          const finalPaperPt = clientToPaperPoint(upEvent, paperRef.current, zoom);
          const ux = finalPaperPt.x;
          const uy = finalPaperPt.y;

          // Determine marquee rectangle in paper pixels
          const minX = Math.min(px, ux);
          const maxX = Math.max(px, ux);
          const minY = Math.min(py, uy);
          const maxY = Math.max(py, uy);

          const width = maxX - minX;
          const height = maxY - minY;

          // Clear marquee state
          setMarqueeStart(null);
          setMarqueeEnd(null);

          // If the drag distance is very tiny (e.g. < 5px), treat as normal background click (clear selection)
          if (width < 5 && height < 5) {
            if (!upEvent.shiftKey && !upEvent.ctrlKey && !upEvent.metaKey) {
              clearSelection();
            }
            return;
          }

          // Convert marquee box to real-world units (mm)
          const marqueeBoxReal = {
            minX: minX / scale.pixelsPerUnit,
            minY: minY / scale.pixelsPerUnit,
            maxX: maxX / scale.pixelsPerUnit,
            maxY: maxY / scale.pixelsPerUnit,
          };

          // Find intersecting unlocked elements not on locked layers and not hidden
          const layerLockMap: Record<string, boolean> = {};
          const layerVisMap: Record<string, boolean> = {};
          useProjectStore.getState().project.layers.forEach((l) => {
            layerLockMap[l.id] = l.locked;
            layerVisMap[l.id] = l.visible;
          });

          const selectableObjects = useProjectStore.getState().project.objects.filter((obj) => {
            // Exclude hidden objects or hidden layers
            if (obj.visible === false) return false;
            if (obj.layerId && layerVisMap[obj.layerId] === false) return false;
            // Exclude locked layers/objects
            if (obj.locked) return false;
            if (obj.layerId && layerLockMap[obj.layerId]) return false;
            
            // Check intersection
            const objBounds = getObjectBounds(obj);
            return rectsIntersect(marqueeBoxReal, objBounds);
          });

          const selectableIds = selectableObjects.map((o) => o.id);

          // Apply modifier keys:
          const isShift = upEvent.shiftKey;
          const isAlt = upEvent.altKey;
          const isCtrlOrCmd = upEvent.ctrlKey || upEvent.metaKey;

          const currentSelectedIds = useProjectStore.getState().selectedIds;

          if (isShift) {
            // Add to selection (union)
            const newSelection = Array.from(new Set([...currentSelectedIds, ...selectableIds]));
            setSelectedIds(newSelection);
          } else if (isAlt) {
            // Subtract from selection
            const newSelection = currentSelectedIds.filter((id) => !selectableIds.includes(id));
            setSelectedIds(newSelection);
          } else if (isCtrlOrCmd) {
            // Toggle selection for marquee items
            const newSelection = [...currentSelectedIds];
            selectableIds.forEach((id) => {
              const idx = newSelection.indexOf(id);
              if (idx > -1) {
                newSelection.splice(idx, 1);
              } else {
                newSelection.push(id);
              }
            });
            setSelectedIds(newSelection);
          } else {
            // Replace selection
            setSelectedIds(selectableIds);
          }
        };

        window.addEventListener('pointermove', handleMouseMoveMarquee);
        window.addEventListener('pointerup', handleMouseUpMarquee);
      }
    }

    if (e.target === e.currentTarget) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearSelection();
      }
    }
  };

  // Intercept click on canvas for scale calibration
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (suppressNextCanvasClick.current) {
      suppressNextCanvasClick.current = false;
      return;
    }
    if (paperRef.current) {
      const paperPt = clientToPaperPoint(e, paperRef.current, zoom);
      const px = paperPt.x;
      const py = paperPt.y;

      if (isCalibrating) {
        addCalibrationPoint({ x: px, y: py });
        return;
      }
    }
    
    if (e.target === e.currentTarget) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearSelection();
      }
    }
  };

  // Cursor coordinates tracker
  const handlePointerMoveCoords = (e: React.PointerEvent) => {
    if (paperRef.current) {
      const paperPt = clientToPaperPoint(e, paperRef.current, zoom);
      const paperX = paperPt.x;
      const paperY = paperPt.y;

      const worldPt = paperToWorldPoint(paperPt, scale.pixelsPerUnit);
      let realX = Math.round(worldPt.x);
      let realY = Math.round(worldPt.y);

      if (grid.snap && activeTool !== 'select' && activeTool !== 'pan' && !isCalibrating) {
        const layerLockMap: Record<string, boolean> = {};
        useProjectStore.getState().project.layers.forEach((l) => {
          layerLockMap[l.id] = l.locked;
        });
        const objects = useProjectStore.getState().project.objects;
        const snapRes = snapEndpoint(realX, realY, objects, layerLockMap, grid);
        realX = snapRes.x;
        realY = snapRes.y;
      }

      const inside = getPointInsidePaper(paperPt, widthPx, heightPx);
      setCursorCoords({ x: realX, y: realY, inside });

      if (isCalibrating) {
        setHoverPaperPoint({ x: paperX, y: paperY });
      }
    }
  };

  const handleDrawingPointerDown = (e: React.PointerEvent) => {
    if (isCalibrating) return;
    if (activeTool === 'select' || activeTool === 'pan') return;

    if (paperRef.current) {
      const paperPt = clientToPaperPoint(e, paperRef.current, zoom);
      const worldPt = paperToWorldPoint(paperPt, scale.pixelsPerUnit);
      
      const layerLockMap: Record<string, boolean> = {};
      useProjectStore.getState().project.layers.forEach((l) => {
        layerLockMap[l.id] = l.locked;
      });
      const snapRes = snapEndpoint(worldPt.x, worldPt.y, objects, layerLockMap, grid);
      const snapPt = { x: snapRes.x, y: snapRes.y };

      if (activeTool === 'poly_wall') {
        const currentPts = [...polyPoints];
        if (currentPts.length === 0) {
          setPolyPoints([snapPt]);
          setDrawingSession({
            tool: 'poly_wall' as any,
            startWorld: snapPt,
            currentWorld: snapPt,
            hasMoved: false,
          });
        } else {
          // Check if closing loop to the start point (tolerance 250mm)
          const isCloseToStart = currentPts.length >= 3 && Math.hypot(snapPt.x - currentPts[0].x, snapPt.y - currentPts[0].y) < 250;
          const targetPt = isCloseToStart ? currentPts[0] : snapPt;

          const wId = `wall_poly_${Date.now()}`;
          const newWall = {
            id: wId,
            type: 'wall',
            layerId: currentWallConfig.layerId || 'layer_structural_walls',
            x1: currentPts[currentPts.length - 1].x,
            y1: currentPts[currentPts.length - 1].y,
            x2: targetPt.x,
            y2: targetPt.y,
            thickness: currentWallConfig.thickness || 180,
            rotation: 0,
            visible: true,
            locked: false,
            style: currentWallConfig.style || 'exterior',
          } as MapObject;

          addObject(newWall);

          const nextPts = [...currentPts, targetPt];
          const nextWallIds = [...polyWallIds, wId];

          if (isCloseToStart) {
            const isRect = isOrthogonalRectangle(nextPts);
            if (isRect) {
              const xs = nextPts.map(p => p.x);
              const ys = nextPts.map(p => p.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);

              const w = maxX - minX;
              const h = maxY - minY;
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;

              const roomId = `room_${Date.now()}`;
              const newRoom = createRoomObject({
                id: roomId,
                layerId: currentWallConfig.layerId || 'layer_structural_walls',
                x: cx,
                y: cy,
                width: w,
                height: h,
                thickness: currentWallConfig.thickness || 180,
                style: (currentWallConfig.style as any) || 'exterior',
              });

              convertWallsToRoom(nextWallIds, newRoom, true);
            } else {
              // Irregular room shape: Keep walls, create background polygon floor fill + room text label
              const area = calculatePolygonArea(nextPts);
              const areaM2 = (area / 1000000).toFixed(1);
              const centroid = calculatePolygonCentroid(nextPts);

              const floorShape: ShapeObject = {
                id: `shape_polygon_${Date.now()}`,
                type: 'shape',
                shapeType: 'polygon',
                layerId: 'layer_structural_walls',
                visible: true,
                locked: false,
                rotation: 0,
                points: nextPts.slice(0, -1),
                fill: 'rgba(241, 245, 249, 0.45)',
                stroke: 'none',
              };

              const labelText: TextObject = {
                id: `text_room_${Date.now()}`,
                type: 'text',
                layerId: 'layer_room_labels',
                visible: true,
                locked: false,
                rotation: 0,
                x: centroid.x,
                y: centroid.y,
                text: `Room\n${areaM2} ㎡`,
                fontSize: 350,
                align: 'center',
              };

              addObject(floorShape);
              addObject(labelText);
            }

            setPolyPoints([]);
            setPolyWallIds([]);
            setDrawingSession(null);
            setActiveTool('select');
          } else {
            setPolyPoints(nextPts);
            setPolyWallIds(nextWallIds);
            setDrawingSession({
              tool: 'poly_wall' as any,
              startWorld: targetPt,
              currentWorld: targetPt,
              hasMoved: false,
            });
          }
        }
        return;
      }
      
      const startPt = { x: snapRes.x, y: snapRes.y };
      
      setDrawingSession({
        tool: activeTool as any,
        startWorld: startPt,
        currentWorld: startPt,
        hasMoved: false,
      });
      
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const handleDrawingPointerMove = (e: React.PointerEvent) => {
    if (isCalibrating) return;
    if (!drawingSession) return;

    if (paperRef.current) {
      const paperPt = clientToPaperPoint(e, paperRef.current, zoom);
      const worldPt = paperToWorldPoint(paperPt, scale.pixelsPerUnit);
      
      const layerLockMap: Record<string, boolean> = {};
      useProjectStore.getState().project.layers.forEach((l) => {
        layerLockMap[l.id] = l.locked;
      });
      
      const snapRes = snapEndpoint(worldPt.x, worldPt.y, objects, layerLockMap, grid);
      let currentPt = { x: snapRes.x, y: snapRes.y };

      if (drawingSession.tool === 'wall' && (e.shiftKey || isShiftPressed)) {
        const dx = currentPt.x - drawingSession.startWorld.x;
        const dy = currentPt.y - drawingSession.startWorld.y;
        const angle = Math.atan2(dy, dx);
        const constrainedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        currentPt = {
          x: snapVal(drawingSession.startWorld.x + Math.cos(constrainedAngle) * dist),
          y: snapVal(drawingSession.startWorld.y + Math.sin(constrainedAngle) * dist),
        };
      }

      setDrawingSession({
        ...drawingSession,
        currentWorld: currentPt,
        hasMoved: true,
      });
    }
  };

  const handleDrawingPointerUp = (e: React.PointerEvent) => {
    if (isCalibrating) return;
    if (!drawingSession) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}

    const { tool, startWorld, currentWorld } = drawingSession;
    setDrawingSession(null);

    if (tool === 'poly_wall') {
      return;
    }

    const dx = currentWorld.x - startWorld.x;
    const dy = currentWorld.y - startWorld.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (tool === 'dimension') {
      const newId = `dimension_${Date.now()}`;
      const newDim = {
        id: newId,
        type: 'dimension',
        layerId: 'layer_dimensions',
        x1: startWorld.x,
        y1: startWorld.y,
        x2: currentWorld.x,
        y2: currentWorld.y,
        offset: -800,
        unit: 'mm',
        autoValue: Math.round(len),
        displayText: '',
        textOverride: false,
        rotation: 0,
        visible: true,
        locked: false,
      } as MapObject;

      addObject(newDim);
      setSelectedIds([newId]);
      setActiveTool('select');
    } else if (tool === 'wall') {
      const newId = `wall_${Date.now()}`;
      const newWall = {
        id: newId,
        type: 'wall',
        layerId: currentWallConfig.layerId,
        x1: startWorld.x,
        y1: startWorld.y,
        x2: currentWorld.x,
        y2: currentWorld.y,
        thickness: currentWallConfig.thickness,
        rotation: 0,
        visible: true,
        locked: false,
        style: currentWallConfig.style,
      } as MapObject;

      addObject(newWall);
      setSelectedIds([newId]);
      setActiveTool('select');
    } else if (tool === 'rect') {
      const timestamp = Date.now();
      const wallsData = [
        { x1: startWorld.x, y1: startWorld.y, x2: currentWorld.x, y2: startWorld.y },
        { x1: currentWorld.x, y1: startWorld.y, x2: currentWorld.x, y2: currentWorld.y },
        { x1: currentWorld.x, y1: currentWorld.y, x2: startWorld.x, y2: currentWorld.y },
        { x1: startWorld.x, y1: currentWorld.y, x2: startWorld.x, y2: startWorld.y },
      ];

      const createdIds: string[] = [];
      wallsData.forEach((wData, index) => {
        if (wData.x1 === wData.x2 && wData.y1 === wData.y2) return;

        const wId = `wall_${timestamp}_${index}`;
        const newWall = {
          id: wId,
          type: 'wall',
          layerId: currentWallConfig.layerId,
          x1: wData.x1,
          y1: wData.y1,
          x2: wData.x2,
          y2: wData.y2,
          thickness: currentWallConfig.thickness,
          rotation: 0,
          visible: true,
          locked: false,
          style: currentWallConfig.style,
        } as MapObject;

        addObject(newWall);
        createdIds.push(wId);
      });

      if (createdIds.length > 0) {
        setSelectedIds([createdIds[0]]);
      }
      setActiveTool('select');
    } else if (tool === 'room') {
      const newId = `room_${Date.now()}`;
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      const cx = (startWorld.x + currentWorld.x) / 2;
      const cy = (startWorld.y + currentWorld.y) / 2;

      const newRoom = createRoomObject({
        id: newId,
        layerId: currentWallConfig.layerId || 'layer_structural_walls',
        x: cx,
        y: cy,
        width: w,
        height: h,
        thickness: currentWallConfig.thickness || 180,
        style: (currentWallConfig.style as any) || 'exterior',
      });

      addObject(newRoom);
      setSelectedIds([newId]);
      setActiveTool('select');
    }
  };

  const handleDrawingPointerCancel = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setDrawingSession(null);
  };

  // Key Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      // Bypass shortcut trigger if typing inside text fields, textareas, selects, or contenteditables
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // Undo / Redo Shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl + S: Save Project
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app-save'));
        return;
      }

      // G: Toggle Grid
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setGrid({ visible: !grid.visible });
        return;
      }

      // S: Toggle Snap
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setGrid({ snap: !grid.snap });
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if (e.key === 'Escape') {
        if (isCalibrating) {
          cancelCalibration();
        } else if (activeTool !== 'select') {
          setActiveTool('select');
        } else {
          clearSelection();
        }
        return;
      }

      // Tool Switching & Text Spawning Shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') {
          e.preventDefault();
          setActiveTool('select');
          return;
        }
        if (key === 'h') {
          e.preventDefault();
          setActiveTool('pan');
          return;
        }
        if (key === 'w') {
          e.preventDefault();
          setActiveTool('wall');
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          setActiveTool('dimension');
          return;
        }
        if (key === 't') {
          e.preventDefault();
          const timestamp = Date.now();
          const newObj = {
            id: `text_${timestamp}`,
            type: 'text',
            layerId: 'layer_labels',
            x: cursorCoords.x,
            y: cursorCoords.y,
            text: 'Text Label',
            fontSize: 240,
            fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
            fontWeight: '400',
            align: 'center',
            rotation: 0,
            keepUpright: true,
            visible: true,
            locked: false,
          } as MapObject;
          addObject(newObj);
          setSelectedIds([newObj.id]);
          return;
        }
      }

      // Arrow Keys: Nudge Selected Objects
      const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      if (isArrowKey && selectedIds.length > 0 && activeTool === 'select') {
        e.preventDefault();
        
        const step = e.shiftKey ? 500 : 100;
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        nudgeObjects(selectedIds, dx, dy);
        return;
      }

      // Ctrl + C: Copy selected objects
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedIds.length > 0 && !isCalibrating) {
        e.preventDefault();
        copySelectedObjects();
        return;
      }

      // Ctrl + X: Cut selected objects
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedIds.length > 0 && !isCalibrating) {
        e.preventDefault();
        cutSelectedObjects();
        return;
      }

      // Ctrl + V: Paste clipboard objects
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isCalibrating) {
        e.preventDefault();
        pasteClipboard();
        return;
      }

      if (selectedIds.length === 0 || isCalibrating || activeTool !== 'select') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteObjects(selectedIds);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateObjects(selectedIds);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, objects, deleteObject, addObject, setSelectedIds, clearSelection, isCalibrating, cancelCalibration, activeTool, setActiveTool, undo, redo, grid, setGrid, updateObjectWithHistory, cursorCoords, copySelectedObjects, cutSelectedObjects, pasteClipboard, drawingSession]);

  // When activeTool changes, clear drawing session
  useEffect(() => {
    setDrawingSession(null);
  }, [activeTool]);

  // Native wheel zoom listener to prevent default page zoom/scroll
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = 1.15;
      const state = useProjectStore.getState();
      const currentZoom = state.zoom;
      const currentPan = state.pan;
      const nextZoom = e.deltaY < 0 ? currentZoom * zoomFactor : currentZoom / zoomFactor;
      const clampedZoom = Math.max(0.05, Math.min(8.0, nextZoom));

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPan = {
        x: mouseX - (mouseX - currentPan.x) * (clampedZoom / currentZoom),
        y: mouseY - (mouseY - currentPan.y) * (clampedZoom / currentZoom),
      };
      
      setZoom(clampedZoom);
      setPan(newPan);
    };

    viewport.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleNativeWheel);
    };
  }, [setZoom, setPan]);

  // Track viewport dimensions to trigger refitting when it resizes
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        setViewportWidth(rect.width);
        setViewportHeight(rect.height);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Center and fit paper on mount, viewport size change, paper size changes, or viewTrigger
  useEffect(() => {
    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const isSmallScreen = window.innerWidth < 768;
      const padding = isSmallScreen ? 24 : 80;

      const fitZoom = Math.min(
        1,
        (rect.width - padding * 2) / widthPx,
        (rect.height - padding * 2) / heightPx
      );

      const safeZoom = Math.max(0.05, Math.min(8, fitZoom));

      setZoom(safeZoom);
      setPan({
        x: (rect.width - widthPx * safeZoom) / 2,
        y: (rect.height - heightPx * safeZoom) / 2,
      });
    }
  }, [widthPx, heightPx, setPan, setZoom, viewTrigger, viewportWidth, viewportHeight]);

  const zoomIn = () => {
    setZoom(Math.min(8.0, zoom * 1.15));
  };

  const zoomOut = () => {
    setZoom(Math.max(0.05, zoom / 1.15));
  };

  const handleApplyCalibration = () => {
    let distance = parseFloat(calDistance);
    if (isNaN(distance) || distance <= 0) return;
    if (calUnit === 'cm') distance *= 10;
    else if (calUnit === 'm') distance *= 1000;

    applyCalibration(distance, calTarget);
  };

  const getCursorStyle = () => {
    if (isCalibrating) return 'crosshair';
    if (isSpacePressed || activeTool === 'pan') {
      return isDragging ? 'grabbing' : 'grab';
    }
    if (activeTool !== 'select') return 'crosshair';
    return 'default';
  };

  return (
    <main 
      className="canvas-viewport" 
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMoveCoords}
      style={{
        cursor: getCursorStyle(),
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {activeTool === 'room' && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 500,
          zIndex: 10,
          pointerEvents: 'none',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Icons.RoomIcon size={16} />
          <span>{t('canvas.roomHelp')}</span>
        </div>
      )}

      {activeTool === 'poly_wall' && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '24px',
          fontSize: '13px',
          fontWeight: 500,
          zIndex: 100,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <Icons.StraightWallIcon size={16} />
          <span>
            {polyPoints.length === 0 
              ? "Click on the canvas to place the first point of the room" 
              : `Click next point. Drag to preview. Click start (red point) to close loop.`}
          </span>
          {polyPoints.length >= 3 && (
            <button
              className="toolbar-btn"
              style={{
                height: '24px',
                fontSize: '11px',
                padding: '0 10px',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                borderColor: 'var(--primary)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (polyWallIds.length > 0) {
                  const lastId = polyWallIds[polyWallIds.length - 1];
                  updateObjectDirect(lastId, { x2: polyPoints[0].x, y2: polyPoints[0].y });
                }
                const closedPts = [...polyPoints, polyPoints[0]];
                const isRect = isOrthogonalRectangle(closedPts);

                if (isRect) {
                  const xs = closedPts.map(p => p.x);
                  const ys = closedPts.map(p => p.y);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);

                  const w = maxX - minX;
                  const h = maxY - minY;
                  const cx = (minX + maxX) / 2;
                  const cy = (minY + maxY) / 2;

                  const roomId = `room_${Date.now()}`;
                  const newRoom = createRoomObject({
                    id: roomId,
                    layerId: currentWallConfig.layerId || 'layer_structural_walls',
                    x: cx,
                    y: cy,
                    width: w,
                    height: h,
                    thickness: currentWallConfig.thickness || 180,
                    style: (currentWallConfig.style as any) || 'exterior',
                  });

                  convertWallsToRoom(polyWallIds, newRoom, true);
                } else {
                  // Irregular room shape: Keep walls, create background polygon floor fill + room text label
                  const area = calculatePolygonArea(closedPts);
                  const areaM2 = (area / 1000000).toFixed(1);
                  const centroid = calculatePolygonCentroid(closedPts);

                  const floorShape: ShapeObject = {
                    id: `shape_polygon_${Date.now()}`,
                    type: 'shape',
                    shapeType: 'polygon',
                    layerId: 'layer_structural_walls',
                    visible: true,
                    locked: false,
                    rotation: 0,
                    points: polyPoints,
                    fill: 'rgba(241, 245, 249, 0.45)',
                    stroke: 'none',
                  };

                  const labelText: TextObject = {
                    id: `text_room_${Date.now()}`,
                    type: 'text',
                    layerId: 'layer_room_labels',
                    visible: true,
                    locked: false,
                    rotation: 0,
                    x: centroid.x,
                    y: centroid.y,
                    text: `Room\n${areaM2} ㎡`,
                    fontSize: 350,
                    align: 'center',
                  };

                  addObject(floorShape);
                  addObject(labelText);
                }

                setPolyPoints([]);
                setPolyWallIds([]);
                setDrawingSession(null);
                setActiveTool('select');
              }}
            >
              Close & Create Room
            </button>
          )}
          {polyPoints.length > 0 && (
            <button
              className="toolbar-btn"
              style={{
                height: '24px',
                fontSize: '11px',
                padding: '0 10px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                borderColor: '#ef4444',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => {
                e.stopPropagation();
                deleteObjects(polyWallIds);
                setPolyPoints([]);
                setPolyWallIds([]);
                setActiveTool('select');
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {/* Zoom and Pan container wrapper */}
      <div 
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <div ref={paperRef}>
          <PaperBoundary width={widthPx} height={heightPx}>
            <SvgCanvas />

            {/* Marquee Selection Rectangle */}
            {marqueeStart && marqueeEnd && (
              <rect
                x={Math.min(marqueeStart.x, marqueeEnd.x)}
                y={Math.min(marqueeStart.y, marqueeEnd.y)}
                width={Math.abs(marqueeStart.x - marqueeEnd.x)}
                height={Math.abs(marqueeStart.y - marqueeEnd.y)}
                fill="rgba(59, 130, 246, 0.15)"
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Calibration / Drawing Click Overlay */}
            {(isCalibrating || (activeTool !== 'select' && activeTool !== 'pan')) && (
              <rect
                width={widthPx}
                height={heightPx}
                fill="transparent"
                style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
                onPointerDown={handleDrawingPointerDown}
                onPointerMove={handleDrawingPointerMove}
                onPointerUp={handleDrawingPointerUp}
                onPointerCancel={handleDrawingPointerCancel}
                onClick={handleCanvasClick}
              />
            )}

            {/* Live Dimension Preview */}
            {drawingSession?.tool === 'dimension' && (
              <DimensionPreview
                x1={drawingSession.startWorld.x}
                y1={drawingSession.startWorld.y}
                x2={drawingSession.currentWorld.x}
                y2={drawingSession.currentWorld.y}
                pixelsPerUnit={scale.pixelsPerUnit}
                snap={snapVal}
              />
            )}

            {/* Live Wall Preview */}
            {drawingSession?.tool === 'wall' && (
              <WallPreview
                x1={drawingSession.startWorld.x}
                y1={drawingSession.startWorld.y}
                x2={drawingSession.currentWorld.x}
                y2={drawingSession.currentWorld.y}
                thickness={currentWallConfig.thickness}
                pixelsPerUnit={scale.pixelsPerUnit}
                snap={snapVal}
                shiftKey={isShiftPressed}
                zoom={zoom}
              />
            )}

            {/* Live Continuous Wall Preview */}
            {drawingSession?.tool === 'poly_wall' && (
              <WallPreview
                x1={drawingSession.startWorld.x}
                y1={drawingSession.startWorld.y}
                x2={drawingSession.currentWorld.x}
                y2={drawingSession.currentWorld.y}
                thickness={currentWallConfig.thickness || 180}
                pixelsPerUnit={scale.pixelsPerUnit}
                snap={snapVal}
                shiftKey={isShiftPressed}
                zoom={zoom}
              />
            )}

            {/* Continuous Wall Vertex Dots */}
            {activeTool === 'poly_wall' && polyPoints.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x * scale.pixelsPerUnit}
                cy={pt.y * scale.pixelsPerUnit}
                r={6 / zoom}
                fill={idx === 0 ? '#ef4444' : '#3b82f6'}
                stroke="#ffffff"
                strokeWidth={1.5 / zoom}
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Live Room Rectangle Preview */}
            {drawingSession?.tool === 'rect' && (
              <RectPreview
                x1={drawingSession.startWorld.x}
                y1={drawingSession.startWorld.y}
                x2={drawingSession.currentWorld.x}
                y2={drawingSession.currentWorld.y}
                thickness={currentWallConfig.thickness}
                pixelsPerUnit={scale.pixelsPerUnit}
                snap={snapVal}
                zoom={zoom}
              />
            )}

            {/* Live Room Preview */}
            {drawingSession?.tool === 'room' && (
              <RoomPreview
                x1={drawingSession.startWorld.x}
                y1={drawingSession.startWorld.y}
                x2={drawingSession.currentWorld.x}
                y2={drawingSession.currentWorld.y}
                thickness={currentWallConfig.thickness}
                pixelsPerUnit={scale.pixelsPerUnit}
                snap={snapVal}
                zoom={zoom}
              />
            )}

            {/* Temporary Calibration Line */}
            {isCalibrating && calibrationPoints.length === 1 && hoverPaperPoint && (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={calibrationPoints[0].x}
                  y1={calibrationPoints[0].y}
                  x2={hoverPaperPoint.x}
                  y2={hoverPaperPoint.y}
                  stroke="var(--primary)"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                />
                <circle cx={calibrationPoints[0].x} cy={calibrationPoints[0].y} r={5 / zoom} fill="var(--primary)" />
                <circle cx={hoverPaperPoint.x} cy={hoverPaperPoint.y} r={5 / zoom} fill="var(--primary)" />
              </g>
            )}

            {/* Final Calibration Line Marker */}
            {isCalibrating && calibrationPoints.length === 2 && (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={calibrationPoints[0].x}
                  y1={calibrationPoints[0].y}
                  x2={calibrationPoints[1].x}
                  y2={calibrationPoints[1].y}
                  stroke="var(--primary)"
                  strokeWidth={2 / zoom}
                />
                <circle cx={calibrationPoints[0].x} cy={calibrationPoints[0].y} r={5 / zoom} fill="var(--primary)" />
                <circle cx={calibrationPoints[1].x} cy={calibrationPoints[1].y} r={5 / zoom} fill="var(--primary)" />
              </g>
            )}
          </PaperBoundary>
        </div>
      </div>

      {/* Scale Calibration Input Modal */}
      {isCalibrating && calibrationPoints.length === 2 && (
        <div 
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            padding: '20px',
            width: '320px',
            maxWidth: '90vw',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{t('canvas.calibrateTitle')}</h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {t('canvas.calibrateDesc')}
          </p>
          
          {hasBackground && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Calibration Target</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="cal-target"
                    value="background"
                    checked={calTarget === 'background'}
                    onChange={() => setCalTarget('background')}
                  />
                  Calibrate background image
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="cal-target"
                    value="project"
                    checked={calTarget === 'project'}
                    onChange={() => setCalTarget('project')}
                  />
                  Calibrate whole project (advanced)
                </label>
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              className="prop-input"
              value={calDistance}
              onChange={(e) => setCalDistance(e.target.value)}
              placeholder="Real distance"
              autoFocus
              style={{ flex: 1 }}
            />
            <select
              className="prop-input"
              style={{ width: '80px' }}
              value={calUnit}
              onChange={(e) => setCalUnit(e.target.value as any)}
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'end', marginTop: '4px' }}>
            <button className="toolbar-btn" onClick={cancelCalibration}>{t('common.cancel')}</button>
            <button 
              className="toolbar-btn" 
              style={{ backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }}
              onClick={handleApplyCalibration}
            >
              {t('common.apply')}
            </button>
          </div>
        </div>
      )}
      {/* Floating Viewport Controls */}
      <div className="viewport-controls-overlay" onPointerDown={(e) => e.stopPropagation()}>
        <button className="viewport-ctrl-btn" onClick={zoomOut} title={t('viewport.zoomOut')}>-</button>
        <div className="viewport-zoom-label">{Math.round(zoom * 100)}%</div>
        <button className="viewport-ctrl-btn" onClick={zoomIn} title={t('viewport.zoomIn')}>+</button>
        <button className="viewport-ctrl-btn" onClick={triggerCenterView} title={t('viewport.fit')}>{t('viewport.fit')}</button>
        <div className="viewport-ctrl-divider"></div>
        <button 
          className="viewport-ctrl-btn export-btn" 
          onClick={() => window.dispatchEvent(new CustomEvent('app-open-export'))}
          title={t('viewport.export')}
        >
          {t('viewport.export')}
        </button>
        <button 
          className="viewport-ctrl-btn" 
          onClick={() => window.dispatchEvent(new CustomEvent('app-open-help'))}
          title={t('viewport.help')}
        >
          <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>
            <Icons.HelpIcon size={14} />
          </span>
          {t('viewport.help')}
        </button>
      </div>
      <FloatingCanvasControls />
    </main>
  );
};
export default CanvasViewport;
