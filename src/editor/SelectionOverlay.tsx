import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { getObjectBounds } from '../utils/bounds';
import { snapEndpoint } from '../utils/snapping';
import { getObjectTransformPolicy } from '../utils/transformObjects';
import { clientToWorldPoint } from '../utils/coordinates';
import { getDragRotation, snapRotation } from '../utils/rotationSnap';

export const SelectionOverlay: React.FC = () => {
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const objects = useProjectStore((state) => state.project.objects);
  const layers = useProjectStore((state) => state.project.layers);
  const scale = useProjectStore((state) => state.project.scale);
  const zoom = useProjectStore((state) => state.zoom);
  const updateObject = useProjectStore((state) => state.updateObject);
  const pushToHistory = useProjectStore((state) => state.pushToHistory);
  const grid = useProjectStore((state) => state.project.grid);
  const setSnapGuides = useProjectStore((state) => state.setSnapGuides);
  const freeStretch = useProjectStore((state) => state.freeStretch);


  if (selectedIds.length === 0) return null;

  const toPx = (val: number) => val * scale.pixelsPerUnit;

  const snapVal = (val: number) => {
    return grid.snap ? Math.round(val / grid.size) * grid.size : Math.round(val);
  };

  // MULTI-SELECTION BOUNDING BOX
  if (selectedIds.length > 1) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedIds.forEach((id) => {
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        const bounds = getObjectBounds(obj);
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    });

    if (minX === Infinity) return null;

    const pxMinX = toPx(minX);
    const pxMinY = toPx(minY);
    const pxMaxX = toPx(maxX);
    const pxMaxY = toPx(maxY);
    const w = pxMaxX - pxMinX;
    const h = pxMaxY - pxMinY;
    const cx = (pxMinX + pxMaxX) / 2;
    const cy = (pxMinY + pxMaxY) / 2;

    const handleSize = ((typeof window !== 'undefined' && window.innerWidth < 1024) ? 16 : 8) / zoom;
    const hs = handleSize / 2;

    const handleGroupDragStart = (
      e: React.PointerEvent,
      type: 'rotate' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    ) => {
      e.stopPropagation();
      e.preventDefault();

      const canvasElement = document.querySelector('.paper-boundary') as HTMLElement;
      if (!canvasElement) return;

      const state = useProjectStore.getState();
      const initialSelectedIds = [...state.selectedIds];

      const groupCx = (minX + maxX) / 2;
      const groupCy = (minY + maxY) / 2;
      const groupW = maxX - minX;
      const groupH = maxY - minY;

      const startWorldPt = clientToWorldPoint(e, canvasElement, zoom, scale.pixelsPerUnit);
      const startX_Mm = startWorldPt.x;
      const startY_Mm = startWorldPt.y;

      const startAngleRad = Math.atan2(startY_Mm - groupCy, startX_Mm - groupCx);

      let hasBegunTransform = false;

      const handleMouseMove = (moveEvent: PointerEvent) => {
        if (!hasBegunTransform) {
          useProjectStore.getState().beginTransformSession();
          hasBegunTransform = true;
        }

        const currentWorldPt = clientToWorldPoint(moveEvent, canvasElement, zoom, scale.pixelsPerUnit);
        const currentX_Mm = currentWorldPt.x;
        const currentY_Mm = currentWorldPt.y;

        if (type === 'rotate') {
          const currentAngleRad = Math.atan2(currentY_Mm - groupCy, currentX_Mm - groupCx);
          let angleDeltaDeg = (currentAngleRad - startAngleRad) * (180 / Math.PI);

          if (grid.snap) {
            angleDeltaDeg = snapRotation(angleDeltaDeg, 10);
          } else if (moveEvent.shiftKey) {
            angleDeltaDeg = snapRotation(angleDeltaDeg, 15);
          }

          useProjectStore.getState().updateTransformSession(initialSelectedIds, {
            type: 'rotate',
            center: { x: groupCx, y: groupCy },
            angleDeg: angleDeltaDeg,
          });
        } else {
          // Scaling
          const dx = currentX_Mm - startX_Mm;
          const dy = currentY_Mm - startY_Mm;

          let scaleX = 1.0;
          let scaleY = 1.0;

          let sx = 0;
          let sy = 0;

          if (type.includes('right')) sx = 1;
          if (type.includes('left')) sx = -1;
          if (type.includes('bottom')) sy = 1;
          if (type.includes('top')) sy = -1;

          if (sx !== 0) {
            const newW = Math.max(100, groupW + sx * dx);
            scaleX = newW / groupW;
          }
          if (sy !== 0) {
            const newH = Math.max(100, groupH + sy * dy);
            scaleY = newH / groupH;
          }

          const isCorner = type.includes('-');
          if (!freeStretch) {
            if (isCorner) {
              const uniformScale = (scaleX + scaleY) / 2;
              scaleX = uniformScale;
              scaleY = uniformScale;
            } else {
              const uniformScale = sx !== 0 ? scaleX : scaleY;
              scaleX = uniformScale;
              scaleY = uniformScale;
            }
          }

          // Opposite scaling center
          let refX = groupCx;
          let refY = groupCy;
          if (sx === 1) refX = minX;
          else if (sx === -1) refX = maxX;
          if (sy === 1) refY = minY;
          else if (sy === -1) refY = maxY;

          useProjectStore.getState().updateTransformSession(initialSelectedIds, {
            type: 'scale',
            center: { x: refX, y: refY },
            scaleX,
            scaleY,
            freeStretch,
          });
        }
      };

      const handleMouseUp = () => {
        if (hasBegunTransform) {
          useProjectStore.getState().endTransformSession();
        }
        window.removeEventListener('pointermove', handleMouseMove);
        window.removeEventListener('pointerup', handleMouseUp);
      };

      window.addEventListener('pointermove', handleMouseMove);
      window.addEventListener('pointerup', handleMouseUp);
    };

    return (
      <g className="group-selection-overlay">
        {/* Visual outline */}
        <rect
          className="selection-outline"
          x={pxMinX - 4 / zoom}
          y={pxMinY - 4 / zoom}
          width={w + 8 / zoom}
          height={h + 8 / zoom}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          style={{ pointerEvents: 'none' }}
        />

        {/* Rotate Handle */}
        <line
          x1={cx}
          y1={pxMinY - 4 / zoom}
          x2={cx}
          y2={pxMinY - 24 / zoom}
          stroke="#3b82f6"
          strokeWidth={1.5 / zoom}
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={cx}
          cy={pxMinY - 24 / zoom}
          r={5 / zoom}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / zoom}
          style={{ cursor: 'alias' }}
          onPointerDown={(e) => handleGroupDragStart(e, 'rotate')}
        />

        {/* Corner Handles */}
        <rect
          x={pxMinX - 4 / zoom - hs}
          y={pxMinY - 4 / zoom - hs}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={1.5 / zoom}
          style={{ cursor: 'nwse-resize' }}
          onPointerDown={(e) => handleGroupDragStart(e, 'top-left')}
        />
        <rect
          x={pxMaxX + 4 / zoom - hs}
          y={pxMinY - 4 / zoom - hs}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={1.5 / zoom}
          style={{ cursor: 'nesw-resize' }}
          onPointerDown={(e) => handleGroupDragStart(e, 'top-right')}
        />
        <rect
          x={pxMinX - 4 / zoom - hs}
          y={pxMaxY + 4 / zoom - hs}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={1.5 / zoom}
          style={{ cursor: 'nesw-resize' }}
          onPointerDown={(e) => handleGroupDragStart(e, 'bottom-left')}
        />
        <rect
          x={pxMaxX + 4 / zoom - hs}
          y={pxMaxY + 4 / zoom - hs}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={1.5 / zoom}
          style={{ cursor: 'nwse-resize' }}
          onPointerDown={(e) => handleGroupDragStart(e, 'bottom-right')}
        />

        {/* Side handles (rendered only in freeStretch mode) */}
        {freeStretch && (
          <>
            <rect
              x={cx - hs}
              y={pxMinY - 4 / zoom - hs}
              width={handleSize}
              height={handleSize}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'ns-resize' }}
              onPointerDown={(e) => handleGroupDragStart(e, 'top')}
            />
            <rect
              x={cx - hs}
              y={pxMaxY + 4 / zoom - hs}
              width={handleSize}
              height={handleSize}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'ns-resize' }}
              onPointerDown={(e) => handleGroupDragStart(e, 'bottom')}
            />
            <rect
              x={pxMinX - 4 / zoom - hs}
              y={cy - hs}
              width={handleSize}
              height={handleSize}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'ew-resize' }}
              onPointerDown={(e) => handleGroupDragStart(e, 'left')}
            />
            <rect
              x={pxMaxX + 4 / zoom - hs}
              y={cy - hs}
              width={handleSize}
              height={handleSize}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'ew-resize' }}
              onPointerDown={(e) => handleGroupDragStart(e, 'right')}
            />
          </>
        )}
      </g>
    );
  }

  // SINGLE SELECTION HANDLES
  const objId = selectedIds[0];
  const obj = objects.find((o) => o.id === objId);
  if (!obj || obj.locked) return null;

  const handleDragStart = (e: React.PointerEvent, type: string) => {
    e.stopPropagation();
    e.preventDefault();

    const canvasElement = document.querySelector('.paper-boundary') as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;

    // Capture initial values
    const initialObj = { ...obj } as any;
    const initialWidth = initialObj.width ?? 0;
    const initialHeight = initialObj.type === 'window' ? (initialObj.thickness ?? 200) : initialObj.height ?? 0;
    const initialX = initialObj.x ?? 0;
    const initialY = initialObj.y ?? 0;
    const initialX1 = initialObj.x1 ?? 0;
    const initialY1 = initialObj.y1 ?? 0;
    const initialX2 = initialObj.x2 ?? 0;
    const initialY2 = initialObj.y2 ?? 0;
    const initialRotation = initialObj.rotation ?? 0;
    const aspect = initialWidth / (initialHeight || 1);

    let hasPushedHistory = false;

    const handleMouseMove = (moveEvent: PointerEvent) => {
      if (!hasPushedHistory && (moveEvent.clientX !== startX || moveEvent.clientY !== startY)) {
        pushToHistory();
        hasPushedHistory = true;
      }

      if (!canvasElement) return;
      const startWorldPt = clientToWorldPoint({ clientX: startX, clientY: startY }, canvasElement, zoom, scale.pixelsPerUnit);
      const currentWorldPt = clientToWorldPoint(moveEvent, canvasElement, zoom, scale.pixelsPerUnit);
      const dx = currentWorldPt.x - startWorldPt.x;
      const dy = currentWorldPt.y - startWorldPt.y;

      const layerLockedMap: Record<string, boolean> = {};
      layers.forEach((l) => {
        layerLockedMap[l.id] = l.locked;
      });

      if (type === 'x1y1') {
        const targetX = initialX1 + dx;
        const targetY = initialY1 + dy;
        
        let snappedX = targetX;
        let snappedY = targetY;
        let activeGuides: any[] = [];

        if (grid.snap) {
          const snapResult = snapEndpoint(targetX, targetY, objects, layerLockedMap, grid, objId);
          snappedX = snapResult.x;
          snappedY = snapResult.y;
          activeGuides = snapResult.guides;
        } else {
          snappedX = Math.round(targetX);
          snappedY = Math.round(targetY);
        }

        updateObject(objId, {
          x1: snappedX,
          y1: snappedY,
        });
        setSnapGuides(activeGuides);
      } else if (type === 'x2y2') {
        const targetX = initialX2 + dx;
        const targetY = initialY2 + dy;
        
        let snappedX = targetX;
        let snappedY = targetY;
        let activeGuides: any[] = [];

        if (grid.snap) {
          const snapResult = snapEndpoint(targetX, targetY, objects, layerLockedMap, grid, objId);
          snappedX = snapResult.x;
          snappedY = snapResult.y;
          activeGuides = snapResult.guides;
        } else {
          snappedX = Math.round(targetX);
          snappedY = Math.round(targetY);
        }

        updateObject(objId, {
          x2: snappedX,
          y2: snappedY,
        });
        setSnapGuides(activeGuides);
      } else if (type === 'rotate') {
        const currentWorld = clientToWorldPoint(moveEvent, canvasElement, zoom, scale.pixelsPerUnit);
        const angleRad = Math.atan2(currentWorld.y - initialY, currentWorld.x - initialX);
        let angleDeg = angleRad * (180 / Math.PI) + 90;
        angleDeg = getDragRotation(angleDeg, grid.snap, moveEvent.shiftKey);
        updateObject(objId, { rotation: angleDeg });
      } else {
        // Resize operations. Rotate the dx/dy vector back to local space.
        const rad = (-initialRotation * Math.PI) / 180;
        const localDx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localDy = dx * Math.sin(rad) + dy * Math.cos(rad);

        // Determine multiplier for the drag direction
        let sx = 0;
        let sy = 0;

        if (type.includes('right')) sx = 1;
        if (type.includes('left')) sx = -1;
        if (type.includes('bottom')) sy = 1;
        if (type.includes('top')) sy = -1;

        let newW = initialWidth + sx * localDx * (moveEvent.altKey ? 2 : 1);
        let newH = initialHeight + sy * localDy * (moveEvent.altKey ? 2 : 1);

        // Enforce min size
        newW = Math.max(100, newW);
        newH = Math.max(100, newH);

        // Preserve aspect ratio if lockAspectRatio is true OR Shift is held
        const policy = getObjectTransformPolicy(obj);
        const lockAspectVal = (obj as any).lockAspectRatio ?? policy.lockAspectRatio;
        const shouldLockAspect = lockAspectVal || moveEvent.shiftKey;
        if (shouldLockAspect && (type === 'top-left' || type === 'top-right' || type === 'bottom-left' || type === 'bottom-right')) {
          if (type.includes('left') || type.includes('right')) {
            newH = newW / aspect;
          } else {
            newW = newH * aspect;
          }
        }

        // Apply snapping
        newW = snapVal(newW);
        newH = snapVal(newH);

        // Calculate delta center in local coordinates
        let localCx = 0;
        let localCy = 0;

        if (!moveEvent.altKey) {
          if (sx !== 0) localCx = (sx * (newW - initialWidth)) / 2;
          if (sy !== 0) localCy = (sy * (newH - initialHeight)) / 2;
        }

        // Rotate local center shift back to global coordinates
        const rRad = (initialRotation * Math.PI) / 180;
        const globalCx = localCx * Math.cos(rRad) - localCy * Math.sin(rRad);
        const globalCy = localCx * Math.sin(rRad) + localCy * Math.cos(rRad);

        const updates: any = {};
        if (obj.type === 'window') {
          updates.thickness = newH;
        } else {
          updates.height = newH;
        }
        updates.width = newW;
        
        if (!moveEvent.altKey) {
          updates.x = snapVal(initialX + globalCx);
          updates.y = snapVal(initialY + globalCy);
        }

        updateObject(objId, updates);
      }
    };

    const handleMouseUp = () => {
      setSnapGuides([]);
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
  };

  // Render endpoints for lines
  if (obj.type === 'wall' || obj.type === 'dimension') {
    const wObj = obj as any;
    const px1 = toPx(wObj.x1);
    const py1 = toPx(wObj.y1);
    const px2 = toPx(wObj.x2);
    const py2 = toPx(wObj.y2);

    return (
      <g className="selection-overlay-group">
        {/* Connection Line */}
        <line x1={px1} y1={py1} x2={px2} y2={py2} stroke="#3b82f6" strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} style={{ pointerEvents: 'none' }} />
        {/* Endpoint 1 Handle */}
        <circle
          cx={px1}
          cy={py1}
          r={6 / zoom}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / zoom}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => handleDragStart(e, 'x1y1')}
        />
        {/* Endpoint 2 Handle */}
        <circle
          cx={px2}
          cy={py2}
          r={6 / zoom}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / zoom}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => handleDragStart(e, 'x2y2')}
        />
      </g>
    );
  }

  // Render bounding box + handles for rectangles
  const rObj = obj as any;
  const w = toPx(rObj.width);
  const h = toPx(obj.type === 'window' ? (rObj.thickness ?? 200) : rObj.height ?? 0);
  const rot = obj.rotation ?? 0;

  const handleSize = ((typeof window !== 'undefined' && window.innerWidth < 1024) ? 16 : 8) / zoom;
  const hs = handleSize / 2;

  const policy = getObjectTransformPolicy(obj);
  const allowStretchVal = (obj as any).allowStretch ?? policy.allowStretch;

  return (
    <g className="selection-overlay-group" transform={`translate(${toPx(rObj.x)}, ${toPx(rObj.y)}) rotate(${rot})`}>
      {/* Outline */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        style={{ pointerEvents: 'none' }}
      />

      {/* Rotation Handle Line */}
      <line
        x1={0}
        y1={-h / 2}
        x2={0}
        y2={-h / 2 - 20 / zoom}
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        style={{ pointerEvents: 'none' }}
      />
      {/* Rotation Handle Circle */}
      <circle
        cx={0}
        cy={-h / 2 - 20 / zoom}
        r={5 / zoom}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={2 / zoom}
        style={{ cursor: 'alias' }}
        onPointerDown={(e) => handleDragStart(e, 'rotate')}
      />

      {/* Side Handles */}
      {allowStretchVal && (
        <>
          <rect
            x={-hs}
            y={-h / 2 - hs}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'ns-resize' }}
            onPointerDown={(e) => handleDragStart(e, 'top')}
          />
          <rect
            x={-hs}
            y={h / 2 - hs}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'ns-resize' }}
            onPointerDown={(e) => handleDragStart(e, 'bottom')}
          />
          <rect
            x={-w / 2 - hs}
            y={-hs}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => handleDragStart(e, 'left')}
          />
          <rect
            x={w / 2 - hs}
            y={-hs}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => handleDragStart(e, 'right')}
          />
        </>
      )}

      {/* Corner Handles */}
      <rect
        x={-w / 2 - hs}
        y={-h / 2 - hs}
        width={handleSize}
        height={handleSize}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        style={{ cursor: 'nwse-resize' }}
        onPointerDown={(e) => handleDragStart(e, 'top-left')}
      />
      <rect
        x={w / 2 - hs}
        y={-h / 2 - hs}
        width={handleSize}
        height={handleSize}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        style={{ cursor: 'nesw-resize' }}
        onPointerDown={(e) => handleDragStart(e, 'top-right')}
      />
      <rect
        x={-w / 2 - hs}
        y={h / 2 - hs}
        width={handleSize}
        height={handleSize}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        style={{ cursor: 'nesw-resize' }}
        onPointerDown={(e) => handleDragStart(e, 'bottom-left')}
      />
      <rect
        x={w / 2 - hs}
        y={h / 2 - hs}
        width={handleSize}
        height={handleSize}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        style={{ cursor: 'nwse-resize' }}
        onPointerDown={(e) => handleDragStart(e, 'bottom-right')}
      />
    </g>
  );
};

export default SelectionOverlay;
