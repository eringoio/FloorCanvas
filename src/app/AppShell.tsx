import React from 'react';
import { TopToolbar } from '../panels/TopToolbar';
import { PartsLibrary } from '../panels/PartsLibrary';
import { CanvasViewport } from '../editor/CanvasViewport';
import { LayersPanel } from '../panels/LayersPanel';
import { PropertiesPanel } from '../panels/PropertiesPanel';
import { BackgroundPanel } from '../panels/BackgroundPanel';
import { SheetSettingsPanel } from '../panels/SheetSettingsPanel';
import { useProjectStore } from '../store/projectStore';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';

export const AppShell: React.FC = () => {
  const { t } = useI18n();
  const grid = useProjectStore((state) => state.project.grid);
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const objects = useProjectStore((state) => state.project.objects);
  const cursorCoords = useProjectStore((state) => state.cursorCoords);
  const activeTool = useProjectStore((state) => state.activeTool);
  const copySelectedObjects = useProjectStore((state) => state.copySelectedObjects);
  const pasteClipboard = useProjectStore((state) => state.pasteClipboard);
  const duplicateObjects = useProjectStore((state) => state.duplicateObjects);
  const deleteObjects = useProjectStore((state) => state.deleteObjects);

  const selectedObj = objects.find((o) => o.id === selectedIds[0]);
  const selectionText = selectedIds.length === 0
    ? t('common.none')
    : selectedIds.length === 1
      ? (selectedObj ? `${selectedObj.type.toUpperCase()} (${selectedObj.id})` : t('common.none'))
      : `${selectedIds.length} ${t('prop.objectsSelected')}`;

  const [leftPanelOpen, setLeftPanelOpen] = React.useState(true);
  const [rightPanelOpen, setRightPanelOpen] = React.useState(true);
  const [activeMobilePanel, setActiveMobilePanel] = React.useState<
    'parts' | 'sheet' | 'layers' | 'background' | 'properties' | null
  >(null);

  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const currentProjectHandle = useProjectStore((state) => state.currentProjectHandle);

  React.useEffect(() => {
    if (!window.floorcanvasDesktop?.resolveAssetUrl) return;
    
    const unresolved = objects.filter(
      (obj) => obj.type === 'background' && (obj as any).assetPath
    );
    
    if (unresolved.length === 0) return;
    
    unresolved.forEach(async (obj) => {
      try {
        const resolvedUrl = await window.floorcanvasDesktop!.resolveAssetUrl(currentProjectHandle, (obj as any).assetPath);
        if (resolvedUrl && (obj as any).imageUrl !== resolvedUrl) {
          useProjectStore.getState().updateObjectRuntime(obj.id, { imageUrl: resolvedUrl } as any);
        }
      } catch (err) {
        console.error('Failed to resolve asset URL:', err);
      }
    });
  }, [objects, currentProjectHandle]);

  const isMobileOrTablet = windowWidth < 1024;

  return (
    <div className={`app-shell ${leftPanelOpen ? 'left-panel-open' : 'left-panel-closed'} ${rightPanelOpen ? 'right-panel-open' : 'right-panel-closed'}`}>
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Main Workspace */}
      <div className="workspace">
        {/* Left Sidebar */}
        <PartsLibrary />

        {/* Center Viewport Container with Panel Toggles */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}>
          <CanvasViewport />
          
          {/* Collapse/Expand Buttons for Desktop/Tablet */}
          {!isMobileOrTablet && (
            <>
              <button
                className="panel-toggle-btn left-toggle-btn"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                title={leftPanelOpen ? "Collapse Left Panel" : "Expand Left Panel"}
              >
                {leftPanelOpen ? '◀' : '▶'}
              </button>
              <button
                className="panel-toggle-btn right-toggle-btn"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                title={rightPanelOpen ? "Collapse Right Panel" : "Expand Right Panel"}
              >
                {rightPanelOpen ? '▶' : '◀'}
              </button>
            </>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="sidebar-right" style={{ overflowY: 'auto' }}>
          <div className="panel-body" style={{ gap: '16px', padding: '16px' }}>
            <SheetSettingsPanel />
            <LayersPanel />
            <BackgroundPanel />
            <PropertiesPanel />
          </div>
        </aside>
      </div>

      {/* Mobile Action Bar */}
      {isMobileOrTablet && (
        <div className="mobile-action-bar">
          <button className={`mobile-action-btn ${activeMobilePanel === 'parts' ? 'active' : ''}`} onClick={() => setActiveMobilePanel('parts')}>
            <Icons.RoomGridIcon size={16} />
            <span>{t('mobile.parts')}</span>
          </button>
          <button className={`mobile-action-btn ${activeMobilePanel === 'sheet' ? 'active' : ''}`} onClick={() => setActiveMobilePanel('sheet')}>
            <Icons.SheetIcon size={16} />
            <span>{t('mobile.sheet')}</span>
          </button>
          <button className={`mobile-action-btn ${activeMobilePanel === 'layers' ? 'active' : ''}`} onClick={() => setActiveMobilePanel('layers')}>
            <Icons.LayersIcon size={16} />
            <span>{t('mobile.layers')}</span>
          </button>
          <button className={`mobile-action-btn ${activeMobilePanel === 'background' ? 'active' : ''}`} onClick={() => setActiveMobilePanel('background')}>
            <Icons.ImageIcon size={16} />
            <span>{t('mobile.bg')}</span>
          </button>
          <button className={`mobile-action-btn ${activeMobilePanel === 'properties' ? 'active' : ''}`} onClick={() => setActiveMobilePanel('properties')}>
            <Icons.SettingsIcon size={16} />
            <span>{t('mobile.properties')}</span>
          </button>
        </div>
      )}

      {/* Mobile Edit Bar — appears when objects are selected */}
      {isMobileOrTablet && selectedIds.length > 0 && (
        <div className="mobile-edit-bar">
          <button onClick={copySelectedObjects} title={t('toolbar.copy')}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}><Icons.CopyIcon size={14} /></span>
            {t('toolbar.copy')}
          </button>
          <button onClick={pasteClipboard} title={t('toolbar.paste')}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}><Icons.PasteIcon size={14} /></span>
            {t('toolbar.paste')}
          </button>
          <button onClick={() => duplicateObjects(selectedIds)} title={t('toolbar.duplicate')}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}><Icons.DuplicateIcon size={14} /></span>
            {t('toolbar.duplicate')}
          </button>
          <button onClick={() => deleteObjects(selectedIds)} title={t('mobile.delete')}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}><Icons.TrashIcon size={14} /></span>
            {t('mobile.delete')}
          </button>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobileOrTablet && activeMobilePanel && (
        <div className="mobile-drawer-overlay" onClick={() => setActiveMobilePanel(null)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3>
                {activeMobilePanel === 'parts' && t('parts.title')}
                {activeMobilePanel === 'sheet' && t('sheet.title')}
                {activeMobilePanel === 'layers' && t('layers.title')}
                {activeMobilePanel === 'background' && t('bg.title')}
                {activeMobilePanel === 'properties' && t('prop.title')}
              </h3>
              <button className="mobile-drawer-close" onClick={() => setActiveMobilePanel(null)}>&times;</button>
            </div>
            <div className="mobile-drawer-body">
              {activeMobilePanel === 'parts' && <PartsLibrary />}
              {activeMobilePanel === 'sheet' && <SheetSettingsPanel />}
              {activeMobilePanel === 'layers' && <LayersPanel />}
              {activeMobilePanel === 'background' && <BackgroundPanel />}
              {activeMobilePanel === 'properties' && <PropertiesPanel />}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="statusbar">
        <div className="statusbar-group">
          <span>{t('status.mode')}: <strong style={{ color: 'var(--text-primary)' }}>{activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</strong></span>
          <span>•</span>
          <span>
            {t('status.snap')}:{' '}
            <strong style={{ color: grid.snap ? 'var(--accent)' : 'var(--danger)' }}>
              {grid.snap ? `ON (${grid.size}mm)` : 'OFF'}
            </strong>
          </span>
        </div>
        {!isMobileOrTablet && (
          <div className="statusbar-group statusbar-shortcuts" style={{ opacity: 0.85, fontSize: '11px', color: 'var(--text-secondary)', margin: '0 auto', display: 'flex', gap: '8px' }}>
            <span>{t('status.shortcuts')}</span>
          </div>
        )}
        <div className="statusbar-group">
          {!isMobileOrTablet && (
            <>
              <span>
                {t('status.selection')}: <span style={{ fontWeight: selectedObj ? 600 : 'normal' }}>{selectionText}</span>
              </span>
              <span>•</span>
            </>
          )}
          <span>
            {t('status.cursor')}: <span>{cursorCoords.inside ? `X: ${cursorCoords.x}mm, Y: ${cursorCoords.y}mm` : t('status.outsideSheet')}</span>
          </span>
        </div>
      </footer>
    </div>
  );
};
export default AppShell;
