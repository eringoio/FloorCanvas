import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useI18n } from '../i18n';
import * as Icons from '../ui/icons/Icons';
import type { WorkspaceState } from '../types/floormapDesktop';
import { ensureValidProject } from '../utils/projectValidation';

/**
 * Desktop-only gate that ensures a Workspace Folder is configured before the
 * editor runs. In the plain browser build (no desktop bridge) children render
 * immediately.
 *
 * Desktop startup behavior:
 * 1. load settings / workspace state;
 * 2. no workspace → first-run setup prompt;
 * 3. configured but unavailable → recovery prompt (Retry / Choose another);
 * 4. workspace available → try to reopen `lastProjectPath`:
 *    - valid project → loading it into the editor;
 *    - missing/invalid/corrupted → clear the stale reference (via IPC) and
 *      show the lightweight start screen instead. The app never crashes.
 */

interface WorkspaceGateProps {
  children: React.ReactNode;
}

export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({ children }) => {
  const { t } = useI18n();
  const desktop = typeof window !== 'undefined' ? window.floorcanvasDesktop : undefined;
  const loadProject = useProjectStore((state) => state.loadProject);
  const setProjectHandle = useProjectStore((state) => state.setProjectHandle);
  const [state, setState] = React.useState<WorkspaceState | null>(null);
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showStartScreen, setShowStartScreen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!desktop?.getWorkspaceState) {
        // Plain browser mode: no workspace gate needed.
        setReady(true);
        return;
      }
      try {
        const ws = await desktop.getWorkspaceState();
        if (cancelled) return;
        setState(ws);
        if (ws.configured && ws.available) {
          await tryReopenLastProject(ws);
        } else {
          setShowStartScreen(false);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [desktop]);

  /**
   * Reopen the last project after validating the saved data. Any failure
   * (missing folder, missing file, parse error, validation error) falls back
   * to the start screen without crashing.
   */
  const tryReopenLastProject = async (ws: WorkspaceState) => {
    if (!desktop?.openProject || !ws.lastProjectPath) {
      setShowStartScreen(false);
      return;
    }
    try {
      // lastProjectPath is the project file path; openProject takes the folder.
      const folderPath = ws.lastProjectPath.replace(/[\\/]+project\.floormap\.json$/i, '');
      const result = await desktop.openProject(folderPath);
      const validated = ensureValidProject(result.data);
      loadProject(validated);
      setProjectHandle(result.handle);
      setShowStartScreen(false);
    } catch {
      // Stale reference: clear it and show the start screen.
      try {
        const cleared = await desktop.clearLastProject?.();
        if (cleared) setState(cleared);
      } catch {
        /* ignore */
      }
      setShowStartScreen(true);
    }
  };

  const handleChoose = async () => {
    if (!desktop?.chooseWorkspace) return;
    setBusy(true);
    setError(null);
    try {
      const ws = await desktop.chooseWorkspace();
      if (ws) {
        setState(ws);
        if (ws.configured && ws.available) {
          await tryReopenLastProject(ws);
        }
      }
    } catch (err) {
      setError(t('workspace.chooseFailed') || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = async () => {
    if (!desktop?.getWorkspaceState) return;
    setBusy(true);
    setError(null);
    try {
      setState(await desktop.getWorkspaceState());
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return <div className="workspace-gate-loading" style={{ minHeight: '100vh' }} />;
  }

  // Browser mode: nothing to gate.
  if (!state) {
    return <>{children}</>;
  }

  if (!state.configured) {
    return (
      <div className="workspace-gate" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-canvas, #f1f5f9)',
      }}>
        <div className="workspace-gate-card" style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.08))',
          padding: '32px',
          maxWidth: '460px',
          textAlign: 'center',
        }}>
          <h2 style={{ marginTop: 0 }}>{t('workspace.setupTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{t('workspace.setupBody')}</p>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            className="toolbar-btn"
            style={{ backgroundColor: 'var(--primary)', color: '#fff', padding: '8px 20px' }}
            disabled={busy}
            onClick={handleChoose}
          >
            {t('workspace.chooseButton')}
          </button>
        </div>
      </div>
    );
  }

  if (!state.available) {
    return (
      <div className="workspace-gate" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-canvas, #f1f5f9)',
      }}>
        <div className="workspace-gate-card" style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.08))',
          padding: '32px',
          maxWidth: '520px',
          textAlign: 'center',
        }}>
          <h2 style={{ marginTop: 0 }}>{t('workspace.missingTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{t('workspace.missingBody')}</p>
          <p className="workspace-gate-path" style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
            {state.workspacePath}
          </p>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="toolbar-btn" disabled={busy} onClick={handleRetry}>
              {t('workspace.retry')}
            </button>
            <button
              className="toolbar-btn"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              disabled={busy}
              onClick={handleChoose}
            >
              {t('workspace.chooseAnother')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showStartScreen) {
    return (
      <StartScreen
        state={state}
        onClose={() => setShowStartScreen(false)}
        onChangeWorkspace={async () => {
          if (!desktop?.changeWorkspace) return;
          if (useProjectStore.getState().isDirty
            && !window.confirm(t('toolbar.confirmNew') || 'Unsaved changes will be lost. Continue?')) {
            return;
          }
          setBusy(true);
          try {
            const ws = await desktop.changeWorkspace();
            if (ws) {
              setState(ws);
              setShowStartScreen(false);
            }
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  return <>{children}</>;
};

/**
 * Lightweight desktop start/welcome state. Offers New / Open / recent
 * workspace projects and workspace switching. The editor behind it keeps its
 * normal default-project state — no editor redesign.
 */
const StartScreen: React.FC<{
  state: WorkspaceState;
  onClose: () => void;
  onChangeWorkspace: () => void;
}> = ({ state, onClose, onChangeWorkspace }) => {
  const { t } = useI18n();
  const desktop = typeof window !== 'undefined' ? window.floorcanvasDesktop : undefined;
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setProjectHandle = useProjectStore((s) => s.setProjectHandle);
  const [projects, setProjects] = React.useState<Array<{ id: string; title: string; modifiedAt: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!desktop?.listProjects) return;
    desktop.listProjects().then((list) => {
      if (!cancelled) {
        setProjects(
          [...list].sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1)).slice(0, 8),
        );
      }
    }).catch(() => {
      /* listing failures are non-fatal */
    });
    return () => {
      cancelled = true;
    };
  }, [desktop]);

  const handleOpen = async (id?: string) => {
    if (!desktop) return;
    try {
      if (id && desktop.openProject) {
        const result = await desktop.openProject(id);
        loadProject(ensureValidProject(result.data));
        setProjectHandle(result.handle);
      } else if (desktop.openProjectDialog) {
        const folderPath = await desktop.openProjectDialog();
        if (folderPath) {
          const result = await desktop.openProject(folderPath);
          loadProject(ensureValidProject(result.data));
          setProjectHandle(result.handle);
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to open project:', err);
    }
  };

  const handleNew = () => {
    createNewProject();
    onClose();
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color, #e2e8f0)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.08))',
    padding: '32px',
    width: '440px',
    maxWidth: '90vw',
  };

  return (
    <div className="start-screen" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-canvas, #f1f5f9)',
    }}>
      <div className="start-screen-card" style={cardStyle}>
        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icons.SelectIcon size={18} />
          {t('start.title')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '-8px' }}>{t('start.subtitle')}</p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button className="toolbar-btn" style={{ backgroundColor: 'var(--primary)', color: '#fff' }} onClick={handleNew}>
            {t('start.newProject')}
          </button>
          <button className="toolbar-btn" onClick={() => void handleOpen()}>
            {t('start.openProject')}
          </button>
        </div>

        {projects.length > 0 && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {t('start.recent')}
            </div>
            <div className="start-screen-projects" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginBottom: '16px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}>
              {projects.map((p) => (
                <button
                  key={p.id}
                  className="toolbar-btn start-screen-project-item"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => void handleOpen(p.id)}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '12px' }}>
          <button className="toolbar-btn" style={{ color: 'var(--text-secondary)' }} onClick={onChangeWorkspace}>
            {t('start.changeWorkspace')}
          </button>
          <p className="start-screen-workspace" style={{ margin: '6px 0 0', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
            {state.workspacePath}
          </p>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line react/only-export-components
export default WorkspaceGate;
