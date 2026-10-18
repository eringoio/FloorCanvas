import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { getObjectBounds } from '../utils/bounds';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';
import {
  getProjectContentBounds,
  getSheetRealBounds,
  calculateSheetSizeForContent,
  calculateCenterInSheetDelta
} from '../utils/contentBounds';
import { getPaperSizeMm } from '../utils/paper';

export const SheetSettingsPanel: React.FC = () => {
  const { t } = useI18n();
  const canvas = useProjectStore((state) => state.project.canvas);
  const stylePreset = useProjectStore((state) => state.project.stylePreset || 'modern-editor');
  const setStylePreset = useProjectStore((state) => state.setStylePreset);
  const objects = useProjectStore((state) => state.project.objects);
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const setCanvas = useProjectStore((state) => state.setCanvas);
  const setObjects = useProjectStore((state) => state.setObjects);
  const triggerCenterView = useProjectStore((state) => state.triggerCenterView);
  const pushToHistory = useProjectStore((state) => state.pushToHistory);

  const [marginMm, setMarginMm] = React.useState(10);
  const [scaleToFit, setScaleToFit] = React.useState(false);

  const handlePaperSizeChange = (size: 'A4' | 'A3' | 'custom') => {
    let width = canvas.width;
    let height = canvas.height;
    if (size === 'A4' || size === 'A3') {
      const sizeMm = getPaperSizeMm(size, canvas.orientation);
      width = sizeMm.width;
      height = sizeMm.height;
    }
    setCanvas({ paperSize: size, width, height });
    setTimeout(() => triggerCenterView(), 50);
  };

  const handleOrientationChange = (orientation: 'landscape' | 'portrait') => {
    let width = canvas.width;
    let height = canvas.height;
    if (canvas.paperSize === 'custom') {
      // Just swap dimensions for custom orientation toggle
      width = canvas.height;
      height = canvas.width;
    } else if (canvas.paperSize === 'A4' || canvas.paperSize === 'A3') {
      const sizeMm = getPaperSizeMm(canvas.paperSize, orientation);
      width = sizeMm.width;
      height = sizeMm.height;
    }
    setCanvas({ orientation, width, height });
    setTimeout(() => triggerCenterView(), 50);
  };

  const getMovableContentBounds = () => {
    const project = useProjectStore.getState().project;
    const layerLockedMap: Record<string, boolean> = {};
    const layerVisMap: Record<string, boolean> = {};
    project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
      layerVisMap[l.id] = l.visible;
    });

    const movableObjects = project.objects.filter((obj) => {
      if (obj.visible === false) return false;
      if (obj.layerId && layerVisMap[obj.layerId] === false) return false;
      if (obj.locked) return false;
      if (obj.layerId && layerLockedMap[obj.layerId]) return false;
      return true;
    });

    if (movableObjects.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    movableObjects.forEach((obj) => {
      const bounds = getObjectBounds(obj);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });

    return minX === Infinity ? null : { minX, minY, maxX, maxY };
  };

  const moveAllContentIntoSheet = () => {
    const project = useProjectStore.getState().project;
    const layerLockedMap: Record<string, boolean> = {};
    const layerVisMap: Record<string, boolean> = {};
    project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
      layerVisMap[l.id] = l.visible;
    });

    const bounds = getMovableContentBounds();
    if (!bounds) {
      alert(t('sheet.noContent') || 'No visible content to fit.');
      return;
    }

    const movableObjects = project.objects.filter((obj) => {
      if (obj.visible === false) return false;
      if (obj.layerId && layerVisMap[obj.layerId] === false) return false;
      if (obj.locked) return false;
      if (obj.layerId && layerLockedMap[obj.layerId]) return false;
      return true;
    });

    const hasLockedObjects = project.objects.some((obj) => {
      const isVisible = obj.visible !== false && (!obj.layerId || layerVisMap[obj.layerId] !== false);
      const isLocked = obj.locked || (obj.layerId && layerLockedMap[obj.layerId]);
      return isVisible && isLocked;
    });

    if (hasLockedObjects) {
      if (!window.confirm(t('sheet.confirmLockedWarn') || "Notice: Some visible objects are locked or on locked layers and will NOT move. Do you want to center only the unlocked objects?")) {
        return;
      }
    } else if (movableObjects.length > 10) {
      if (!window.confirm(t('sheet.confirmMoveCenter') || `Are you sure you want to move all ${movableObjects.length} unlocked objects to center them in the sheet?`)) {
        return;
      }
    }

    const sheetBounds = getSheetRealBounds(project);
    const { dx, dy } = calculateCenterInSheetDelta(bounds, sheetBounds, marginMm);
    
    if (dx === 0 && dy === 0) return;

    const movableIds = movableObjects.map(o => o.id);
    useProjectStore.getState().nudgeObjects(movableIds, dx, dy);
    setTimeout(() => triggerCenterView(), 50);
  };

  const resizeSheetToContent = () => {
    const project = useProjectStore.getState().project;
    const bounds = getProjectContentBounds(project);
    if (!bounds) {
      alert(t('sheet.noContent') || 'No visible content to fit sheet size to.');
      return;
    }

    const newSize = calculateSheetSizeForContent(bounds, project.scale, marginMm);

    pushToHistory();
    setCanvas({
      paperSize: 'custom',
      width: newSize.width,
      height: newSize.height,
    });
    setTimeout(() => triggerCenterView(), 50);
  };

  const fitSelectionIntoSheet = () => {
    if (selectedIds.length === 0) {
      alert(t('sheet.noSelection') || 'Please select one or more objects first.');
      return;
    }

    const project = useProjectStore.getState().project;
    const layerLockedMap: Record<string, boolean> = {};
    project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const movableSelectedIds = selectedIds.filter(id => {
      const obj = objects.find(o => o.id === id);
      if (!obj) return false;
      return !obj.locked && (!obj.layerId || !layerLockedMap[obj.layerId]);
    });

    if (movableSelectedIds.length === 0) {
      alert(t('sheet.noMovableSelected') || "No movable objects in the selection.");
      return;
    }

    if (movableSelectedIds.length < selectedIds.length) {
      alert(t('sheet.lockedSelectedExcluded') || "Notice: Some selected objects are locked or on locked layers and will be excluded from the fitting.");
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    movableSelectedIds.forEach((id) => {
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        const bounds = getObjectBounds(obj);
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    });

    if (minX === Infinity) return;
    const selBounds = { minX, minY, maxX, maxY };

    if (movableSelectedIds.length > 5) {
      if (!window.confirm(t('sheet.confirmFitSelection').replace('{count}', String(movableSelectedIds.length)) || `Are you sure you want to fit the selected ${movableSelectedIds.length} objects into the sheet?`)) {
        return;
      }
    }

    const sheetBounds = getSheetRealBounds(project);

    if (scaleToFit) {
      const selW = maxX - minX;
      const selH = maxY - minY;
      const selCx = (minX + maxX) / 2;
      const selCy = (minY + maxY) / 2;

      const sheetW = sheetBounds.maxX;
      const sheetH = sheetBounds.maxY;
      const sheetCx = sheetW / 2;
      const sheetCy = sheetH / 2;

      const maxAllowedW = Math.max(100, sheetW - 2 * marginMm);
      const maxAllowedH = Math.max(100, sheetH - 2 * marginMm);
      
      let s = 1.0;
      if (selW > maxAllowedW || selH > maxAllowedH) {
        s = Math.min(maxAllowedW / Math.max(1, selW), maxAllowedH / Math.max(1, selH));
      }

      pushToHistory();

      const updatedObjects = objects.map((obj) => {
        if (!movableSelectedIds.includes(obj.id)) return obj;
        if (obj.locked || (obj.layerId && layerLockedMap[obj.layerId])) return obj;

        const newObj = { ...obj } as any;

        if (newObj.type === 'wall' || newObj.type === 'dimension') {
          newObj.x1 = Math.round(sheetCx + (newObj.x1 - selCx) * s);
          newObj.y1 = Math.round(sheetCy + (newObj.y1 - selCy) * s);
          newObj.x2 = Math.round(sheetCx + (newObj.x2 - selCx) * s);
          newObj.y2 = Math.round(sheetCy + (newObj.y2 - selCy) * s);
          if (newObj.type === 'dimension' && typeof newObj.autoValue === 'number') {
            newObj.autoValue = Math.round(newObj.autoValue * s);
          }
        } else {
          newObj.x = Math.round(sheetCx + (newObj.x - selCx) * s);
          newObj.y = Math.round(sheetCy + (newObj.y - selCy) * s);
          
          if (newObj.width !== undefined) {
            newObj.width = Math.round(newObj.width * s);
          }
          if (newObj.height !== undefined) {
            newObj.height = Math.round(newObj.height * s);
          }
          if (newObj.type === 'room') {
            const areaSqM = (newObj.width * newObj.height) / 1000000;
            newObj.areaLabel = `${areaSqM.toFixed(1)}㎡`;
          }
        }
        return newObj;
      });

      setObjects(updatedObjects);
    } else {
      const { dx, dy } = calculateCenterInSheetDelta(selBounds, sheetBounds, marginMm);
      if (dx !== 0 || dy !== 0) {
        useProjectStore.getState().nudgeObjects(movableSelectedIds, dx, dy);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', gap: '8px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('sheet.title')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="prop-row">
          <span className="prop-label">{t('sheet.paperSize')}</span>
          <select
            className="prop-input"
            value={canvas.paperSize}
            onChange={(e) => handlePaperSizeChange(e.target.value as any)}
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="custom">Custom Size</option>
          </select>
        </div>

        <div className="prop-row">
          <span className="prop-label">{t('sheet.orientation')}</span>
          <select
            className="prop-input"
            value={canvas.orientation}
            onChange={(e) => handleOrientationChange(e.target.value as any)}
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </div>

        <div className="prop-row">
          <span className="prop-label">{t('sheet.stylePreset')}</span>
          <select
            className="prop-input"
            value={stylePreset}
            onChange={(e) => setStylePreset(e.target.value as any)}
          >
            <option value="modern-editor">Modern Editor</option>
            <option value="architectural-reference">Architectural Reference</option>
          </select>
        </div>

        <div className="prop-row">
          <span className="prop-label">{t('sheet.width')}</span>
          <input
            className="prop-input"
            type="number"
            value={canvas.width}
            disabled={canvas.paperSize !== 'custom'}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) setCanvas({ width: val });
            }}
            style={canvas.paperSize !== 'custom' ? { backgroundColor: '#f1f5f9', color: 'var(--text-secondary)' } : {}}
          />
        </div>

        <div className="prop-row">
          <span className="prop-label">{t('sheet.height')}</span>
          <input
            className="prop-input"
            type="number"
            value={canvas.height}
            disabled={canvas.paperSize !== 'custom'}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) setCanvas({ height: val });
            }}
            style={canvas.paperSize !== 'custom' ? { backgroundColor: '#f1f5f9', color: 'var(--text-secondary)' } : {}}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('sheet.toolsTitle')}</span>
          
          <div className="prop-row">
            <span className="prop-label">{t('sheet.margin')}</span>
            <input
              className="prop-input"
              type="number"
              value={marginMm}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) setMarginMm(val);
              }}
            />
          </div>

          <div className="prop-row">
            <span className="prop-label">{t('sheet.scaleFit')}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                style={{ cursor: 'pointer' }}
                checked={scaleToFit}
                onChange={(e) => setScaleToFit(e.target.checked)}
              />
              <span>{t('sheet.scaleToFit')}</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <button
              className="toolbar-btn"
              style={{ justifyContent: 'flex-start', height: '30px', fontSize: '12px', gap: '6px' }}
              onClick={() => triggerCenterView()}
              title="Fit the viewport to show the sheet boundary"
            >
              <Icons.FitViewIcon size={14} />
              {t('sheet.fitView')}
            </button>
            <button
              className="toolbar-btn"
              style={{ justifyContent: 'flex-start', height: '30px', fontSize: '12px', gap: '6px' }}
              onClick={moveAllContentIntoSheet}
              title="Move all unlocked drawing content to the center of the current sheet"
            >
              <Icons.CenterContentIcon size={14} />
              {t('sheet.centerContent')}
            </button>
            <button
              className="toolbar-btn"
              style={{ justifyContent: 'flex-start', height: '30px', fontSize: '12px', gap: '6px' }}
              onClick={resizeSheetToContent}
              title="Change the sheet to a custom size to fit all drawing objects plus margins"
            >
              <Icons.ResizeToContentIcon size={14} />
              {t('sheet.resizeToContent')}
            </button>
            <button
              className="toolbar-btn"
              style={{ justifyContent: 'flex-start', height: '30px', fontSize: '12px', gap: '6px' }}
              onClick={fitSelectionIntoSheet}
              title="Move and scale selection so it fits cleanly in the current sheet"
            >
              <Icons.FitSelectionIcon size={14} />
              {t('sheet.fitSelection')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SheetSettingsPanel;
