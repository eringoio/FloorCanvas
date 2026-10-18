import type { Project } from './project';

export interface ProjectHandle {
  id: string;
  folderPath: string;
  projectPath: string;
  title: string;
}

export interface ProjectListItem {
  id: string;
  title: string;
  folderName: string;
  projectPath: string;
  modifiedAt: string;
}

export interface OpenProjectResult {
  handle: ProjectHandle;
  data: Project;
}

export interface ImportBackgroundResult {
  assetPath: string;
}

export type WorkspaceReason = 'no_workspace' | 'not_found' | 'not_a_directory' | 'error' | null;

export interface WorkspaceState {
  /** True once a workspace folder has been configured. */
  configured: boolean;
  /** True when the configured folder exists and is usable. */
  available: boolean;
  reason?: WorkspaceReason;
  workspacePath: string | null;
  lastProjectPath: string | null;
}

declare global {
  interface Window {
    /**
     * Desktop (Electron) bridge. Undefined in the plain browser build —
     * all optional methods must be feature-detected before use.
     */
    floorcanvasDesktop?: {
      // Workspace
      getWorkspaceState: () => Promise<WorkspaceState>;
      chooseWorkspace: () => Promise<WorkspaceState | null>;
      changeWorkspace: () => Promise<WorkspaceState | null>;
      revealWorkspaceFolder: () => Promise<void>;
      clearLastProject: () => Promise<WorkspaceState | null>;

      // Projects
      listProjects: () => Promise<ProjectListItem[]>;
      openProject: (projectIdOrPath: string) => Promise<OpenProjectResult>;
      saveProject: (handle: ProjectHandle, projectData: Project) => Promise<ProjectHandle>;
      saveProjectAs: (projectData: Project, suggestedName: string, sourceFolderPath?: string | null) => Promise<ProjectHandle>;
      openProjectDialog: () => Promise<string | null>;

      // Assets
      importBackgroundImage: (projectHandle: ProjectHandle) => Promise<ImportBackgroundResult | null>;
      resolveAssetUrl: (projectHandle: ProjectHandle | null, assetPath: string) => Promise<string | null>;

      // Lifecycle
      acceptClose: () => Promise<boolean>;
      onCloseRequested: (handler: () => void) => void;
    };
  }
}

export {};
