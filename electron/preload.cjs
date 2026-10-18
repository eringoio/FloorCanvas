const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floorcanvasDesktop', {
  // Workspace
  getWorkspaceState: () => ipcRenderer.invoke('workspace:get-state'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  changeWorkspace: () => ipcRenderer.invoke('workspace:change'),
  revealWorkspaceFolder: () => ipcRenderer.invoke('workspace:reveal'),
  clearLastProject: () => ipcRenderer.invoke('workspace:clear-last-project'),

  // Projects (workspace-constrained)
  listProjects: () => ipcRenderer.invoke('projects:list'),
  openProject: (projectIdOrPath) => ipcRenderer.invoke('projects:open', projectIdOrPath),
  saveProject: (handle, projectData) => ipcRenderer.invoke('projects:save', handle, projectData),
  saveProjectAs: (projectData, suggestedName, sourceFolderPath) => ipcRenderer.invoke('projects:save-as', projectData, suggestedName, sourceFolderPath),
  openProjectDialog: () => ipcRenderer.invoke('projects:open-dialog'),

  // Assets
  importBackgroundImage: (projectHandle) => ipcRenderer.invoke('assets:import-background-image', projectHandle),
  resolveAssetUrl: (projectHandle, assetPath) => ipcRenderer.invoke('assets:resolve-url', projectHandle, assetPath),

  // Desktop lifecycle
  acceptClose: () => ipcRenderer.invoke('app:accept-close'),
  onCloseRequested: (handler) => {
    ipcRenderer.removeAllListeners('app:close-requested');
    ipcRenderer.on('app:close-requested', handler);
  },
});
