import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';
import type { WallObject } from '../types/project';

export const FloatingCanvasControls: React.FC = () => {
  const { t } = useI18n();
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const objects = useProjectStore((state) => state.project.objects);
  const layers = useProjectStore((state) => state.project.layers);
  const scale = useProjectStore((state) => state.project.scale);
  const zoom = useProjectStore((state) => state.zoom);
  const pan = useProjectStore((state) => state.pan);
  const activeTool = useProjectStore((state) => state.activeTool);
  const updateObjectWithHistory = useProjectStore((state) => state.updateObjectWithHistory);

  if (activeTool !== 'select' || selectedIds.length !== 1) {
    return null;
  }

  const selectedObj = objects.find((o) => o.id === selectedIds[0]);
  if (!selectedObj || selectedObj.type !== 'wall') {
    return null;
  }

  const wall = selectedObj as WallObject;
  if (wall.locked) {
    return null;
  }

  const layer = layers.find((l) => l.id === wall.layerId);
  if (layer?.locked) {
    return null;
  }

  const { x1, y1, x2, y2, openings = [] } = wall;
  const wallLen = Math.hypot(x2 - x1, y2 - y1);
  if (wallLen === 0) {
    return null;
  }

  const dx = (x2 - x1) / wallLen;
  const dy = (y2 - y1) / wallLen;

  const cxWorld = (x1 + x2) / 2;
  const cyWorld = (y1 + y2) / 2;

  const cxPaper = cxWorld * scale.pixelsPerUnit;
  const cyPaper = cyWorld * scale.pixelsPerUnit;

  const normalX = -dy;
  const normalY = dx;

  const offsetPx = 34;
  const anchorPaperX = cxPaper + (normalX * offsetPx) / zoom;
  const anchorPaperY = cyPaper + (normalY * offsetPx) / zoom;

  const left = pan.x + anchorPaperX * zoom;
  const top = pan.y + anchorPaperY * zoom;

  const handleAddDoor = () => {
    const newOp: any = {
      id: `op_${Date.now()}`,
      type: 'door' as const,
      offset: Math.round(wallLen / 2 - 450),
      width: 900,
      hingeSide: 'left' as const,
      swingDirection: 'inward' as const,
      openingAngle: 90,
    };
    updateObjectWithHistory(wall.id, { openings: [...openings, newOp] as any });
  };

  const handleAddWindow = () => {
    const newOp: any = {
      id: `op_${Date.now()}`,
      type: 'window' as const,
      offset: Math.round(wallLen / 2 - 600),
      width: 1200,
    };
    updateObjectWithHistory(wall.id, { openings: [...openings, newOp] as any });
  };

  return (
    <div
      className="floating-canvas-controls no-export"
      style={{
        position: 'absolute',
        left,
        top,
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
        pointerEvents: 'auto',
        display: 'flex',
        gap: '6px',
        backgroundColor: '#ffffff',
        border: '1px solid #3b82f6',
        borderRadius: '6px',
        padding: '3px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        boxSizing: 'border-box',
        height: '36px',
        width: '120px',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        title={t('canvas.addDoor') || 'Add Door'}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '2px 4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={handleAddDoor}
      >
        <Icons.DoorIcon size={14} />
      </button>

      <button
        title={t('canvas.addWindow') || 'Add Window'}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '2px 4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={handleAddWindow}
      >
        <Icons.WindowIcon size={14} />
      </button>
    </div>
  );
};
