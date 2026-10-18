import React from 'react';
import { useProjectStore } from '../store/projectStore';
import type { Layer, RoomObject, MapObject, DimensionObject, ShapeObject, WallObject, RoomOpening, FurnitureObject } from '../types/project';
import { createRoomObject } from '../utils/room';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';
import { getObjectBounds } from '../utils/bounds';
import { getRoomAutoAreaLabel, getDimensionLengthMm, formatDimensionLabel } from '../utils/measurements';
import { getObjectTransformPolicy } from '../utils/transformObjects';
import { relayoutDeskChairSet, type ChairSide } from '../utils/furnitureSets';

export const PropertiesPanel: React.FC = () => {
  const { t } = useI18n();
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const objects = useProjectStore((state) => state.project.objects);
  const layers = useProjectStore((state) => state.project.layers);
  const updateObject = useProjectStore((state) => state.updateObjectWithHistory);
  const updateObjectDirect = useProjectStore((state) => state.updateObject);
  const pushToHistory = useProjectStore((state) => state.pushToHistory);
  const deleteObject = useProjectStore((state) => state.deleteObject);
  const selectedRoomSide = useProjectStore((state) => state.selectedRoomSide);
  const grid = useProjectStore((state) => state.project.grid);
  const setObjects = useProjectStore((state) => state.setObjects);
  const setSelectedIds = useProjectStore((state) => state.setSelectedIds);
  
  const updateObjects = useProjectStore((state) => state.updateObjects);
  const deleteObjects = useProjectStore((state) => state.deleteObjects);
  const duplicateObjects = useProjectStore((state) => state.duplicateObjects);
  const convertWallsToRoom = useProjectStore((state) => state.convertWallsToRoom);
  const explodeRoom = useProjectStore((state) => state.explodeRoom);
  const freeStretch = useProjectStore((state) => state.freeStretch);
  const setFreeStretch = useProjectStore((state) => state.setFreeStretch);

  const editSessionRef = React.useRef<string | null>(null);

  const beginEditSession = React.useCallback((key: string) => {
    if (editSessionRef.current === key) return;
    editSessionRef.current = key;
    pushToHistory();
  }, [pushToHistory]);

  const endEditSession = React.useCallback(() => {
    editSessionRef.current = null;
  }, []);

  const selectionKey = selectedIds.join('|');
  React.useEffect(() => {
    editSessionRef.current = null;
  }, [selectionKey]);

  if (selectedIds.length > 1) {
    const selectedWalls = objects.filter(o => selectedIds.includes(o.id) && o.type === 'wall') as any[];
    const isFourWalls = selectedIds.length === 4 && selectedWalls.length === 4;

    const layerLockedMap: Record<string, boolean> = {};
    layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const movableObjects = objects.filter(o => 
      selectedIds.includes(o.id) && 
      !o.locked && 
      !(o.layerId && layerLockedMap[o.layerId])
    );

    const handleAlign = (direction: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
      if (movableObjects.length < 2) return;

      const boundsList = movableObjects.map(o => ({
        obj: o,
        bounds: getObjectBounds(o)
      }));

      let targetVal = 0;
      
      const snapVal = (val: number) => {
        return grid.snap ? Math.round(val / grid.size) * grid.size : Math.round(val);
      };

      if (direction === 'left') {
        const minX = Math.min(...boundsList.map(b => b.bounds.minX));
        targetVal = snapVal(minX);
      } else if (direction === 'centerX') {
        const minX = Math.min(...boundsList.map(b => b.bounds.minX));
        const maxX = Math.max(...boundsList.map(b => b.bounds.maxX));
        targetVal = snapVal((minX + maxX) / 2);
      } else if (direction === 'right') {
        const maxX = Math.max(...boundsList.map(b => b.bounds.maxX));
        targetVal = snapVal(maxX);
      } else if (direction === 'top') {
        const minY = Math.min(...boundsList.map(b => b.bounds.minY));
        targetVal = snapVal(minY);
      } else if (direction === 'centerY') {
        const minY = Math.min(...boundsList.map(b => b.bounds.minY));
        const maxY = Math.max(...boundsList.map(b => b.bounds.maxY));
        targetVal = snapVal((minY + maxY) / 2);
      } else if (direction === 'bottom') {
        const maxY = Math.max(...boundsList.map(b => b.bounds.maxY));
        targetVal = snapVal(maxY);
      }

      pushToHistory();

      const updatedIds = movableObjects.map(o => o.id);
      const updatedObjects = objects.map(o => {
        if (!updatedIds.includes(o.id)) return o;
        
        const entry = boundsList.find(b => b.obj.id === o.id);
        if (!entry) return o;
        
        const b = entry.bounds;
        let dx = 0;
        let dy = 0;

        if (direction === 'left') {
          dx = targetVal - b.minX;
        } else if (direction === 'centerX') {
          dx = targetVal - (b.minX + b.maxX) / 2;
        } else if (direction === 'right') {
          dx = targetVal - b.maxX;
        } else if (direction === 'top') {
          dy = targetVal - b.minY;
        } else if (direction === 'centerY') {
          dy = targetVal - (b.minY + b.maxY) / 2;
        } else if (direction === 'bottom') {
          dy = targetVal - b.maxY;
        }

        if (o.type === 'shape') {
          const sh = o as ShapeObject;
          if (sh.x !== undefined && sh.y !== undefined) {
            return {
              ...sh,
              x: sh.x + dx,
              y: sh.y + dy
            } as MapObject;
          } else if (sh.points) {
            return {
              ...sh,
              points: sh.points.map((p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy }))
            } as MapObject;
          }
          return o;
        }

        if ('x' in o && (o as any).x !== undefined) {
          return {
            ...o,
            x: (o as any).x + dx,
            y: (o as any).y + dy
          } as MapObject;
        } else if ('x1' in o) {
          return {
            ...o,
            x1: o.x1 + dx,
            y1: o.y1 + dy,
            x2: o.x2 + dx,
            y2: o.y2 + dy
          } as MapObject;
        }
        return o;
      });

      setObjects(updatedObjects);
    };

    const handleDistribute = (axis: 'horizontal' | 'vertical') => {
      if (movableObjects.length < 3) return;

      const boundsList = movableObjects.map(o => ({
        obj: o,
        bounds: getObjectBounds(o),
        center: axis === 'horizontal' 
          ? (getObjectBounds(o).minX + getObjectBounds(o).maxX) / 2
          : (getObjectBounds(o).minY + getObjectBounds(o).maxY) / 2
      }));

      boundsList.sort((a, b) => a.center - b.center);

      const n = boundsList.length;

      pushToHistory();

      const snapVal = (val: number) => {
        return grid.snap ? Math.round(val / grid.size) * grid.size : Math.round(val);
      };

      const updatedObjectsMap = new Map<string, MapObject>();

      if (axis === 'horizontal') {
        const colMinX = Math.min(...boundsList.map(b => b.bounds.minX));
        const colMaxX = Math.max(...boundsList.map(b => b.bounds.maxX));
        const totalObjWidth = boundsList.reduce((sum, b) => sum + (b.bounds.maxX - b.bounds.minX), 0);
        const totalSpan = colMaxX - colMinX;
        
        const gap = (totalSpan - totalObjWidth) / (n - 1);
        let currentLeft = colMinX;

        boundsList.forEach((entry) => {
          const obj = entry.obj;
          const b = entry.bounds;
          const width = b.maxX - b.minX;
          
          let targetLeft = currentLeft;
          if (grid.snap) {
            targetLeft = snapVal(targetLeft);
          }

          const dx = targetLeft - b.minX;

          let newObj: MapObject;
          if (obj.type === 'shape') {
            const sh = obj as ShapeObject;
            if (sh.x !== undefined && sh.y !== undefined) {
              newObj = { ...sh, x: sh.x + dx } as MapObject;
            } else if (sh.points) {
              newObj = { ...sh, points: sh.points.map((p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y })) } as MapObject;
            } else {
              newObj = obj;
            }
          } else if ('x' in obj && (obj as any).x !== undefined) {
            newObj = { ...obj, x: (obj as any).x + dx } as MapObject;
          } else if ('x1' in obj) {
            newObj = { ...obj, x1: obj.x1 + dx, x2: obj.x2 + dx } as MapObject;
          } else {
            newObj = obj;
          }

          updatedObjectsMap.set(obj.id, newObj);
          currentLeft = targetLeft + width + gap;
        });
      } else {
        const colMinY = Math.min(...boundsList.map(b => b.bounds.minY));
        const colMaxY = Math.max(...boundsList.map(b => b.bounds.maxY));
        const totalObjHeight = boundsList.reduce((sum, b) => sum + (b.bounds.maxY - b.bounds.minY), 0);
        const totalSpan = colMaxY - colMinY;

        const gap = (totalSpan - totalObjHeight) / (n - 1);
        let currentTop = colMinY;

        boundsList.forEach((entry) => {
          const obj = entry.obj;
          const b = entry.bounds;
          const height = b.maxY - b.minY;

          let targetTop = currentTop;
          if (grid.snap) {
            targetTop = snapVal(targetTop);
          }

          const dy = targetTop - b.minY;

          let newObj: MapObject;
          if (obj.type === 'shape') {
            const sh = obj as ShapeObject;
            if (sh.x !== undefined && sh.y !== undefined) {
              newObj = { ...sh, y: sh.y + dy } as MapObject;
            } else if (sh.points) {
              newObj = { ...sh, points: sh.points.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y + dy })) } as MapObject;
            } else {
              newObj = obj;
            }
          } else if ('x' in obj && (obj as any).x !== undefined) {
            newObj = { ...obj, y: (obj as any).y + dy } as MapObject;
          } else if ('x1' in obj) {
            newObj = { ...obj, y1: obj.y1 + dy, y2: obj.y2 + dy } as MapObject;
          } else {
            newObj = obj;
          }

          updatedObjectsMap.set(obj.id, newObj);
          currentTop = targetTop + height + gap;
        });
      }

      const updatedObjects = objects.map(o => {
        if (updatedObjectsMap.has(o.id)) {
          return updatedObjectsMap.get(o.id)!;
        }
        return o;
      });

      setObjects(updatedObjects);
    };

    const handleConvertToRoom = () => {
      const name = window.prompt(t('prop.promptRoomName') || "Enter room name:", t('prop.defaultRoomName') || "Room");
      if (name === null) return;

      const deleteOld = window.confirm(t('prop.confirmDeleteWalls') || "Do you want to delete the original 4 walls?");
      
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      selectedWalls.forEach((w) => {
        minX = Math.min(minX, w.x1, w.x2);
        minY = Math.min(minY, w.y1, w.y2);
        maxX = Math.max(maxX, w.x1, w.x2);
        maxY = Math.max(maxY, w.y1, w.y2);
      });

      const w = maxX - minX;
      const h = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const roomId = `room_${Date.now()}`;
      const newRoom = createRoomObject({
        id: roomId,
        layerId: selectedWalls[0].layerId || 'layer_structural_walls',
        x: cx,
        y: cy,
        width: w,
        height: h,
        name: name || 'Room',
        thickness: selectedWalls[0].thickness || 180,
        style: selectedWalls[0].style || 'exterior',
      });

      convertWallsToRoom(selectedIds, newRoom, deleteOld);
    };

    return (
      <div className="properties-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="panel-header" style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('prop.title')}</span>
          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
            {t('prop.multiSelection')}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 500 }}>
            {selectedIds.length} {t('prop.objectsSelected')}
          </div>

          <div className="prop-row">
            <span className="prop-label">{t('prop.layer')}</span>
            <select 
              className="prop-input" 
              value="" 
              onChange={(e) => {
                const targetLayer = e.target.value;
                if (targetLayer) {
                  updateObjects(selectedIds, { layerId: targetLayer });
                }
              }}
            >
              <option value="" disabled>Select target layer...</option>
              {layers.map((l: Layer) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button 
              className="toolbar-btn" 
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              onClick={() => updateObjects(selectedIds, { locked: true })}
            >
              <Icons.LockIcon size={14} />
              {t('prop.locked')}
            </button>
            <button 
              className="toolbar-btn" 
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              onClick={() => updateObjects(selectedIds, { locked: false })}
            >
              <Icons.UnlockIcon size={14} />
              {t('prop.unlock')}
            </button>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="toolbar-btn" 
              style={{ flex: 1 }} 
              onClick={() => duplicateObjects(selectedIds)}
            >
              {t('prop.duplicate')}
            </button>
            <button 
              className="toolbar-btn" 
              style={{ flex: 1, color: '#ffffff', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }} 
              onClick={() => deleteObjects(selectedIds)}
            >
              {t('prop.delete')}
            </button>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {t('prop.alignment')}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 2 ? 0.5 : 1, cursor: movableObjects.length < 2 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 2}
                onClick={() => handleAlign('left')}
                title={t('prop.alignLeftTitle')}
              >
                {t('prop.alignLeft')}
              </button>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 2 ? 0.5 : 1, cursor: movableObjects.length < 2 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 2}
                onClick={() => handleAlign('centerX')}
                title={t('prop.alignHCenterTitle')}
              >
                {t('prop.alignHCenter')}
              </button>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 2 ? 0.5 : 1, cursor: movableObjects.length < 2 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 2}
                onClick={() => handleAlign('right')}
                title={t('prop.alignRightTitle')}
              >
                {t('prop.alignRight')}
              </button>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 2 ? 0.5 : 1, cursor: movableObjects.length < 2 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 2}
                onClick={() => handleAlign('top')}
                title={t('prop.alignTopTitle')}
              >
                {t('prop.alignTop')}
              </button>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 2 ? 0.5 : 1, cursor: movableObjects.length < 2 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 2}
                onClick={() => handleAlign('centerY')}
                title={t('prop.alignVCenterTitle')}
              >
                {t('prop.alignVCenter')}
              </button>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 2 ? 0.5 : 1, cursor: movableObjects.length < 2 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 2}
                onClick={() => handleAlign('bottom')}
                title={t('prop.alignBottomTitle')}
              >
                {t('prop.alignBottom')}
              </button>
            </div>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {t('prop.distribution')}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 3 ? 0.5 : 1, cursor: movableObjects.length < 3 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 3}
                onClick={() => handleDistribute('horizontal')}
                title={t('prop.distributeHTitle')}
              >
                {t('prop.distributeH')}
              </button>
              <button 
                className="toolbar-btn" 
                style={{ fontSize: '11px', padding: '6px 4px', opacity: movableObjects.length < 3 ? 0.5 : 1, cursor: movableObjects.length < 3 ? 'not-allowed' : 'pointer' }}
                disabled={movableObjects.length < 3}
                onClick={() => handleDistribute('vertical')}
                title={t('prop.distributeVTitle')}
              >
                {t('prop.distributeV')}
              </button>
            </div>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {t('prop.transform')}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={freeStretch}
                onChange={(e) => setFreeStretch(e.target.checked)}
              />
              <span>{t('prop.allowStretch')}</span>
            </label>
            {objects.some(o => selectedIds.includes(o.id) && !getObjectTransformPolicy(o).allowStretch) && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                {t('prop.hasNonStretchWarning')}
              </span>
            )}
          </div>

          {isFourWalls && (
            <button 
              className="toolbar-btn" 
              style={{ width: '100%', marginTop: '8px', backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} 
              onClick={handleConvertToRoom}
            >
              <Icons.RoomAreaIcon size={16} />
              {t('prop.convertToSmartRoom')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedObj = objects.find((o) => o.id === selectedIds[0]);

  const handleDelete = () => {
    if (!selectedObj) return;
    deleteObject(selectedObj.id);
  };

  const handleExplodeRoom = () => {
    if (!selectedObj || selectedObj.type !== 'room') return;
    const room = selectedObj as RoomObject;

    if (!window.confirm(t('prop.confirmExplodeRoom') || "Are you sure you want to explode this room into separate wall objects?")) {
      return;
    }

    const w = room.width;
    const h = room.height;
    const rad = (room.rotation * Math.PI) / 180;

    const localToGlobal = (lx: number, ly: number) => {
      const gx = room.x + lx * Math.cos(rad) - ly * Math.sin(rad);
      const gy = room.y + lx * Math.sin(rad) + ly * Math.cos(rad);
      return { x: Math.round(gx), y: Math.round(gy) };
    };

    const wallSides = [
      { side: 'top', lx1: -w/2, ly1: -h/2, lx2: w/2, ly2: -h/2, dx: 1, dy: 0 },
      { side: 'right', lx1: w/2, ly1: -h/2, lx2: w/2, ly2: h/2, dx: 0, dy: 1 },
      { side: 'bottom', lx1: w/2, ly1: h/2, lx2: -w/2, ly2: h/2, dx: -1, dy: 0 },
      { side: 'left', lx1: -w/2, ly1: h/2, lx2: -w/2, ly2: -h/2, dx: 0, dy: -1 },
    ];

    const newObjects: any[] = [];
    const timestamp = Date.now();

    wallSides.forEach(({ side, lx1, ly1, lx2, ly2, dx, dy }) => {
      const wallConf = room.walls[side as 'top' | 'right' | 'bottom' | 'left'] || { visible: true, thickness: 180, style: 'exterior' };
      if (wallConf.visible === false) return;

      // Find openings on this wall
      const wallOpenings = (room.openings || []).filter(op => op.wall === side);

      if (wallOpenings.length === 0) {
        // Create a single solid wall
        const g1 = localToGlobal(lx1, ly1);
        const g2 = localToGlobal(lx2, ly2);
        newObjects.push({
          id: `wall_exploded_${timestamp}_${side}`,
          type: 'wall',
          layerId: room.layerId || 'layer_structural_walls',
          visible: true,
          locked: false,
          x1: g1.x,
          y1: g1.y,
          x2: g2.x,
          y2: g2.y,
          thickness: wallConf.thickness,
          style: wallConf.style,
          rotation: 0,
        });
      } else {
        // Sort openings by offset along the wall
        const sortedOps = [...wallOpenings].sort((a, b) => a.offset - b.offset);
        
        let lastOffset = 0;
        const wallLen = side === 'top' || side === 'bottom' ? w : h;

        sortedOps.forEach((op, opIdx) => {
          // Wall segment from last offset to op.offset
          if (op.offset > lastOffset + 10) {
            const sg1 = localToGlobal(lx1 + dx * lastOffset, ly1 + dy * lastOffset);
            const sg2 = localToGlobal(lx1 + dx * op.offset, ly1 + dy * op.offset);
            newObjects.push({
              id: `wall_exploded_${timestamp}_${side}_seg_${opIdx}`,
              type: 'wall',
              layerId: room.layerId || 'layer_structural_walls',
              visible: true,
              locked: false,
              x1: sg1.x,
              y1: sg1.y,
              x2: sg2.x,
              y2: sg2.y,
              thickness: wallConf.thickness,
              style: wallConf.style,
              rotation: 0,
            });
          }

          // Create Door or Window object placed at opening center
          const opMidOffset = op.offset + op.width / 2;
          const gMid = localToGlobal(lx1 + dx * opMidOffset, ly1 + dy * opMidOffset);
          const baseRot = side === 'top' ? 0 : side === 'right' ? 90 : side === 'bottom' ? 180 : 270;
          const globalRot = (room.rotation + baseRot) % 360;

          if (op.type === 'door') {
            newObjects.push({
              id: `door_exploded_${timestamp}_${op.id}`,
              type: 'door',
              layerId: room.layerId || 'layer_doors_windows',
              visible: true,
              locked: false,
              x: gMid.x,
              y: gMid.y,
              width: op.width,
              rotation: globalRot,
              hingeSide: op.hingeSide || 'left',
              swingDirection: op.swingDirection || 'inward',
              openingAngle: op.openingAngle ?? 90,
            });
          } else if (op.type === 'window') {
            newObjects.push({
              id: `window_exploded_${timestamp}_${op.id}`,
              type: 'window',
              layerId: room.layerId || 'layer_doors_windows',
              visible: true,
              locked: false,
              x: gMid.x,
              y: gMid.y,
              width: op.width,
              thickness: wallConf.thickness,
              rotation: globalRot,
              style: 'double-line',
            });
          }

          lastOffset = op.offset + op.width;
        });

        // Remaining wall segment from lastOffset to wall length
        if (wallLen > lastOffset + 10) {
          const sg1 = localToGlobal(lx1 + dx * lastOffset, ly1 + dy * lastOffset);
          const sg2 = localToGlobal(lx2, ly2);
          newObjects.push({
            id: `wall_exploded_${timestamp}_${side}_final`,
            type: 'wall',
            layerId: room.layerId || 'layer_structural_walls',
            visible: true,
            locked: false,
            x1: sg1.x,
            y1: sg1.y,
            x2: sg2.x,
            y2: sg2.y,
            thickness: wallConf.thickness,
            style: wallConf.style,
            rotation: 0,
          });
        }
      }
    });

    // Add Label Text Object if visible
    if (room.showLabel) {
      const lxOffset = room.labelX ?? 0;
      const lyOffset = room.labelY ?? 0;
      const labelG = localToGlobal(lxOffset, lyOffset);
      newObjects.push({
        id: `text_exploded_${timestamp}`,
        type: 'text',
        layerId: 'layer_labels',
        visible: true,
        locked: false,
        x: labelG.x,
        y: labelG.y,
        text: room.areaLabel ? `${room.name}\n${room.areaLabel}` : room.name,
        fontSize: 240,
        fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
        fontWeight: '600',
        align: 'center',
        rotation: room.rotation,
        color: '#0f172a',
      });
    }

    explodeRoom(room.id, newObjects);
  };

  if (!selectedObj) {
    return (
      <div className="properties-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header" style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('prop.title')}</span>
        </div>
        <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {t('prop.noSelection')}
        </div>
      </div>
    );
  }

  const handleTextChange = (field: string, val: string) => {
    updateObjectDirect(selectedObj.id, { [field]: val });
  };

  const handleNumChange = (field: string, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateObjectDirect(selectedObj.id, { [field]: num });
    }
  };

  const handleBoolChange = (field: string, val: boolean) => {
    updateObject(selectedObj.id, { [field]: val });
  };

  const handleSelectChange = (field: string, val: string) => {
    updateObject(selectedObj.id, { [field]: val });
  };

  const numericHandlers = (field: string, val: number, step = 100, shiftStep = 500) => {
    return {
      onWheel: (e: React.WheelEvent<HTMLInputElement>) => {
        e.preventDefault();
        beginEditSession(`${selectedObj.id}:${field}`);
        if (document.activeElement !== e.currentTarget) {
          e.currentTarget.focus();
        }
        const factor = e.deltaY < 0 ? 1 : -1;
        const currentStep = e.shiftKey ? shiftStep : step;
        const newVal = val + factor * currentStep;
        const formattedVal = Number(newVal.toFixed(3));
        handleNumChange(field, String(formattedVal));
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          beginEditSession(`${selectedObj.id}:${field}`);
          const factor = e.key === 'ArrowUp' ? 1 : -1;
          const currentStep = e.shiftKey ? shiftStep : step;
          const newVal = val + factor * currentStep;
          const formattedVal = Number(newVal.toFixed(3));
          handleNumChange(field, String(formattedVal));
        }
      }
    };
  };

  const updateRoomOpeningDirect = (opId: string, updates: any) => {
    if (!selectedObj || selectedObj.type !== 'room') return;
    const room = selectedObj as any;
    const getWallLength = (side: 'top' | 'right' | 'bottom' | 'left') => {
      return side === 'top' || side === 'bottom' ? room.width : room.height;
    };
    const updated = (room.openings || []).map((o: any) => {
      if (o.id !== opId) return o;
      const merged = { ...o, ...updates } as any;
      if (grid.snap) {
        const step = grid.size >= 500 ? 100 : 50;
        if (updates.width !== undefined) {
          merged.width = Math.round(merged.width / step) * step;
        }
        if (updates.offset !== undefined) {
          merged.offset = Math.round(merged.offset / step) * step;
        }
      }
      const wallLen = getWallLength(merged.wall);
      merged.width = Math.min(wallLen, Math.max(100, merged.width));
      merged.offset = Math.min(wallLen - merged.width, Math.max(0, merged.offset));
      return merged;
    });
    updateObjectDirect(room.id, { openings: updated });
  };

  const roomOpeningHandlers = (opId: string, field: string, val: number, step = 100, shiftStep = 500) => ({
    onWheel: (e: React.WheelEvent<HTMLInputElement>) => {
      e.preventDefault();
      beginEditSession(`${selectedObj.id}:opening:${opId}:${field}`);
      if (document.activeElement !== e.currentTarget) {
        e.currentTarget.focus();
      }
      const factor = e.deltaY < 0 ? 1 : -1;
      const currentStep = e.shiftKey ? shiftStep : step;
      const newVal = val + factor * currentStep;
      updateRoomOpeningDirect(opId, { [field]: Math.max(0, newVal) });
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        beginEditSession(`${selectedObj.id}:opening:${opId}:${field}`);
        const factor = e.key === 'ArrowUp' ? 1 : -1;
        const currentStep = e.shiftKey ? shiftStep : step;
        const newVal = val + factor * currentStep;
        updateRoomOpeningDirect(opId, { [field]: Math.max(0, newVal) });
      }
    }
  });

  const isWallOrDimension = selectedObj.type === 'wall' || selectedObj.type === 'dimension';
  const hasWidth = ['column', 'furniture', 'door', 'window', 'stair', 'elevator', 'background', 'room'].includes(selectedObj.type);
  const hasHeight = ['column', 'furniture', 'stair', 'elevator', 'background', 'room'].includes(selectedObj.type);

  return (
    <div className="properties-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('prop.title')}</span>
        <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
          {selectedObj.type}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Basic Fields */}
        <div className="prop-row">
          <span className="prop-label">ID</span>
          <input className="prop-input" type="text" value={selectedObj.id} disabled style={{ backgroundColor: '#f1f5f9', color: 'var(--text-secondary)' }} />
        </div>

        <div className="prop-row">
          <span className="prop-label">{t('prop.layer')}</span>
          <select 
            className="prop-input" 
            value={selectedObj.layerId} 
            onChange={(e) => handleSelectChange('layerId', e.target.value)}
          >
            {layers.map((l: Layer) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Lock & Visible Toggles */}
        <div style={{ display: 'flex', gap: '16px', margin: '4px 0', fontSize: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
            <input 
              type="checkbox" 
              checked={selectedObj.visible !== false} 
              onChange={(e) => handleBoolChange('visible', e.target.checked)}
            />
            {t('prop.visible')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
            <input 
              type="checkbox" 
              checked={selectedObj.locked === true} 
              onChange={(e) => handleBoolChange('locked', e.target.checked)}
            />
            {t('prop.locked')}
          </label>
        </div>

        <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>

        {/* Positional geometry */}
        {isWallOrDimension ? (
          // Coordinate vectors x1, y1, x2, y2
          <>
            <div className="prop-row">
              <span className="prop-label">{t('prop.startX')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).x1 ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:x1`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('x1', e.target.value)}
                {...numericHandlers('x1', (selectedObj as any).x1 ?? 0)}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.startY')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).y1 ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:y1`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('y1', e.target.value)}
                {...numericHandlers('y1', (selectedObj as any).y1 ?? 0)}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.endX')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).x2 ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:x2`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('x2', e.target.value)}
                {...numericHandlers('x2', (selectedObj as any).x2 ?? 0)}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.endY')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).y2 ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:y2`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('y2', e.target.value)}
                {...numericHandlers('y2', (selectedObj as any).y2 ?? 0)}
              />
            </div>
            {selectedObj.type === 'wall' && (
              <div className="prop-row">
                <span className="prop-label">{t('prop.thickness')}</span>
                <input 
                  className="prop-input" 
                  type="number" 
                  value={(selectedObj as any).thickness ?? 200} 
                  onFocus={() => beginEditSession(`${selectedObj.id}:thickness`)}
                  onBlur={endEditSession}
                  onChange={(e) => handleNumChange('thickness', e.target.value)}
                  {...numericHandlers('thickness', (selectedObj as any).thickness ?? 200, 10, 50)}
                />
              </div>
            )}
            {selectedObj.type === 'dimension' && (() => {
              const dim = selectedObj as DimensionObject;
              const currentMode = dim.labelMode || (dim.textOverride || dim.displayText ? 'manual' : 'auto');
              const len = getDimensionLengthMm(dim);
              const formattedCalculated = `${formatDimensionLabel(len, 'mm')}mm / ${formatDimensionLabel(len, 'm')}`;

              return (
                <>
                  <div className="prop-row">
                    <span className="prop-label">{t('prop.offset')}</span>
                    <input 
                      className="prop-input" 
                      type="number" 
                      value={dim.offset ?? -500} 
                      onFocus={() => beginEditSession(`${selectedObj.id}:offset`)}
                      onBlur={endEditSession}
                      onChange={(e) => handleNumChange('offset', e.target.value)}
                      {...numericHandlers('offset', dim.offset ?? -500, 50, 250)}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">{t('prop.labelMode')}</span>
                    <select
                      className="prop-input"
                      value={currentMode}
                      onChange={(e) => handleSelectChange('labelMode', e.target.value)}
                    >
                      <option value="auto">{t('prop.auto')}</option>
                      <option value="mm">mm</option>
                      <option value="m">m</option>
                      <option value="manual">{t('prop.manual')}</option>
                    </select>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '80px', marginTop: '-4px', marginBottom: '4px' }}>
                    {t('prop.length')}: {formattedCalculated}
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">{t('prop.labelText')}</span>
                    <input 
                      className="prop-input" 
                      type="text" 
                      value={dim.displayText ?? ''} 
                      placeholder="Auto calculate"
                      disabled={currentMode !== 'manual'}
                      onChange={(e) => handleTextChange('displayText', e.target.value)}
                      onFocus={() => beginEditSession(`${selectedObj.id}:displayText`)}
                      onBlur={endEditSession}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">{t('prop.labelScale')}</span>
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <button
                        className="toolbar-btn"
                        style={{ padding: '0 6px', height: '30px', flex: 1, minWidth: '32px' }}
                        onClick={() => {
                          const cur = dim.labelFontScale ?? 1;
                          const next = Math.max(0.2, Math.round((cur - 0.1) * 10) / 10);
                          updateObject(dim.id, { labelFontScale: next });
                        }}
                        title={t('prop.decreaseLabelSize')}
                      >
                        A−
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                        {Math.round((dim.labelFontScale ?? 1) * 100)}%
                      </span>
                      <button
                        className="toolbar-btn"
                        style={{ padding: '0 6px', height: '30px', flex: 1, minWidth: '32px' }}
                        onClick={() => {
                          const cur = dim.labelFontScale ?? 1;
                          const next = Math.min(5.0, Math.round((cur + 0.1) * 10) / 10);
                          updateObject(dim.id, { labelFontScale: next });
                        }}
                        title={t('prop.increaseLabelSize')}
                      >
                        A+
                      </button>
                      <button
                        className="toolbar-btn"
                        style={{ padding: '0 6px', height: '30px', fontSize: '11px', flex: 1.5 }}
                        onClick={() => {
                          updateObject(dim.id, { labelFontScale: 1.0 });
                        }}
                        title={t('prop.resetLabelSizeTitle')}
                      >
                        {t('common.reset')}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        ) : (
          // Center coordinate x, y and rotation
          <>
            <div className="prop-row">
              <span className="prop-label">{t('prop.posX')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).x ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:x`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('x', e.target.value)}
                {...numericHandlers('x', (selectedObj as any).x ?? 0)}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.posY')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).y ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:y`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('y', e.target.value)}
                {...numericHandlers('y', (selectedObj as any).y ?? 0)}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.rotationLabel')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={selectedObj.rotation ?? 0} 
                onFocus={() => beginEditSession(`${selectedObj.id}:rotation`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('rotation', e.target.value)}
                {...numericHandlers('rotation', selectedObj.rotation ?? 0, 5, 45)}
              />
            </div>
          </>
        )}

        {/* Sizes */}
        {hasWidth && (
          <div className="prop-row">
            <span className="prop-label">{t('prop.widthRaw')}</span>
            <input 
              className="prop-input" 
              type="number" 
              value={(selectedObj as any).width ?? 0} 
              onFocus={() => beginEditSession(`${selectedObj.id}:width`)}
              onBlur={endEditSession}
              onChange={(e) => handleNumChange('width', e.target.value)}
              {...numericHandlers('width', (selectedObj as any).width ?? 0)}
            />
          </div>
        )}
        {hasHeight && (
          <div className="prop-row">
            <span className="prop-label">{t('prop.heightRaw')}</span>
            <input 
              className="prop-input" 
              type="number" 
              value={(selectedObj as any).height ?? 0} 
              onFocus={() => beginEditSession(`${selectedObj.id}:height`)}
              onBlur={endEditSession}
              onChange={(e) => handleNumChange('height', e.target.value)}
              {...numericHandlers('height', (selectedObj as any).height ?? 0)}
            />
          </div>
        )}

        {/* Colors & Fills */}
        {['column', 'furniture', 'stair', 'elevator', 'shape'].includes(selectedObj.type) && (
          <>
            <div className="prop-row" style={{ gridColumn: 'span 2', marginTop: '8px' }}>
              <span className="prop-label" style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Colors & Styles
              </span>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.fillColor') || "Fill Color"}</span>
              <input
                className="prop-input"
                type="text"
                value={(selectedObj as any).fill ?? ''}
                placeholder="e.g. #cbd5e1 or transparent"
                onChange={(e) => handleTextChange('fill', e.target.value)}
                onFocus={() => beginEditSession(`${selectedObj.id}:fill`)}
                onBlur={endEditSession}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">Border Color</span>
              <input
                className="prop-input"
                type="text"
                value={(selectedObj as any).stroke ?? ''}
                placeholder="e.g. #1e293b"
                onChange={(e) => handleTextChange('stroke', e.target.value)}
                onFocus={() => beginEditSession(`${selectedObj.id}:stroke`)}
                onBlur={endEditSession}
              />
            </div>
          </>
        )}

        {selectedObj.type !== 'wall' && selectedObj.type !== 'dimension' && (() => {
          const policy = getObjectTransformPolicy(selectedObj);
          const allowStretchVal = (selectedObj as any).allowStretch ?? policy.allowStretch;
          const lockAspectVal = (selectedObj as any).lockAspectRatio ?? policy.lockAspectRatio;

          return (
            <>
              <div className="prop-row" style={{ gridColumn: 'span 2', marginTop: '6px' }}>
                <span className="prop-label" style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {t('prop.transformBehavior')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={allowStretchVal}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateObject(selectedObj.id, {
                        allowStretch: checked,
                        lockAspectRatio: !checked
                      });
                    }}
                  />
                  <span>{t('prop.allowStretch')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={lockAspectVal}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateObject(selectedObj.id, {
                        lockAspectRatio: checked,
                        allowStretch: !checked
                      });
                    }}
                  />
                  <span>{t('prop.lockAspectRatio')}</span>
                </label>
              </div>
            </>
          );
        })()}

        {selectedObj.type === 'furniture' && (selectedObj as FurnitureObject).furnitureSetRole === 'anchor'
          && (selectedObj as FurnitureObject).furnitureType === 'student_desk'
          && (selectedObj as FurnitureObject).furnitureSetId && (() => {
          const desk = selectedObj as FurnitureObject;
          const setId = desk.furnitureSetId as string;
          const chairs = objects.filter(
            (o): o is FurnitureObject => o.type === 'furniture' && (o as FurnitureObject).furnitureSetId === setId && (o as FurnitureObject).furnitureSetRole === 'chair',
          );
          const chairCount = chairs.length;
          const chairSide: ChairSide = desk.chairSide ?? 'front';

          const applyRelayout = (opts: Partial<{ chairCount: number; chairSide: ChairSide }>) => {
            pushToHistory();
            setObjects(relayoutDeskChairSet(objects, desk.id, opts));
            setSelectedIds([desk.id]);
          };

          const handleUngroup = () => {
            pushToHistory();
            setObjects(objects.map((o) => {
              if (o.type !== 'furniture' || (o as FurnitureObject).furnitureSetId !== setId) return o;
              const { furnitureSetId: _fsi, furnitureSetRole: _fsr, attachedToId: _ati, chairIndex: _ci, chairSide: _cs, groupId: _gid, ...rest } = o as FurnitureObject;
              return rest as MapObject;
            }));
          };

          return (
            <>
              <div className="prop-row" style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                <span className="prop-label" style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {t('prop.deskChairs') || 'Desk Chairs'}
                </span>
              </div>
              <div className="prop-row" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="toolbar-btn"
                  style={{ width: '30px', height: '30px' }}
                  disabled={chairCount <= 0}
                  onClick={() => applyRelayout({ chairCount: Math.max(0, chairCount - 1) })}
                >
                  −
                </button>
                <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 600 }}>{chairCount}</span>
                <button
                  type="button"
                  className="toolbar-btn"
                  style={{ width: '30px', height: '30px' }}
                  disabled={chairCount >= 8}
                  onClick={() => applyRelayout({ chairCount: Math.min(8, chairCount + 1) })}
                >
                  +
                </button>
              </div>
              <div className="prop-row">
                <span className="prop-label">{t('prop.chairSide') || 'Side'}</span>
                <select
                  className="prop-input"
                  value={chairSide}
                  onChange={(e) => applyRelayout({ chairSide: e.target.value as ChairSide })}
                >
                  <option value="front">{t('parts.modal.deskChair.chairSide.front')}</option>
                  <option value="back">{t('parts.modal.deskChair.chairSide.back')}</option>
                  <option value="left">{t('parts.modal.deskChair.chairSide.left')}</option>
                  <option value="right">{t('parts.modal.deskChair.chairSide.right')}</option>
                  <option value="around">{t('parts.modal.deskChair.chairSide.around')}</option>
                </select>
              </div>
              <div className="prop-row" style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="button" className="toolbar-btn" style={{ flex: 1 }} onClick={() => applyRelayout({})}>
                  {t('prop.resetChairPositions') || 'Reset chair positions'}
                </button>
                <button type="button" className="toolbar-btn" style={{ flex: 1 }} onClick={handleUngroup}>
                  {t('prop.ungroupDeskChairs') || 'Ungroup'}
                </button>
              </div>
            </>
          );
        })()}

        {/* Type specific details */}
        {selectedObj.type === 'text' && (
          <>
            <div className="prop-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span className="prop-label">{t('prop.fontSize')}</span>
                <input 
                  className="prop-input" 
                  type="number" 
                  style={{ width: '80px' }}
                  value={(selectedObj as any).fontSize ?? 200} 
                  onFocus={() => beginEditSession(`${selectedObj.id}:fontSize`)}
                  onBlur={endEditSession}
                  onChange={(e) => handleNumChange('fontSize', e.target.value)}
                  {...numericHandlers('fontSize', (selectedObj as any).fontSize ?? 200, 10, 50)}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px', width: '100%', paddingLeft: '80px' }}>
                <button
                  className="toolbar-btn"
                  style={{ padding: '0 6px', height: '30px', flex: 1, minWidth: '32px' }}
                  onClick={() => {
                    const cur = (selectedObj as any).fontSize ?? 200;
                    const next = Math.max(10, cur - 20);
                    updateObject(selectedObj.id, { fontSize: next });
                  }}
                  title={t('prop.decreaseFontSize')}
                >
                  A−
                </button>
                <button
                  className="toolbar-btn"
                  style={{ padding: '0 6px', height: '30px', flex: 1, minWidth: '32px' }}
                  onClick={() => {
                    const cur = (selectedObj as any).fontSize ?? 200;
                    const next = Math.min(2000, cur + 20);
                    updateObject(selectedObj.id, { fontSize: next });
                  }}
                  title={t('prop.increaseFontSize')}
                >
                  A+
                </button>
                <button
                  className="toolbar-btn"
                  style={{ padding: '0 6px', height: '30px', fontSize: '11px', flex: 1.5 }}
                  onClick={() => {
                    updateObject(selectedObj.id, { fontSize: 200 });
                  }}
                  title={t('prop.resetFontSizeTitle')}
                >
                  {t('common.reset')}
                </button>
              </div>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.fontFamily')}</span>
              <select 
                className="prop-input" 
                value={(selectedObj as any).fontFamily || '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif'} 
                onChange={(e) => handleSelectChange('fontFamily', e.target.value)}
              >
                <option value='"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif'>Noto Sans JP / Japanese Sans</option>
                <option value='system-ui, -apple-system, sans-serif'>System Sans</option>
                <option value='"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'>Serif</option>
                <option value='ui-monospace, SFMono-Regular, "Courier New", monospace'>Monospace</option>
              </select>
            </div>
            <div className="prop-row" style={{ gridTemplateColumns: '80px 1fr', alignItems: 'start' }}>
              <span className="prop-label">{t('prop.text')}</span>
              <textarea 
                className="prop-input" 
                rows={3}
                style={{ fontFamily: 'var(--font-sans)', resize: 'vertical' }}
                value={(selectedObj as any).text ?? ''} 
                onChange={(e) => handleTextChange('text', e.target.value)}
                onFocus={() => beginEditSession(`${selectedObj.id}:text`)}
                onBlur={endEditSession}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', margin: '4px 0', fontSize: '12px', paddingLeft: '80px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={(selectedObj as any).keepUpright !== false} 
                  onChange={(e) => handleBoolChange('keepUpright', e.target.checked)}
                />
                {t('prop.keepUpright')}
              </label>
            </div>
          </>
        )}

        {selectedObj.type === 'door' && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t('prop.hingeSide')}</span>
              <select 
                className="prop-input" 
                value={(selectedObj as any).hingeSide} 
                onChange={(e) => handleSelectChange('hingeSide', e.target.value)}
              >
                <option value="left">{t('prop.left')}</option>
                <option value="right">{t('prop.right')}</option>
              </select>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.swingDir')}</span>
              <select 
                className="prop-input" 
                value={(selectedObj as any).swingDirection} 
                onChange={(e) => handleSelectChange('swingDirection', e.target.value)}
              >
                <option value="inward">{t('prop.inward')}</option>
                <option value="outward">{t('prop.outward')}</option>
              </select>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.angleLabel')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).openingAngle ?? 90} 
                onFocus={() => beginEditSession(`${selectedObj.id}:openingAngle`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('openingAngle', e.target.value)}
                {...numericHandlers('openingAngle', (selectedObj as any).openingAngle ?? 90, 5, 45)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                className="toolbar-btn"
                style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                onClick={() => {
                  const current = (selectedObj as any).hingeSide || 'left';
                  handleSelectChange('hingeSide', current === 'left' ? 'right' : 'left');
                }}
              >
                {t('prop.flipHinge')}
              </button>
              <button
                className="toolbar-btn"
                style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                onClick={() => {
                  const current = (selectedObj as any).swingDirection || 'inward';
                  handleSelectChange('swingDirection', current === 'inward' ? 'outward' : 'inward');
                }}
              >
                {t('prop.flipSwing')}
              </button>
            </div>
          </>
        )}

        {selectedObj.type === 'stair' && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t('prop.steps')}</span>
              <input 
                className="prop-input" 
                type="number" 
                value={(selectedObj as any).steps ?? 8} 
                onFocus={() => beginEditSession(`${selectedObj.id}:steps`)}
                onBlur={endEditSession}
                onChange={(e) => handleNumChange('steps', e.target.value)}
                {...numericHandlers('steps', (selectedObj as any).steps ?? 8, 1, 5)}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t('prop.direction')}</span>
              <select 
                className="prop-input" 
                value={(selectedObj as any).direction || 'up'} 
                onChange={(e) => handleSelectChange('direction', e.target.value)}
              >
                <option value="up">{t('prop.up')}</option>
                <option value="down">{t('prop.down')}</option>
              </select>
            </div>
          </>
        )}

        {selectedObj.type === 'elevator' && (
          <div className="prop-row">
            <span className="prop-label">{t('prop.type')}</span>
            <select
              className="prop-input"
              value={(selectedObj as any).elevatorType || (selectedObj.id.startsWith('freight_lift') ? 'freight_lift' : 'elevator')}
              onChange={(e) => handleSelectChange('elevatorType', e.target.value)}
            >
              <option value="elevator">{t('prop.elevatorType')}</option>
              <option value="freight_lift">{t('prop.freightLiftType')}</option>
            </select>
          </div>
        )}

        {selectedObj.type === 'background' && (
          <div className="prop-row">
            <span className="prop-label">{t('prop.opacity')}</span>
            <input 
              className="prop-input" 
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={(selectedObj as any).opacity ?? 0.5} 
              onFocus={() => beginEditSession(`${selectedObj.id}:opacity`)}
              onBlur={endEditSession}
              onChange={(e) => handleNumChange('opacity', e.target.value)}
              {...numericHandlers('opacity', (selectedObj as any).opacity ?? 0.5, 0.05, 0.25)}
            />
          </div>
        )}

        {selectedObj.type === 'room' && (() => {
          const room = selectedObj as RoomObject;
          
          const handleWallChange = (wallKey: 'top' | 'right' | 'bottom' | 'left', field: string, value: any) => {
            const updatedWalls = {
              ...room.walls,
              [wallKey]: {
                ...room.walls[wallKey],
                [field]: value
              }
            };
            updateObject(room.id, { walls: updatedWalls });
          };

          const handleWallChangeDirect = (wallKey: 'top' | 'right' | 'bottom' | 'left', field: string, value: any) => {
            const updatedWalls = {
              ...room.walls,
              [wallKey]: {
                ...room.walls[wallKey],
                [field]: value
              }
            };
            updateObjectDirect(room.id, { walls: updatedWalls });
          };

          const wallThicknessHandlers = (side: 'top' | 'right' | 'bottom' | 'left', val: number) => ({
            onWheel: (e: React.WheelEvent<HTMLInputElement>) => {
              e.preventDefault();
              beginEditSession(`${room.id}:wall:${side}:thickness`);
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.focus();
              }
              const factor = e.deltaY < 0 ? 1 : -1;
              const currentStep = e.shiftKey ? 50 : 10;
              const newVal = val + factor * currentStep;
              handleWallChangeDirect(side, 'thickness', Math.max(0, newVal));
            },
            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                beginEditSession(`${room.id}:wall:${side}:thickness`);
                const factor = e.key === 'ArrowUp' ? 1 : -1;
                const currentStep = e.shiftKey ? 50 : 10;
                const newVal = val + factor * currentStep;
                handleWallChangeDirect(side, 'thickness', Math.max(0, newVal));
              }
            }
          });

          const setAllWallsStyle = (style: 'exterior' | 'interior' | 'guide') => {
            const updatedWalls = {
              top: { ...room.walls.top, style },
              right: { ...room.walls.right, style },
              bottom: { ...room.walls.bottom, style },
              left: { ...room.walls.left, style },
            };
            updateObject(room.id, { walls: updatedWalls });
          };

          const resetAllWallsThickness = (thickness: number) => {
            const updatedWalls = {
              top: { ...room.walls.top, thickness },
              right: { ...room.walls.right, thickness },
              bottom: { ...room.walls.bottom, thickness },
              left: { ...room.walls.left, thickness },
            };
            updateObject(room.id, { walls: updatedWalls });
          };

          return (
            <>
              {/* General Room Settings */}
              <div className="prop-row">
                <span className="prop-label">{t('prop.roomName')}</span>
                <input
                  className="prop-input"
                  type="text"
                  value={room.name ?? ''}
                  onChange={(e) => handleTextChange('name', e.target.value)}
                  onFocus={() => beginEditSession(`${room.id}:name`)}
                  onBlur={endEditSession}
                />
              </div>

              <div className="prop-row">
                <span className="prop-label">{t('prop.areaMode')}</span>
                <select
                  className="prop-input"
                  value={room.areaLabelMode || (room.areaLabel ? 'manual' : 'auto')}
                  onChange={(e) => handleSelectChange('areaLabelMode', e.target.value)}
                >
                  <option value="auto">{t('prop.auto')}</option>
                  <option value="manual">{t('prop.manual')}</option>
                </select>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '80px', marginTop: '-4px', marginBottom: '4px' }}>
                {t('prop.calculated')}: {getRoomAutoAreaLabel(room)}
              </div>

              <div className="prop-row">
                <span className="prop-label">{t('prop.areaLabel')}</span>
                <input
                  className="prop-input"
                  type="text"
                  value={room.areaLabel ?? ''}
                  placeholder={getRoomAutoAreaLabel(room)}
                  disabled={(room.areaLabelMode || (room.areaLabel ? 'manual' : 'auto')) !== 'manual'}
                  onChange={(e) => handleTextChange('areaLabel', e.target.value)}
                  onFocus={() => beginEditSession(`${room.id}:areaLabel`)}
                  onBlur={endEditSession}
                />
              </div>

              {(room.areaLabelMode || (room.areaLabel ? 'manual' : 'auto')) === 'manual' && (
                <div style={{ paddingLeft: '80px', marginBottom: '8px' }}>
                  <button
                    className="toolbar-btn"
                    style={{ fontSize: '11px', padding: '4px 8px', height: 'auto', width: '100%' }}
                    onClick={() => {
                      updateObject(room.id, { areaLabel: getRoomAutoAreaLabel(room) });
                    }}
                  >
                    {t('prop.useCalculatedArea')}
                  </button>
                </div>
              )}

              <div className="prop-row">
                <span className="prop-label">{t('prop.fillColor')}</span>
                <input
                  className="prop-input"
                  type="text"
                  value={room.fill ?? ''}
                  placeholder="e.g. rgba(0,0,0,0.05) or #f0f0f0"
                  onChange={(e) => handleTextChange('fill', e.target.value)}
                  onFocus={() => beginEditSession(`${room.id}:fill`)}
                  onBlur={endEditSession}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', margin: '4px 0', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={room.showLabel !== false}
                    onChange={(e) => handleBoolChange('showLabel', e.target.checked)}
                  />
                  {t('prop.showLabel')}
                </label>
              </div>

              {/* Label Coordinates */}
              <div className="prop-row">
                <span className="prop-label">{t('prop.labelX')}</span>
                <input
                  className="prop-input"
                  type="number"
                  value={room.labelX ?? 0}
                  onFocus={() => beginEditSession(`${room.id}:labelX`)}
                  onBlur={endEditSession}
                  onChange={(e) => handleNumChange('labelX', e.target.value)}
                  {...numericHandlers('labelX', room.labelX ?? 0)}
                />
              </div>
              <div className="prop-row">
                <span className="prop-label">{t('prop.labelY')}</span>
                <input
                  className="prop-input"
                  type="number"
                  value={room.labelY ?? 0}
                  onFocus={() => beginEditSession(`${room.id}:labelY`)}
                  onBlur={endEditSession}
                  onChange={(e) => handleNumChange('labelY', e.target.value)}
                  {...numericHandlers('labelY', room.labelY ?? 0)}
                />
              </div>
              <button
                className="toolbar-btn"
                style={{ fontSize: '11px', padding: '4px 8px', width: 'fit-content', marginLeft: '80px', marginBottom: '8px' }}
                onClick={() => {
                  updateObject(room.id, { labelX: 0, labelY: 0 });
                }}
              >
                {t('prop.centerLabel')}
              </button>

              <div className="prop-row">
                <span className="prop-label">{t('prop.labelScale')}</span>
                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                  <button
                    className="toolbar-btn"
                    style={{ padding: '0 6px', height: '30px', flex: 1, minWidth: '32px' }}
                    onClick={() => {
                      const cur = room.labelFontScale ?? 1;
                      const next = Math.max(0.2, Math.round((cur - 0.1) * 10) / 10);
                      updateObject(room.id, { labelFontScale: next });
                    }}
                    title={t('prop.decreaseLabelSize')}
                  >
                    A−
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                    {Math.round((room.labelFontScale ?? 1) * 100)}%
                  </span>
                  <button
                    className="toolbar-btn"
                    style={{ padding: '0 6px', height: '30px', flex: 1, minWidth: '32px' }}
                    onClick={() => {
                      const cur = room.labelFontScale ?? 1;
                      const next = Math.min(5.0, Math.round((cur + 0.1) * 10) / 10);
                      updateObject(room.id, { labelFontScale: next });
                    }}
                    title={t('prop.increaseLabelSize')}
                  >
                    A+
                  </button>
                  <button
                    className="toolbar-btn"
                    style={{ padding: '0 6px', height: '30px', fontSize: '11px', flex: 1.5 }}
                    onClick={() => {
                      updateObject(room.id, { labelFontScale: 1.0 });
                    }}
                    title={t('prop.resetLabelSizeTitle')}
                  >
                    {t('common.reset')}
                  </button>
                </div>
              </div>

              <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {t('prop.wallSideSettings')} {selectedRoomSide?.roomId === room.id ? `(${t('prop.selected')}: ${t(`prop.${selectedRoomSide.side}`)[0].toUpperCase() + t(`prop.${selectedRoomSide.side}`).slice(1)})` : ''}
              </div>

              {/* Wall Side Settings */}
              {(() => {
                const sides = ['top', 'right', 'bottom', 'left'] as const;
                const sortedSides = [...sides];
                if (selectedRoomSide?.roomId === room.id) {
                  const idx = sortedSides.indexOf(selectedRoomSide.side);
                  if (idx > -1) {
                    sortedSides.splice(idx, 1);
                    sortedSides.unshift(selectedRoomSide.side);
                  }
                }
                return sortedSides;
              })().map((side) => {
                const isSideSelected = selectedRoomSide?.roomId === room.id && selectedRoomSide?.side === side;
                const wallConf = room.walls[side] || { visible: true, thickness: 180, style: 'exterior' };
                return (
                  <div 
                    key={side} 
                    style={{ 
                      padding: '8px', 
                      border: isSideSelected ? '1.5px solid #3b82f6' : '1px solid var(--border-light)', 
                      borderRadius: '6px', 
                      backgroundColor: isSideSelected ? '#eff6ff' : '#f8fafc', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px', 
                      marginBottom: '6px' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', color: isSideSelected ? '#1e3a8a' : 'var(--text-primary)' }}>
                        {t(`prop.${side}`)} {t('prop.wall')} {isSideSelected ? `★ (${t('prop.selected')})` : ''}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={wallConf.visible !== false}
                          onChange={(e) => handleWallChange(side, 'visible', e.target.checked)}
                        />
                        {t('prop.visible')}
                      </label>
                    </div>

                    {wallConf.visible !== false && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.thickness')}</span>
                          <input
                            style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                            type="number"
                            value={wallConf.thickness ?? 180}
                            onFocus={() => beginEditSession(`${room.id}:wall:${side}:thickness`)}
                            onBlur={endEditSession}
                            onChange={(e) => handleWallChangeDirect(side, 'thickness', parseFloat(e.target.value) || 0)}
                            {...wallThicknessHandlers(side, wallConf.thickness ?? 180)}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.wallStyle')}</span>
                          <select
                            style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                            value={wallConf.style ?? 'exterior'}
                            onChange={(e) => handleWallChange(side, 'style', e.target.value)}
                          >
                            <option value="exterior">{t('prop.exteriorRaw')}</option>
                            <option value="interior">{t('prop.interiorRaw')}</option>
                            <option value="guide">{t('prop.guide')}</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bulk Wall Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  onClick={() => setAllWallsStyle('exterior')}
                >
                  {t('prop.allExterior')}
                </button>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  onClick={() => setAllWallsStyle('interior')}
                >
                  {t('prop.allInterior')}
                </button>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  onClick={() => resetAllWallsThickness(180)}
                >
                  {t('prop.resetThick').replace('{thickness}', '180')}
                </button>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  onClick={() => resetAllWallsThickness(100)}
                >
                  {t('prop.resetThin').replace('{thickness}', '100')}
                </button>
              </div>

              <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {t('prop.wallOpenings')} ({room.openings?.length || 0})
                </span>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }}
                  onClick={() => {
                    const newOp: any = {
                      id: `op_${Date.now()}`,
                      type: 'door',
                      wall: 'top',
                      offset: 500,
                      width: 900,
                      hingeSide: 'left',
                      swingDirection: 'inward',
                      openingAngle: 90,
                    };
                    updateObject(room.id, { openings: [...(room.openings || []), newOp] });
                  }}
                >
                  {t('prop.addOpening')}
                </button>
              </div>

              {/* List of Openings */}
              {(room.openings || []).map((op, idx) => {
                const getWallLength = (side: 'top' | 'right' | 'bottom' | 'left') => {
                  return side === 'top' || side === 'bottom' ? room.width : room.height;
                };

                const wallLen = getWallLength(op.wall);

                const updateOpening = (updates: Partial<typeof op>) => {
                  updateRoomOpeningDirect(op.id, updates);
                };

                return (
                  <div key={op.id} style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        #{idx + 1} {op.type.toUpperCase()}
                      </span>
                      <button
                        style={{ fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => {
                          const updated = (room.openings || []).filter((o) => o.id !== op.id);
                          updateObject(room.id, { openings: updated });
                        }}
                      >
                        {t('prop.deleteOpening')}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.type')}</span>
                        <select
                          style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                          value={op.type}
                          onChange={(e) => updateOpening({ type: e.target.value as any })}
                        >
                          <option value="door">{t('prop.door')}</option>
                          <option value="window">{t('prop.window')}</option>
                          <option value="opening_window">{t('prop.openingWindow') || "Opening Window"}</option>
                          <option value="opening">{t('prop.opening')}</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.wallSide')}</span>
                        <select
                          style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                          value={op.wall}
                          onChange={(e) => updateOpening({ wall: e.target.value as any })}
                        >
                          <option value="top">{t('prop.top')}</option>
                          <option value="right">{t('prop.right')}</option>
                          <option value="bottom">{t('prop.bottom')}</option>
                          <option value="left">{t('prop.left')}</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.offsetMax').replace('{max}', String(wallLen))}</span>
                        <input
                          style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                          type="number"
                          value={op.offset}
                          onFocus={() => beginEditSession(`${selectedObj.id}:opening:${op.id}:offset`)}
                          onBlur={endEditSession}
                          onChange={(e) => updateOpening({ offset: parseFloat(e.target.value) || 0 })}
                          {...roomOpeningHandlers(op.id, 'offset', op.offset, 50, 250)}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.widthRaw')}</span>
                        <input
                          style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                          type="number"
                          value={op.width}
                          onFocus={() => beginEditSession(`${selectedObj.id}:opening:${op.id}:width`)}
                          onBlur={endEditSession}
                          onChange={(e) => updateOpening({ width: parseFloat(e.target.value) || 0 })}
                          {...roomOpeningHandlers(op.id, 'width', op.width, 50, 250)}
                        />
                      </div>
                    </div>

                    {(op.type === 'door' || op.type === 'opening_window') && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.hingeSide')}</span>
                            <select
                              style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                              value={op.hingeSide || 'left'}
                              onChange={(e) => updateOpening({ hingeSide: e.target.value as any })}
                            >
                              <option value="left">{t('prop.left')}</option>
                              <option value="right">{t('prop.right')}</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.swingDirection')}</span>
                            <select
                              style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                              value={op.swingDirection || 'inward'}
                              onChange={(e) => updateOpening({ swingDirection: e.target.value as any })}
                            >
                              <option value="inward">{t('prop.inward')}</option>
                              <option value="outward">{t('prop.outward')}</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.openingAngle')}</span>
                          <input
                            style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                            type="number"
                            value={op.openingAngle ?? 90}
                            onFocus={() => beginEditSession(`${selectedObj.id}:opening:${op.id}:openingAngle`)}
                            onBlur={endEditSession}
                            onChange={(e) => updateOpening({ openingAngle: parseFloat(e.target.value) || 0 })}
                            {...roomOpeningHandlers(op.id, 'openingAngle', op.openingAngle ?? 90, 5, 45)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
        {selectedObj.type === 'room' && (
          <>
            <button 
              className="toolbar-btn" 
              style={{ width: '100%', marginTop: '4px', borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} 
              onClick={handleExplodeRoom}
            >
              <Icons.StraightWallIcon size={14} />
              {t('prop.explodeToWalls')}
            </button>

            {(() => {
              const room = selectedObj as RoomObject;
              const W = room.width;
              const H = room.height;

              const splitRoomVertically = () => {
                const W_new = Math.round(W / 2);
                const rad = (room.rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const shiftX = (W / 4) * cos;
                const shiftY = (W / 4) * sin;

                const idA = `room_${Date.now()}_A`;
                const roomA: RoomObject = {
                  ...room,
                  id: idA,
                  name: `${room.name} A`,
                  x: Math.round(room.x - shiftX),
                  y: Math.round(room.y - shiftY),
                  width: W_new,
                  walls: {
                    top: { ...room.walls.top },
                    bottom: { ...room.walls.bottom },
                    left: { ...room.walls.left },
                    right: { visible: true, thickness: 180, style: 'interior' }
                  },
                  openings: []
                };

                const idB = `room_${Date.now()}_B`;
                const roomB: RoomObject = {
                  ...room,
                  id: idB,
                  name: `${room.name} B`,
                  x: Math.round(room.x + shiftX),
                  y: Math.round(room.y + shiftY),
                  width: W_new,
                  walls: {
                    top: { ...room.walls.top },
                    bottom: { ...room.walls.bottom },
                    right: { ...room.walls.right },
                    left: { visible: true, thickness: 180, style: 'interior' }
                  },
                  openings: []
                };

                (room.openings || []).forEach((op) => {
                  const opW = op.width;
                  if (op.wall === 'left') {
                    roomA.openings.push(op);
                  } else if (op.wall === 'right') {
                    roomB.openings.push(op);
                  } else if (op.wall === 'top' || op.wall === 'bottom') {
                    if (op.offset + opW / 2 < W / 2) {
                      roomA.openings.push(op);
                    } else {
                      roomB.openings.push({
                        ...op,
                        offset: Math.max(0, Math.round(op.offset - W / 2))
                      });
                    }
                  }
                });

                const nextObjects = useProjectStore.getState().project.objects
                  .filter(o => o.id !== room.id);
                setObjects([...nextObjects, roomA, roomB]);
              };

              const splitRoomHorizontally = () => {
                const H_new = Math.round(H / 2);
                const rad = (room.rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const shiftX = -(H / 4) * sin;
                const shiftY = (H / 4) * cos;

                const idA = `room_${Date.now()}_A`;
                const roomA: RoomObject = {
                  ...room,
                  id: idA,
                  name: `${room.name} A`,
                  x: Math.round(room.x - shiftX),
                  y: Math.round(room.y - shiftY),
                  height: H_new,
                  walls: {
                    top: { ...room.walls.top },
                    left: { ...room.walls.left },
                    right: { ...room.walls.right },
                    bottom: { visible: true, thickness: 180, style: 'interior' }
                  },
                  openings: []
                };

                const idB = `room_${Date.now()}_B`;
                const roomB: RoomObject = {
                  ...room,
                  id: idB,
                  name: `${room.name} B`,
                  x: Math.round(room.x + shiftX),
                  y: Math.round(room.y + shiftY),
                  height: H_new,
                  walls: {
                    bottom: { ...room.walls.bottom },
                    left: { ...room.walls.left },
                    right: { ...room.walls.right },
                    top: { visible: true, thickness: 180, style: 'interior' }
                  },
                  openings: []
                };

                (room.openings || []).forEach((op) => {
                  const opW = op.width;
                  if (op.wall === 'top') {
                    roomA.openings.push(op);
                  } else if (op.wall === 'bottom') {
                    roomB.openings.push(op);
                  } else if (op.wall === 'left' || op.wall === 'right') {
                    if (op.offset + opW / 2 < H / 2) {
                      roomA.openings.push(op);
                    } else {
                      roomB.openings.push({
                        ...op,
                        offset: Math.max(0, Math.round(op.offset - H / 2))
                      });
                    }
                  }
                });

                const nextObjects = useProjectStore.getState().project.objects
                  .filter(o => o.id !== room.id);
                setObjects([...nextObjects, roomA, roomB]);
              };

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                  <button 
                    className="toolbar-btn" 
                    style={{ fontSize: '11px', padding: '6px 4px', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} 
                    onClick={splitRoomVertically}
                  >
                    <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
                      <Icons.DoorIcon size={12} />
                    </span>
                    {t('prop.splitVertically') || "Split Vertically"}
                  </button>
                  <button 
                    className="toolbar-btn" 
                    style={{ fontSize: '11px', padding: '6px 4px', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} 
                    onClick={splitRoomHorizontally}
                  >
                    <Icons.DoorIcon size={12} />
                    {t('prop.splitHorizontally') || "Split Horizontally"}
                  </button>
                </div>
              );
            })()}
          </>
        )}

        {selectedObj.type === 'wall' && (() => {
          const wall = selectedObj as WallObject;
          const wallLen = Math.round(Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2)));
          const openings = wall.openings || [];

          const addWallOpening = () => {
            const newOp: any = {
              id: `op_${Date.now()}`,
              type: 'door',
              offset: Math.round(wallLen / 2 - 450),
              width: 900,
              hingeSide: 'left',
              swingDirection: 'inward',
              openingAngle: 90,
            };
            updateObject(wall.id, { openings: [...openings, newOp] });
          };

          const updateWallOpening = (opId: string, updates: any) => {
            const updated = openings.map((op: RoomOpening) => {
              if (op.id !== opId) return op;
              const merged = { ...op, ...updates } as any;
              if (grid.snap) {
                const step = grid.size >= 500 ? 100 : 50;
                if (updates.width !== undefined) {
                  merged.width = Math.round(merged.width / step) * step;
                }
                if (updates.offset !== undefined) {
                  merged.offset = Math.round(merged.offset / step) * step;
                }
              }
              merged.width = Math.min(wallLen, Math.max(100, merged.width));
              merged.offset = Math.min(wallLen - merged.width, Math.max(0, merged.offset));
              return merged;
            });
            updateObject(wall.id, { openings: updated });
          };

          const wallOpeningHandlers = (opId: string, field: string, val: number, step = 100, shiftStep = 500) => ({
            onWheel: (e: React.WheelEvent<HTMLInputElement>) => {
              e.preventDefault();
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.focus();
              }
              const factor = e.deltaY < 0 ? 1 : -1;
              const currentStep = e.shiftKey ? shiftStep : step;
              const newVal = val + factor * currentStep;
              updateWallOpening(opId, { [field]: Math.max(0, newVal) });
            },
            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const factor = e.key === 'ArrowUp' ? 1 : -1;
                const currentStep = e.shiftKey ? shiftStep : step;
                const newVal = val + factor * currentStep;
                updateWallOpening(opId, { [field]: Math.max(0, newVal) });
              }
            }
          });

          const deleteWallOpening = (opId: string) => {
            const updated = openings.filter((op: RoomOpening) => op.id !== opId);
            updateObject(wall.id, { openings: updated });
          };

          return (
            <>
              <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {t('prop.wallOpenings') || "Wall Openings"} ({openings.length})
                </span>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }}
                  onClick={addWallOpening}
                >
                  {t('prop.addOpening') || "Add Opening"}
                </button>
              </div>

              {openings.map((op: RoomOpening, idx: number) => (
                <div key={op.id} style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      #{idx + 1} {op.type.toUpperCase()}
                    </span>
                    <button
                      style={{ fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => deleteWallOpening(op.id)}
                    >
                      {t('prop.deleteOpening') || "Delete"}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.type') || "Type"}</span>
                      <select
                        style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                        value={op.type}
                        onChange={(e) => updateWallOpening(op.id, { type: e.target.value })}
                      >
                        <option value="door">{t('prop.door') || "Door"}</option>
                        <option value="window">{t('prop.window') || "Window"}</option>
                        <option value="opening_window">{t('prop.openingWindow') || "Opening Window"}</option>
                        <option value="opening">{t('prop.opening') || "Opening"}</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.widthRaw') || "Width"}</span>
                      <input
                        style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                        type="number"
                        value={op.width}
                        onChange={(e) => updateWallOpening(op.id, { width: parseFloat(e.target.value) || 0 })}
                        {...wallOpeningHandlers(op.id, 'width', op.width, 50, 250)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.offsetMax').replace('{max}', String(wallLen)) || `Offset (max ${wallLen})`}</span>
                      <input
                        style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                        type="number"
                        value={op.offset}
                        onChange={(e) => updateWallOpening(op.id, { offset: parseFloat(e.target.value) || 0 })}
                        {...wallOpeningHandlers(op.id, 'offset', op.offset, 50, 250)}
                      />
                    </div>
                  </div>

                  {(op.type === 'door' || op.type === 'opening_window') && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.hingeSide') || "Hinge Side"}</span>
                          <select
                            style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                            value={op.hingeSide || 'left'}
                            onChange={(e) => updateWallOpening(op.id, { hingeSide: e.target.value })}
                          >
                            <option value="left">{t('prop.left') || "Left"}</option>
                            <option value="right">{t('prop.right') || "Right"}</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.swingDirection') || "Swing"}</span>
                          <select
                            style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                            value={op.swingDirection || 'inward'}
                            onChange={(e) => updateWallOpening(op.id, { swingDirection: e.target.value })}
                          >
                            <option value="inward">{t('prop.inward') || "Inward"}</option>
                            <option value="outward">{t('prop.outward') || "Outward"}</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('prop.openingAngle') || "Angle"}</span>
                        <input
                          style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                          type="number"
                          value={op.openingAngle ?? 90}
                          onChange={(e) => updateWallOpening(op.id, { openingAngle: parseFloat(e.target.value) || 0 })}
                          {...wallOpeningHandlers(op.id, 'openingAngle', op.openingAngle ?? 90, 5, 45)}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          );
        })()}
        
        <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '8px 0' }}></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="toolbar-btn" 
            style={{ flex: 1 }} 
            onClick={() => selectedObj && duplicateObjects([selectedObj.id])}
          >
            {t('prop.duplicate')}
          </button>
          <button 
            className="toolbar-btn" 
            style={{ flex: 1, color: '#ffffff', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }} 
            onClick={handleDelete}
          >
            {t('prop.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};
export default PropertiesPanel;
