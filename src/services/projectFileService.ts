import type { Project } from '../types/project';
import type { ProjectHandle, WorkspaceState } from '../types/floormapDesktop';
import { ensureValidProject } from '../utils/projectValidation';

/**
 * Platform-aware project file persistence for FloorCanvas.
 *
 * Priority order:
 * 1. Electron desktop bridge (workspace folder-per-project storage).
 * 2. File System Access API (Chrome/Edge) — keeps an in-memory handle so
 *    subsequent Saves overwrite the same file without re-picking. Handles are
 *    never embedded in project JSON.
 * 3. Download/upload fallback — works in every browser, no special APIs.
 *
 * The editor and Zustand store never touch Electron APIs directly.
 */

export type SaveMethod = 'workspace' | 'fs-access' | 'download';

export interface SaveResult {
  handle: ProjectHandle | null;
  method: SaveMethod;
}

export interface OpenResult {
  data: Project;
  handle: ProjectHandle | null;
  method: SaveMethod;
}

export interface BackgroundImportResult {
  /** Runtime URL for rendering: protocol URL (desktop) or data URL (browser). */
  imageUrl: string;
  /** Optional project-relative asset path (desktop only). */
  assetPath?: string;
}

export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && !!window.floorcanvasDesktop;

// ---------------------------------------------------------------------------
// File System Access API (progressive enhancement, all calls feature-detected)
// ---------------------------------------------------------------------------

type FileSystemFileHandleLike = {
  name: string;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  getFile?: () => Promise<File>;
};

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandleLike>;
};

let currentFsHandle: FileSystemFileHandleLike | null = null;

const supportsFsAccess = (): boolean => {
  const w = window as PickerWindow;
  return typeof w.showOpenFilePicker === 'function' && typeof w.showSaveFilePicker === 'function';
};

const requestWritePermission = async (handle: FileSystemFileHandleLike): Promise<boolean> => {
  try {
    if (handle.queryPermission) {
      const state = await handle.queryPermission({ mode: 'readwrite' });
      if (state === 'granted') return true;
    }
    if (handle.requestPermission) {
      const state = await handle.requestPermission({ mode: 'readwrite' });
      return state === 'granted';
    }
    return false;
  } catch {
    return false;
  }
};

const fsAccessFileNameFor = (project: Project): string =>
  `${project.title || 'untitled'}.floormap.json`.replace(/[<>:"/\\|?*]/g, '_');

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export async function saveProject(project: Project, handle: ProjectHandle | null): Promise<SaveResult> {
  const projectData = serializeProject(project);

  // 1. Desktop: direct overwrite of the known workspace project.
  const desktop = window.floorcanvasDesktop;
  if (desktop?.saveProject && handle) {
    const updatedHandle = await desktop.saveProject(handle as any, projectData as any);
    return { handle: updatedHandle as unknown as ProjectHandle, method: 'workspace' };
  }

  // 2. Desktop with unsaved/sample project: first Save creates a workspace
  //    project (folder-per-project) instead of downloading.
  if (desktop?.saveProjectAs) {
    return saveProjectAs(project, handle);
  }

  // 3. File System Access: overwrite the remembered file handle.
  if (currentFsHandle) {
    const permitted = await requestWritePermission(currentFsHandle);
    if (permitted) {
      await writeThroughFsHandle(currentFsHandle, projectData);
      return {
        handle: {
          id: currentFsHandle.name,
          folderPath: '',
          projectPath: currentFsHandle.name,
          title: project.title || currentFsHandle.name,
        },
        method: 'fs-access',
      };
    }
    currentFsHandle = null;
  }

  // 4. Universal fallback: Save As (download).
  return saveProjectAs(project, handle);
}

export async function saveProjectAs(project: Project, handle: ProjectHandle | null): Promise<SaveResult> {
  const projectData = serializeProject(project);

  // 1. Desktop: create a new workspace project.
  const desktop = window.floorcanvasDesktop;
  if (desktop?.saveProjectAs) {
    const suggestedName = project.title || 'untitled';
    const sourcePath = handle?.folderPath || null;
    const newHandle = await desktop.saveProjectAs(projectData as any, suggestedName, sourcePath);
    return { handle: newHandle as unknown as ProjectHandle, method: 'workspace' };
  }

  // 2. File System Access: save file picker.
  if (supportsFsAccess()) {
    try {
      const handleNew = await (window as PickerWindow).showSaveFilePicker!({
        suggestedName: fsAccessFileNameFor(project),
        types: [{ description: 'FloorCanvas Project', accept: { 'application/json': ['.floormap.json'] } }],
      });
      const writable = await handleNew.createWritable();
      await writable.write(JSON.stringify(projectData, null, 2));
      await writable.close();
      currentFsHandle = handleNew;
      return {
        handle: {
          id: handleNew.name,
          folderPath: '',
          projectPath: handleNew.name,
          title: project.title || handleNew.name,
        },
        method: 'fs-access',
      };
    } catch (err: any) {
      if (err && err.name === 'AbortError') return { handle: null, method: 'fs-access' };
      // Permission/API rejection: fall through to download.
    }
  }

  // 4. Universal fallback: download .floormap.json.
  downloadProjectJson(projectData);
  return {
    handle: {
      id: fsAccessFileNameFor(project),
      folderPath: '',
      projectPath: '',
      title: project.title || 'untitled',
    },
    method: 'download',
  };
}

function serializeProject(project: Project): Project {
  return {
    ...project,
    version: project.version || '1.0.0',
  };
}

async function writeThroughFsHandle(fh: FileSystemFileHandleLike, data: unknown): Promise<void> {
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

function downloadProjectJson(projectData: unknown): void {
  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const title = (projectData as Project)?.title || 'floormap';
  link.download = `${String(title).replace(/[<>:"/\\|?*]/g, '_')}.floormap.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

export async function openProjectFile(): Promise<OpenResult | null> {
  // 1. Desktop: workspace project dialog.
  const desktop = window.floorcanvasDesktop;
  if (desktop?.openProjectDialog && desktop.openProject) {
    const folderPath = await desktop.openProjectDialog();
    if (!folderPath) return null;
    const result = await desktop.openProject(folderPath);
    return { data: ensureValidProject(result.data), handle: result.handle as unknown as ProjectHandle, method: 'workspace' };
  }

  // 2. File System Access: open picker with a persistent handle.
  if (supportsFsAccess()) {
    try {
      const [fh] = await (window as PickerWindow).showOpenFilePicker!({
        types: [{ description: 'FloorCanvas Project', accept: { 'application/json': ['.floormap.json'] } }],
        multiple: false,
      });
      const permission = await requestWritePermission(fh);
      const file = await fh.getFile!();
      const data = ensureValidProject(JSON.parse(await file.text()));
      if (permission) currentFsHandle = fh;
      return {
        data,
        handle: {
          id: fh.name,
          folderPath: '',
          projectPath: fh.name,
          title: data.title || fh.name,
        },
        method: 'fs-access',
      };
    } catch (err: any) {
      if (err && err.name === 'AbortError') return null;
      // Parse/API errors surface below via the generic fallback picker.
      throw err;
    }
  }

  // 3. Universal fallback: file input element.
  return openViaInputElement();
}

function openViaInputElement(): Promise<OpenResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.floormap.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = ensureValidProject(JSON.parse(text));
          resolve({
            data: parsed,
            handle: {
              id: file.name,
              folderPath: '',
              projectPath: '',
              title: parsed.title || file.name,
            },
            method: 'download',
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    input.click();
  });
}

/** Open a specific workspace project by id/folder path (desktop only). */
export async function openWorkspaceProject(idOrPath: string): Promise<OpenResult | null> {
  const desktop = window.floorcanvasDesktop;
  if (!desktop?.openProject) return null;
  const result = await desktop.openProject(idOrPath);
  return { data: ensureValidProject(result.data), handle: result.handle as unknown as ProjectHandle, method: 'workspace' };
}

/** Drop any remembered browser file handle (e.g., when switching projects). */
export function forgetCurrentFileHandle(): void {
  currentFsHandle = null;
}

// ---------------------------------------------------------------------------
// Background images
// ---------------------------------------------------------------------------

export async function importBackgroundImage(handle: ProjectHandle | null): Promise<BackgroundImportResult | null> {
  // 1. Desktop: copy into project assets and return the protocol URL.
  const desktop = window.floorcanvasDesktop;
  if (desktop?.importBackgroundImage) {
    if (!handle) {
      throw new Error('Project must be saved first before importing assets.');
    }
    const importResult = await desktop.importBackgroundImage(handle as any);
    if (!importResult) return null;
    const resolved = await desktop.resolveAssetUrl!(handle as any, importResult.assetPath);
    if (!resolved) return null;
    return { imageUrl: resolved, assetPath: importResult.assetPath };
  }

  // 2. Browser: read the picked image as a data URL embedded in the project.
  const dataUrl = await pickImageAsDataUrl();
  return dataUrl ? { imageUrl: dataUrl } : null;
}

function pickImageAsDataUrl(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/svg+xml,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Workspace (thin passthrough, unused in browser mode)
// ---------------------------------------------------------------------------

export async function getWorkspaceState(): Promise<WorkspaceState | null> {
  if (!window.floorcanvasDesktop?.getWorkspaceState) return null;
  return window.floorcanvasDesktop.getWorkspaceState();
}
