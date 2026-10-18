import React from 'react';
import { useProjectStore } from '../store/projectStore';
import type { Layer } from '../types/project';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';

export const LayersPanel: React.FC = () => {
  const { t } = useI18n();
  const layers = useProjectStore((state) => state.project.layers);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const moveLayer = useProjectStore((state) => state.moveLayer);
  const activeLayerId = useProjectStore((state) => state.activeLayerId);
  const setActiveLayerId = useProjectStore((state) => state.setActiveLayerId);

  const toggleVisibility = (layerId: string, visible: boolean) => {
    updateLayer(layerId, { visible });
  };

  const toggleLock = (layerId: string, locked: boolean) => {
    updateLayer(layerId, { locked });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('layers.title')}</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Auto Option */}
        <div 
          className={`layer-item ${activeLayerId === 'auto' ? 'active' : ''}`}
          onClick={() => setActiveLayerId('auto')}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ fontWeight: activeLayerId === 'auto' ? 600 : 400 }}>
            ✨ {t('layers.auto')}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {activeLayerId === 'auto' ? t('layers.active') : ''}
          </span>
        </div>

        {layers.map((layer: Layer, idx: number) => {
          const isActive = layer.id === activeLayerId;
          return (
            <div 
              key={layer.id} 
              className={`layer-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveLayerId(layer.id)}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={(e) => e.stopPropagation()} // Prevent selecting layer when clicking checkbox
              >
                <input 
                  type="checkbox" 
                  checked={layer.visible} 
                  onChange={(e) => toggleVisibility(layer.id, e.target.checked)}
                  style={{ cursor: 'pointer' }} 
                />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>
                  {layer.name}
                </span>
              </div>

              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={(e) => e.stopPropagation()} // Prevent selecting layer when clicking action buttons
              >
                {/* Reorder Buttons */}
                <button
                  disabled={idx === 0}
                  onClick={() => moveLayer(layer.id, 'up')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    opacity: idx === 0 ? 0.3 : 0.7,
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Move layer up (draw earlier)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  disabled={idx === layers.length - 1}
                  onClick={() => moveLayer(layer.id, 'down')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: idx === layers.length - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    opacity: idx === layers.length - 1 ? 0.3 : 0.7,
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Move layer down (draw later)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Lock Toggle */}
                <button 
                  onClick={() => toggleLock(layer.id, !layer.locked)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontSize: '12px',
                    color: layer.locked ? 'var(--text-primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={layer.locked ? "Unlock layer" : "Lock layer"}
                >
                  {layer.locked ? <Icons.LockIcon size={12} /> : <Icons.UnlockIcon size={12} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default LayersPanel;
