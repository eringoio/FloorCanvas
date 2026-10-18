import React from 'react';
import { useProjectStore } from '../store/projectStore';
import type { BackgroundObject } from '../types/project';
import { useI18n } from '../i18n';
import { getDrawingScaleFactor } from '../utils/scale';
import * as projectFileService from '../services/projectFileService';

export const BackgroundPanel: React.FC = () => {
  const { t } = useI18n();
  const objects = useProjectStore((state) => state.project.objects);
  const canvas = useProjectStore((state) => state.project.canvas);
  const scale = useProjectStore((state) => state.project.scale);
  const addObject = useProjectStore((state) => state.addObject);
  const updateObject = useProjectStore((state) => state.updateObject);
  const deleteObject = useProjectStore((state) => state.deleteObject);
  const currentProjectHandle = useProjectStore((state) => state.currentProjectHandle);

  const bgObj = objects.find((o) => o.type === 'background') as BackgroundObject | undefined;

  const addBackgroundFromUrl = (imageUrl: string, assetPath?: string) => {
    const scaleFactor = getDrawingScaleFactor(scale);
    const cx = Math.round((canvas.width * scaleFactor) / 2);
    const cy = Math.round((canvas.height * scaleFactor) / 2);

    const img = new Image();
    img.onload = () => {
      const targetWidth = Math.round(canvas.width * scaleFactor * 0.8) || 15000;
      const aspectRatio = img.height / img.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      const newBg: BackgroundObject = {
        id: `background_${Date.now()}`,
        type: 'background',
        layerId: 'layer_background',
        visible: true,
        locked: true,
        x: cx,
        y: cy,
        width: targetWidth,
        height: targetHeight,
        rotation: 0,
        ...(assetPath ? { assetPath } : {}),
        imageUrl,
        opacity: 0.4,
        lockAspectRatio: true,
        allowStretch: false,
      };

      addObject(newBg);
    };
    img.src = imageUrl;
  };

  const handleImportClick = async () => {
    try {
      const importResult = await projectFileService.importBackgroundImage(currentProjectHandle);
      if (!importResult) return;
      addBackgroundFromUrl(importResult.imageUrl, importResult.assetPath);
    } catch (err: any) {
      alert('Failed to import background image: ' + (err?.message || err));
    }
  };

  const handleNumChange = (field: keyof BackgroundObject, val: string) => {
    if (!bgObj) return;
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateObject(bgObj.id, { [field]: num });
    }
  };

  const handleBoolChange = (field: keyof BackgroundObject, val: boolean) => {
    if (!bgObj) return;
    updateObject(bgObj.id, { [field]: val });
  };

  const fitImageToSheet = () => {
    if (!bgObj) return;
    const scaleFactor = getDrawingScaleFactor(scale);
    const sheetW = canvas.width * scaleFactor;
    const sheetH = canvas.height * scaleFactor;

    const imgAspect = bgObj.width / bgObj.height;
    const sheetAspect = sheetW / sheetH;

    let newW = sheetW;
    let newH = sheetH;

    if (imgAspect > sheetAspect) {
      newW = sheetW;
      newH = sheetW / imgAspect;
    } else {
      newH = sheetH;
      newW = sheetH * imgAspect;
    }

    useProjectStore.getState().pushToHistory();
    updateObject(bgObj.id, {
      width: Math.round(newW),
      height: Math.round(newH),
      x: Math.round(sheetW / 2),
      y: Math.round(sheetH / 2),
      rotation: 0
    });
  };

  const stretchImageToSheet = () => {
    if (!bgObj) return;
    const lockAspectVal = bgObj.lockAspectRatio ?? true;
    if (lockAspectVal) {
      if (!window.confirm(t('bg.confirmStretch') || "Stretching the image will distort it. This requires turning off the ratio lock. Do you want to proceed?")) {
        return;
      }
    }

    const scaleFactor = getDrawingScaleFactor(scale);
    const sheetW = canvas.width * scaleFactor;
    const sheetH = canvas.height * scaleFactor;

    useProjectStore.getState().pushToHistory();
    updateObject(bgObj.id, {
      lockAspectRatio: false,
      allowStretch: true,
      width: Math.round(sheetW),
      height: Math.round(sheetH),
      x: Math.round(sheetW / 2),
      y: Math.round(sheetH / 2),
      rotation: 0
    });
  };

  const handleDelete = () => {
    if (!bgObj) return;
    deleteObject(bgObj.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('bg.title')}</span>
      </div>

      {!bgObj ? (
        <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {t('bg.helpText')}
          </span>
          <button className="toolbar-btn" style={{ width: '100%', backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }} onClick={handleImportClick}>
            {t('bg.import')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
          {/* Thumbnail preview */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '50px', height: '50px', border: '1px solid var(--border-light)', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={bgObj.imageUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{t('bg.active')}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={bgObj.locked}
                  onChange={(e) => handleBoolChange('locked', e.target.checked)}
                />
                {t('bg.locked')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  checked={bgObj.lockAspectRatio ?? true}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    useProjectStore.getState().pushToHistory();
                    updateObject(bgObj.id, {
                      lockAspectRatio: checked,
                      allowStretch: !checked
                    });
                  }}
                />
                {t('prop.keepImageRatio')}
              </label>
            </div>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>

          {/* Opacity slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>{t('bg.opacity')}</span>
              <span>{Math.round(bgObj.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={bgObj.opacity}
              onChange={(e) => handleNumChange('opacity', e.target.value)}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Geometry controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <div className="prop-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('bg.width')}</span>
              <input
                className="prop-input"
                type="number"
                value={bgObj.width}
                onChange={(e) => handleNumChange('width', e.target.value)}
              />
            </div>
            <div className="prop-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('bg.height')}</span>
              <input
                className="prop-input"
                type="number"
                value={bgObj.height}
                onChange={(e) => handleNumChange('height', e.target.value)}
              />
            </div>
            <div className="prop-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('bg.posX')}</span>
              <input
                className="prop-input"
                type="number"
                value={bgObj.x}
                onChange={(e) => handleNumChange('x', e.target.value)}
              />
            </div>
            <div className="prop-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('bg.posY')}</span>
              <input
                className="prop-input"
                type="number"
                value={bgObj.y}
                onChange={(e) => handleNumChange('y', e.target.value)}
              />
            </div>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '6px 0' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {t('bg.fittingControls')}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="toolbar-btn"
                style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                onClick={fitImageToSheet}
                title="Scale and center the background image to fit entirely within the sheet boundaries while preserving aspect ratio"
              >
                {t('bg.fit')}
              </button>
              <button
                className="toolbar-btn"
                style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                onClick={stretchImageToSheet}
                title="Stretch the background image to exactly match the sheet size, which may distort the image"
              >
                {t('bg.stretch')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              className="toolbar-btn"
              style={{ flex: 1, color: '#ffffff', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '11px', padding: '4px 8px' }}
              onClick={handleDelete}
            >
              {t('bg.remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default BackgroundPanel;
