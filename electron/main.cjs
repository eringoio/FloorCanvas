const { app, BrowserWindow, Menu, dialog, ipcMain, shell, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const settings = require('./settings.cjs');
const storage = require('./project-storage.cjs');

const isDev = process.env.ELECTRON_DEV === 'true';
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

app.commandLine.appendSwitch('disable-gpu');

// Register custom protocol to safely load local project assets
protocol.registerSchemesAsPrivileged([
  { scheme: 'floorcanvas-asset', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Active workspace for this session (kept in module scope; value comes from
// settings first, then may be replaced by an explicit workspace change).
let settingsState = null;

function getWorkspacePath() {
  if (!settingsState) return null;
  return settingsState.workspacePath;
}

function getWorkspaceState() {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return { configured: false, available: false, workspacePath: null, lastProjectPath: settingsState?.lastProjectPath || null };
  }
  const validation = storage.validateWorkspacePath(workspacePath);
  return {
    configured: true,
    available: validation.ok,
    reason: validation.ok ? null : validation.reason,
    workspacePath: validation.ok ? validation.resolved : workspacePath,
    lastProjectPath: settingsState?.lastProjectPath || null,
  };
}

function setLastProjectPath(projectPath) {
  settingsState = settings.updateSettings(app, { lastProjectPath: projectPath || null });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.setMenuBarVisibility(false);
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (!currentUrl || url === currentUrl || url.startsWith('file://')) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  // Ask the main process before closing with unsaved changes. The renderer
  // keeps the dirty flag in its local store and answers via 'app:accept-close'.
  win.on('close', (event) => {
    if (win.__rendererAllowsClose) return;
    event.preventDefault();
    win.webContents.send('app:close-requested');
  });

  if (isDev) {
    win.loadURL(devServerUrl);
    return;
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'FloorCanvas could not start',
      'The built application files were not found. Please run "npm run build" before starting the packaged app.',
    );
    app.quit();
    return;
  }

  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  settingsState = settings.loadSettings(app);

  // Register asset protocol handler. Only files inside the current workspace
  // are ever served — the renderer cannot fetch arbitrary local files.
  protocol.handle('floorcanvas-asset', (request) => {
    const parsedUrl = new URL(request.url);
    const filePath = parsedUrl.searchParams.get('path');
    if (!filePath) {
      return new Response('Not Found', { status: 404 });
    }
    try {
      const workspacePath = getWorkspacePath();
      if (!workspacePath) {
        return new Response('Access Denied', { status: 403 });
      }
      const resolved = path.resolve(filePath);
      if (!storage.isDirUnderWorkspace(workspacePath, resolved)) {
        return new Response('Access Denied', { status: 403 });
      }
      if (fs.existsSync(resolved)) {
        const data = fs.readFileSync(resolved);
        return new Response(data);
      }
    } catch (err) {
      console.error('floorcanvas-asset protocol error:', err);
    }
    return new Response('Not Found', { status: 404 });
  });

  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Renderer confirms it is safe to close (unsaved-changes gate). The flag is
// window-scoped so a fresh session must re-confirm after navigation.
ipcMain.handle('app:accept-close', ({ sender }) => {
  const win = BrowserWindow.fromWebContents(sender);
  if (win) {
    win.__rendererAllowsClose = true;
    win.close();
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------------
// Workspace IPC
// ---------------------------------------------------------------------------

ipcMain.handle('workspace:get-state', async () => getWorkspaceState());

ipcMain.handle('workspace:choose', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose FloorCanvas Workspace Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const selected = result.filePaths[0];
  settingsState = settings.updateSettings(app, { workspacePath: selected });
  return getWorkspaceState();
});

ipcMain.handle('workspace:change', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Change FloorCanvas Workspace Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const selected = result.filePaths[0];
  settingsState = settings.updateSettings(app, {
    workspacePath: selected,
    // Project paths from the previous workspace are no longer meaningful.
    lastProjectPath: null,
  });
  return getWorkspaceState();
});

ipcMain.handle('workspace:reveal', async () => {
  const workspacePath = getWorkspacePath();
  if (workspacePath && fs.existsSync(workspacePath)) {
    await shell.openPath(workspacePath);
  }
});

// Renderer reports that the remembered last project is stale/invalid so the
// stale reference is cleared instead of failing again on next startup.
ipcMain.handle('workspace:clear-last-project', async () => {
  settingsState = settings.updateSettings(app, { lastProjectPath: null });
  return getWorkspaceState();
});

// ---------------------------------------------------------------------------
// Project IPC (all paths constrained to the workspace)
// ---------------------------------------------------------------------------

ipcMain.handle('projects:list', async () => {
  try {
    const workspacePath = getWorkspacePath();
    return storage.listProjects(workspacePath);
  } catch (err) {
    console.error('projects:list failed:', err);
    return [];
  }
});

ipcMain.handle('projects:open', async (_event, projectIdOrPath) => {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('No workspace configured');
  const result = storage.openProject(workspacePath, projectIdOrPath);
  // Opening a project makes it the remembered last project.
  setLastProjectPath(result.handle.projectPath);
  return result;
});

ipcMain.handle('projects:save', async (_event, handle, projectData) => {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('No workspace configured');
  const result = storage.saveProject(workspacePath, handle, projectData);
  setLastProjectPath(result.projectPath);
  return result;
});

ipcMain.handle('projects:save-as', async (_event, projectData, suggestedName, sourceFolderPath) => {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('No workspace configured');
  const result = storage.saveProjectAs(workspacePath, projectData, suggestedName, sourceFolderPath);
  setLastProjectPath(result.projectPath);
  return result;
});

ipcMain.handle('projects:open-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const workspacePath = getWorkspacePath();
  const result = await dialog.showOpenDialog(win, {
    defaultPath: workspacePath || undefined,
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  const projectFilePath = path.join(selectedPath, 'project.floormap.json');
  if (!fs.existsSync(projectFilePath)) {
    throw new Error('Selected folder does not contain a project.floormap.json file.');
  }

  return selectedPath;
});

ipcMain.handle('assets:import-background-image', async (event, projectHandle) => {
  if (!projectHandle || !projectHandle.folderPath) {
    throw new Error('Project must be saved first before importing background images.');
  }
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('No workspace configured');
  const projectDir = path.resolve(projectHandle.folderPath);
  if (!storage.isDirUnderWorkspace(workspacePath, projectDir)) {
    throw new Error('Access denied: path is outside the workspace.');
  }
  const win = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const srcFilePath = result.filePaths[0];
  const ext = path.extname(srcFilePath);
  const assetName = `background_${Date.now()}${ext}`;
  const assetsDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const destFilePath = path.join(assetsDir, assetName);
  await fs.promises.copyFile(srcFilePath, destFilePath);

  return {
    assetPath: `assets/${assetName}`,
  };
});

ipcMain.handle('assets:resolve-url', async (_event, projectHandle, assetPath) => {
  if (!projectHandle || !projectHandle.folderPath || !assetPath) {
    return null;
  }
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return null;
  const projectDir = path.resolve(projectHandle.folderPath);
  if (!storage.isDirUnderWorkspace(workspacePath, projectDir)) {
    throw new Error('Access denied: asset path is outside the workspace.');
  }
  const fullAssetPath = path.resolve(projectDir, assetPath);
  if (!storage.isDirUnderWorkspace(projectDir, fullAssetPath)) {
    throw new Error('Access denied: asset path is outside the project folder.');
  }

  if (!fs.existsSync(fullAssetPath)) {
    return null;
  }

  return `floorcanvas-asset://resolve?path=${encodeURIComponent(fullAssetPath)}`;
});
