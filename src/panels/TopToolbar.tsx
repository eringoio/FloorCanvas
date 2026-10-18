import React from 'react';
import { useProjectStore } from '../store/projectStore';
import * as Icons from '../ui/icons/Icons';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { useI18n } from '../i18n';
import { ExportModal } from '../components/ExportModal';
import { HelpModal } from '../components/HelpModal';
import { ImportMergeModal } from '../components/ImportMergeModal';
import { BUILTIN_SAMPLES, findBuiltinSample, loadBuiltinSampleProject, builtinSampleHandle } from '../data/sampleCatalog';
import * as projectFileService from '../services/projectFileService';
import type { SaveOutcome } from '../services/projectFileService';
import { ensureValidProject } from '../utils/projectValidation';

export const TopToolbar: React.FC = () => {
  const { t } = useI18n();
  const project = useProjectStore((state) => state.project);
  const zoom = useProjectStore((state) => state.zoom);
  const setZoom = useProjectStore((state) => state.setZoom);
  const createNewProject = useProjectStore((state) => state.createNewProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const setGrid = useProjectStore((state) => state.setGrid);
  const triggerCenterView = useProjectStore((state) => state.triggerCenterView);
  const isCalibrating = useProjectStore((state) => state.isCalibrating);
  const startCalibration = useProjectStore((state) => state.startCalibration);
  const activeTool = useProjectStore((state) => state.activeTool);
  const setActiveTool = useProjectStore((state) => state.setActiveTool);
  
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const past = useProjectStore((state) => state.past);
  const future = useProjectStore((state) => state.future);
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const clipboard = useProjectStore((state) => state.clipboard);
  const copySelectedObjects = useProjectStore((state) => state.copySelectedObjects);
  const cutSelectedObjects = useProjectStore((state) => state.cutSelectedObjects);
  const pasteClipboard = useProjectStore((state) => state.pasteClipboard);
  const duplicateObjects = useProjectStore((state) => state.duplicateObjects);

  const currentProjectHandle = useProjectStore((state) => state.currentProjectHandle);
  const isDirty = useProjectStore((state) => state.isDirty);
  const setProjectHandle = useProjectStore((state) => state.setProjectHandle);
  const setDirty = useProjectStore((state) => state.setDirty);

  const importFileInputRef = React.useRef<HTMLInputElement>(null);

  const importProjectMerge = useProjectStore((state) => state.importProjectMerge);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [importData, setImportData] = React.useState<any>(null);

  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

  const [projectsList, setProjectsList] = React.useState<any[]>([]);

  const refreshProjectsList = React.useCallback(async () => {
    if (window.floorcanvasDesktop?.listProjects) {
      const list = await window.floorcanvasDesktop.listProjects();
      setProjectsList(list);
    }
  }, []);

  React.useEffect(() => {
    refreshProjectsList();
  }, [refreshProjectsList, currentProjectHandle]);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 1024;



  const handleNew = () => {
    if (isDirty) {
      if (!window.confirm(t('toolbar.confirmNew') || 'Create a new project? Unsaved changes will be lost.')) {
        return;
      }
    } else {
      if (!window.confirm('Create a new project?')) {
        return;
      }
    }
    createNewProject();
  };

  const handleSaveAs = React.useCallback(async (): Promise<SaveOutcome> => {
    const outcome = await projectFileService.saveProjectAs(project, currentProjectHandle);
    if (outcome.status === 'saved') {
      // Only a successful persistence clears dirty state; a cancelled or
      // failed save leaves everything unchanged.
      if (outcome.handle) {
        setProjectHandle(outcome.handle);
      }
      setDirty(false);
      refreshProjectsList();
    } else if (outcome.status === 'failed') {
      alert(t('toolbar.saveFailed').replace('{error}', String(outcome.error)) || 'Failed to save project: ' + outcome.error);
    }
    return outcome;
  }, [project, currentProjectHandle, refreshProjectsList, setDirty, setProjectHandle, t]);

  const handleSave = React.useCallback(async (): Promise<SaveOutcome> => {
    const outcome = await projectFileService.saveProject(project, currentProjectHandle);
    if (outcome.status === 'saved') {
      // Store the handle returned by the save (first Save creates the
      // workspace project; later Saves overwrite the same project).
      if (outcome.handle) {
        setProjectHandle(outcome.handle);
      }
      setDirty(false);
      refreshProjectsList();
    } else if (outcome.status === 'failed') {
      alert(t('toolbar.saveFailed').replace('{error}', String(outcome.error)) || 'Failed to save project: ' + outcome.error);
    }
    return outcome;
  }, [project, currentProjectHandle, refreshProjectsList, setDirty, setProjectHandle, t]);

  React.useEffect(() => {
    const handleAppSaveEvent = () => {
      handleSave();
    };
    window.addEventListener('app-save', handleAppSaveEvent);
    return () => {
      window.removeEventListener('app-save', handleAppSaveEvent);
    };
  }, [handleSave]);

  // Desktop close protection: intercept the main-process close request and
  // resolve unsaved changes with Save / Don't Save / Cancel.
  const [isClosePromptOpen, setIsClosePromptOpen] = React.useState(false);
  React.useEffect(() => {
    const desktop = window.floorcanvasDesktop;
    if (!desktop?.onCloseRequested || !desktop?.acceptClose) return;
    desktop.onCloseRequested(() => {
      if (useProjectStore.getState().isDirty) {
        setIsClosePromptOpen(true);
      } else {
        void desktop.acceptClose!();
      }
    });
  }, []);

  React.useEffect(() => {
    const handleOpenExport = () => setIsExportModalOpen(true);
    const handleOpenHelp = () => setIsHelpModalOpen(true);
    window.addEventListener('app-open-export', handleOpenExport);
    window.addEventListener('app-open-help', handleOpenHelp);
    return () => {
      window.removeEventListener('app-open-export', handleOpenExport);
      window.removeEventListener('app-open-help', handleOpenHelp);
    };
  }, []);

  const handleOpenClick = async () => {
    if (isDirty && !window.confirm('Unsaved changes will be lost. Continue?')) {
      return;
    }

    try {
      const result = await projectFileService.openProjectFile();
      if (result) {
        loadProject(result.data);
        setProjectHandle(result.handle);
      }
    } catch (err: any) {
      alert('Failed to open project: ' + err.message);
    }
  };

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = ensureValidProject(JSON.parse(text));

        setImportData(parsed);
        setIsImportModalOpen(true);
      } catch (err: any) {
        alert(t('toolbar.loadFailed').replace('{error}', err.message || err) || `Failed to load floor map for import: ${err.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportMerge = (options: any) => {
    if (importData) {
      importProjectMerge(importData, options);
      setIsImportModalOpen(false);
      setImportData(null);
    }
  };

  const handleExportClick = () => {
    setIsExportModalOpen(true);
  };



  const toggleGrid = () => {
    setGrid({ visible: !project.grid.visible });
  };

  const toggleSnap = () => {
    setGrid({ snap: !project.grid.snap });
  };

  const zoomIn = () => {
    setZoom(Math.min(8.0, zoom * 1.15));
  };

  const zoomOut = () => {
    setZoom(Math.max(0.05, zoom / 1.15));
  };

  // Dev/testing helper: auto-load a built-in sample or workspace project via
  // `?sample=<id>` query param so headless screenshot/export tooling can
  // target a specific plan. Runs at most once per page load: the effect
  // depends on the workspace projects list (needed to resolve workspace
  // project ids), and without a guard each list refresh would re-trigger it
  // and reload the sample in a loop.
  const autoLoadedSampleRef = React.useRef(false);
  React.useEffect(() => {
    if (autoLoadedSampleRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const sampleId = params.get('sample');
    if (!sampleId) return;
    if (findBuiltinSample(sampleId)) {
      autoLoadedSampleRef.current = true;
      const loadBuiltIn = async () => {
        try {
          loadProject(loadBuiltinSampleProject(sampleId));
          const handle = builtinSampleHandle(sampleId);
          if (handle) setProjectHandle(handle);
          setTimeout(() => triggerCenterView(), 50);
        } catch (err) {
          console.error('Failed to auto-load built-in sample:', err);
        }
      };
      void loadBuiltIn();
      return;
    }
    if (projectsList.length === 0) return;
    const projectItem = projectsList.find((p) => p.id === sampleId);
    if (projectItem) {
      autoLoadedSampleRef.current = true;
      const loadProjectFromList = async () => {
        try {
          const result = await projectFileService.openWorkspaceProject(projectItem.id);
          if (result) {
            loadProject(result.data);
            setProjectHandle(result.handle);
            setTimeout(() => triggerCenterView(), 50);
          }
        } catch (err) {
          console.error('Failed to auto-load query param sample:', err);
        }
      };
      void loadProjectFromList();
    }
  }, [projectsList, loadProject, setProjectHandle, triggerCenterView]);


  return (
    <>
      {!isMobile && (
        <header className="toolbar desktop-only">
        {/* Brand & File Actions */}
        <div className="toolbar-section file-section">
          <h1 className="toolbar-brand">
            {t('toolbar.title')}
            <span style={{ fontSize: '10px', fontWeight: 400, marginLeft: '8px', color: 'var(--text-secondary)', display: 'inline-block', verticalAlign: 'middle' }}>
              {t('toolbar.subtitle')}
            </span>
          </h1>
          <div className="toolbar-divider"></div>
          <button className="toolbar-btn" onClick={handleNew} title={t('toolbar.new')}>{t('toolbar.new')}</button>
          <button className="toolbar-btn" onClick={handleOpenClick} title={t('toolbar.open')}>{t('toolbar.open')}</button>
          <button className="toolbar-btn" onClick={handleImportClick} title={t('toolbar.import') || 'Import JSON'}>{t('toolbar.import') || 'Import JSON'}</button>
          <button className="toolbar-btn" onClick={handleSave} title={t('toolbar.save')}>{t('toolbar.save')}</button>
          <button className="toolbar-btn" onClick={handleSaveAs} title="Save As">Save As</button>
          <select
            className="toolbar-btn sample-select"
            value=""
            onChange={async (e) => {
              const val = e.target.value;
              e.target.value = '';
              if (!val) return;
              if (isDirty && !window.confirm('Unsaved changes will be lost. Continue?')) {
                return;
              }
              try {
                if (val.startsWith('builtin:')) {
                  const sampleId = val.slice('builtin:'.length);
                  if (!findBuiltinSample(sampleId)) return;
                  loadProject(loadBuiltinSampleProject(sampleId));
                  const handle = builtinSampleHandle(sampleId);
                  if (handle) setProjectHandle(handle);
                  return;
                }
                if (window.floorcanvasDesktop?.openProject) {
                  const result = await projectFileService.openWorkspaceProject(val);
                  if (result) {
                    loadProject(result.data);
                    setProjectHandle(result.handle);
                  }
                }
              } catch (err: any) {
                alert('Failed to load project: ' + err.message);
              }
            }}
            style={{ width: 'auto', cursor: 'pointer' }}
          >
            <option value="" disabled>{t('toolbar.loadSample')} / Projects...</option>
            <optgroup label="Built-in Samples">
              {BUILTIN_SAMPLES.map((s) => (
                <option key={s.id} value={`builtin:${s.id}`}>{s.label}</option>
              ))}
            </optgroup>
            {projectsList.length > 0 && (
              <optgroup label="Workspace Projects">
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </optgroup>
            )}
          </select>
          <input 
            type="file" 
            ref={importFileInputRef} 
            onChange={handleImportFileChange} 
            accept=".json,.floormap.json" 
            style={{ display: 'none' }} 
          />
        </div>
        
        {/* Editor Tools */}
        <div className="toolbar-section tools-section">
          <div className="toolbar-divider"></div>
          <button 
            className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select tool (V)"
          >
            <Icons.SelectIcon size={16} />
            <span className="btn-text">Select</span>
          </button>
          <button 
            className={`toolbar-btn ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => setActiveTool('pan')}
            title="Pan view (H)"
          >
            <Icons.PanIcon size={16} />
            <span className="btn-text">Pan</span>
          </button>

          <div className="toolbar-divider"></div>
          <button 
            className="toolbar-btn" 
            title="Undo Ctrl+Z" 
            disabled={past.length === 0}
            onClick={undo}
            style={{ opacity: past.length === 0 ? 0.5 : 1, cursor: past.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icons.UndoIcon size={16} />
            <span className="btn-text">Undo</span>
          </button>
          <button 
            className="toolbar-btn" 
            title="Redo Ctrl+Y" 
            disabled={future.length === 0}
            onClick={redo}
            style={{ opacity: future.length === 0 ? 0.5 : 1, cursor: future.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icons.RedoIcon size={16} />
            <span className="btn-text">Redo</span>
          </button>
        </div>

        {/* Edit Actions */}
        <div className="toolbar-section edit-section">
          <div className="toolbar-divider"></div>
          <button 
            className="toolbar-btn" 
            onClick={copySelectedObjects} 
            disabled={selectedIds.length === 0}
            title="Copy selected elements (Ctrl+C)"
            style={{ opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icons.CopyIcon size={16} />
            <span className="btn-text">Copy</span>
          </button>
          <button 
            className="toolbar-btn" 
            onClick={cutSelectedObjects} 
            disabled={selectedIds.length === 0}
            title="Cut selected elements (Ctrl+X)"
            style={{ opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icons.CutIcon size={16} />
            <span className="btn-text">Cut</span>
          </button>
          <button 
            className="toolbar-btn" 
            onClick={pasteClipboard} 
            disabled={!clipboard}
            title="Paste elements from clipboard (Ctrl+V)"
            style={{ opacity: !clipboard ? 0.5 : 1, cursor: !clipboard ? 'not-allowed' : 'pointer' }}
          >
            <Icons.PasteIcon size={16} />
            <span className="btn-text">Paste</span>
          </button>
          <button 
            className="toolbar-btn" 
            onClick={() => duplicateObjects(selectedIds)} 
            disabled={selectedIds.length === 0}
            title="Duplicate selected elements (Ctrl+D)"
            style={{ opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icons.DuplicateIcon size={16} />
            <span className="btn-text">Duplicate</span>
          </button>
        </div>

        {/* Grid & Calibration */}
        <div className="toolbar-section grid-section">
          <div className="toolbar-divider"></div>
          <button 
            className={`toolbar-btn ${project.grid.visible ? 'active' : ''}`} 
            onClick={toggleGrid}
            title="Toggle alignment grid"
          >
            {t('toolbar.grid')}
          </button>
          <button 
            className={`toolbar-btn ${project.grid.snap ? 'active' : ''}`} 
            onClick={toggleSnap}
            title="Toggle snap to grid/elements"
          >
            {t('toolbar.snap')}
          </button>
          <div className="toolbar-divider"></div>
          <button 
            className={`toolbar-btn ${isCalibrating ? 'active' : ''}`} 
            onClick={startCalibration}
            title="Calibrate Scale by clicking 2 points on canvas"
            style={isCalibrating ? { backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
          >
            <Icons.CalibrateIcon size={16} />
            <span className="btn-text">{t('toolbar.calibrate')}</span>
          </button>
        </div>

        {/* Sheet Status info */}
        <div className="toolbar-section status-section">
          <div className="toolbar-divider"></div>
          <div className="toolbar-status-item">
            <span>{t('toolbar.sheet')}:</span>
            <span className="toolbar-status-value">
              {project.canvas.paperSize === 'custom' 
                ? `Custom (${project.canvas.width}x${project.canvas.height}mm)`
                : `${project.canvas.paperSize} ${project.canvas.orientation.charAt(0).toUpperCase() + project.canvas.orientation.slice(1)}`
              }
            </span>
          </div>
          <div className="toolbar-status-item">
            <span>{t('toolbar.scale')}:</span>
            <span className="toolbar-status-value">
              {project.scale.status === 'calibrated' ? project.scale.drawingScale : t('toolbar.notSet')}
            </span>
          </div>
          <div className="toolbar-status-item">
            <span>{t('toolbar.unit')}:</span>
            <span className="toolbar-status-value">{project.unit}</span>
          </div>
        </div>
        
        {/* Zoom view section */}
        <div className="toolbar-section zoom-section">
          <div className="toolbar-divider"></div>
          <button className="toolbar-btn" onClick={zoomOut} title="Zoom Out" style={{ padding: '0 8px', height: '30px' }}>-</button>
          <div className="toolbar-status-item" style={{ height: '30px', padding: '0 8px' }}>
            <span className="toolbar-status-value">{Math.round(zoom * 100)}%</span>
          </div>
          <button className="toolbar-btn" onClick={zoomIn} title="Zoom In" style={{ padding: '0 8px', height: '30px' }}>+</button>
          <button className="toolbar-btn" onClick={triggerCenterView} title="Fit to Screen" style={{ height: '30px', padding: '0 12px' }}>{t('toolbar.fit')}</button>
        </div>

        {/* Export / Help primary actions */}
        <div className="toolbar-section actions-section">
          <div className="toolbar-divider"></div>
          <button 
            className="toolbar-btn export-btn" 
            onClick={handleExportClick} 
            style={{ backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary-hover)' }} 
            title="Export project to PDF/SVG/PNG"
          >
            {t('toolbar.export')}
          </button>
          <button 
            className="toolbar-btn help-btn" 
            onClick={() => setIsHelpModalOpen(true)} 
            title="Show keyboard shortcuts and user guide"
          >
            <Icons.HelpIcon size={16} />
            <span className="btn-text">Help</span>
          </button>
          <div className="toolbar-divider"></div>
          <LanguageSwitcher />
        </div>
        </header>
      )}
      {isMobile && (
        <header className="toolbar mobile-only" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '48px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }}>
        <h1 className="toolbar-brand" style={{ fontSize: '14px', margin: 0 }}>
          {t('toolbar.title')}
        </h1>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="toolbar-btn" onClick={handleSave} title={t('toolbar.save')} style={{ height: '32px', padding: '0 8px', minWidth: '32px' }}>
            <Icons.SaveIcon size={14} />
          </button>
          
          <button 
            className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select tool"
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <Icons.SelectIcon size={14} />
          </button>

          <button 
            className={`toolbar-btn ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => setActiveTool('pan')}
            title="Pan view"
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <Icons.PanIcon size={14} />
          </button>

          <button 
            className="toolbar-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ padding: '0 8px', height: '32px', fontSize: '12px' }}
          >
            More ▾
          </button>
        </div>
        </header>
      )}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="mobile-only"
          style={{
            position: 'absolute',
            top: '48px',
            right: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            width: '200px',
            padding: '8px 0',
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <button className="mobile-menu-item" onClick={handleNew}>{t('toolbar.new')}</button>
          <button className="mobile-menu-item" onClick={handleOpenClick}>{t('toolbar.open')}</button>
          <button className="mobile-menu-item" onClick={handleImportClick}>{t('toolbar.import') || 'Import JSON'}</button>
          <div className="mobile-menu-divider"></div>
          
          <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {t('toolbar.loadSample')} / Projects
          </div>
          {BUILTIN_SAMPLES.map((s) => (
            <button
              key={s.id}
              className="mobile-menu-item"
              onClick={async () => {
                if (isDirty && !window.confirm('Unsaved changes will be lost. Continue?')) {
                  return;
                }
                try {
                  loadProject(loadBuiltinSampleProject(s.id));
                  const handle = builtinSampleHandle(s.id);
                  if (handle) setProjectHandle(handle);
                  setIsMobileMenuOpen(false);
                } catch (err: any) {
                  alert('Failed to load sample: ' + err.message);
                }
              }}
            >
              {s.label}
            </button>
          ))}
          {projectsList.map((p) => (
            <button
              key={p.id}
              className="mobile-menu-item"
              onClick={async () => {
                if (isDirty && !window.confirm('Unsaved changes will be lost. Continue?')) {
                  return;
                }
                try {
                  const result = await projectFileService.openWorkspaceProject(p.id);
                  if (result) {
                    loadProject(result.data);
                    setProjectHandle(result.handle);
                    setIsMobileMenuOpen(false);
                  }
                } catch (err: any) {
                  alert('Failed to load project: ' + err.message);
                }
              }}
            >
              {p.title}
            </button>
          ))}
          
          <div className="mobile-menu-divider"></div>
          <button className="mobile-menu-item" onClick={handleExportClick}>{t('toolbar.export')}</button>
          <button className="mobile-menu-item" onClick={() => setIsHelpModalOpen(true)}>
            <span style={{ marginRight: '6px', display: 'inline-flex', alignItems: 'center' }}><Icons.HelpIcon size={14} /></span>
            {t('common.help')}
          </button>
          
          <div className="mobile-menu-divider"></div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 12px' }}>
            <LanguageSwitcher />
          </div>
        </div>
      )}

      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
      <ImportMergeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        importData={importData}
        onImport={handleImportMerge}
      />
      {isClosePromptOpen && (
        <div
          className="close-prompt-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="close-prompt" style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '380px',
            width: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 style={{ margin: '0 0 8px' }}>{t('close.unsavedTitle')}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{t('close.unsavedBody')}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="toolbar-btn"
                onClick={async () => {
                  // Only accept the close when the save actually succeeded.
                  // A cancelled or failed save keeps the app (and this
                  // dialog) open so the user can retry, Don't Save, or Cancel.
                  const outcome = await handleSave();
                  if (outcome.status === 'saved') {
                    setIsClosePromptOpen(false);
                    await window.floorcanvasDesktop?.acceptClose?.();
                  }
                }}
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {t('close.save')}
              </button>
              <button
                className="toolbar-btn"
                onClick={async () => {
                  setIsClosePromptOpen(false);
                  await window.floorcanvasDesktop?.acceptClose?.();
                }}
              >
                {t('close.dontSave')}
              </button>
              <button
                className="toolbar-btn"
                onClick={() => setIsClosePromptOpen(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
