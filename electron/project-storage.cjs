const fs = require('node:fs');
const path = require('node:path');

/**
 * Workspace project storage for FloorCanvas desktop.
 *
 * Architecture: folder-per-project inside a single user-selected workspace
 * folder. Each project folder contains:
 *   project.floormap.json   (the project document)
 *   assets/                 (project-owned images)
 *
 * All operations are strictly validated to remain inside the workspace.
 * Bundled samples are NOT workspace projects — they live in the frontend.
 */

/**
 * Canonicalize a path through symlinks/junctions when it (or its nearest
 * existing ancestor) exists. For paths that do not exist yet (Save As
 * targets), the closest existing ancestor is canonicalized and the
 * not-yet-existing tail is re-appended, so a new path cannot smuggle an
 * escape through a dangling or nested symlink.
 */
function canonicalizePath(candidate) {
  let resolved = path.resolve(candidate);
  const missing = [];
  while (!fs.existsSync(resolved)) {
    missing.unshift(path.basename(resolved));
    const parent = path.dirname(resolved);
    if (parent === resolved) break; // reached the filesystem root
    resolved = parent;
  }
  try {
    resolved = fs.realpathSync(resolved);
  } catch {
    // If realpath fails for any reason, keep the lexically resolved form;
    // the containment check below still applies.
  }
  return missing.length > 0 ? path.join(resolved, ...missing) : resolved;
}

/**
 * Workspace containment check using canonical (real) paths, so a symlink or
 * junction inside the workspace that points outside the workspace is
 * rejected.
 */
function isDirUnderWorkspace(workspacePath, candidate) {
  if (!workspacePath || !candidate) return false;
  const workspaceReal = canonicalizePath(workspacePath);
  const candidateReal = canonicalizePath(candidate);
  const relative = path.relative(workspaceReal, candidateReal);
  if (relative === '') return true;
  // Reject pure parent traversal ('..' or '../…') without falsely rejecting
  // sibling-looking names such as '..hidden' on platforms that allow them.
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) return false;
  return !path.isAbsolute(relative);
}

function cleanupCorruptKeys(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(cleanupCorruptKeys);
    return;
  }
  for (const key of Object.keys(value)) {
    if (key.includes('[object Object]')) {
      delete value[key];
    } else {
      cleanupCorruptKeys(value[key]);
    }
  }
}

/** Sanitize a user-provided project title/folder name (Windows-safe, Unicode friendly). */
function sanitizeFolderName(name) {
  let cleaned = String(name || '')
    // Windows reserved characters and control characters (keeps Unicode letters/digits)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    // Trailing dots/spaces are invalid on Windows
    .replace(/[. ]+$/g, '')
    .trim();
  if (cleaned === '' || cleaned === '.') cleaned = 'Untitled';
  // Reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9), case-insensitive
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    cleaned = `_${cleaned}`;
  }
  // Reasonable length cap (255 bytes limit minus room for suffixes)
  if (cleaned.length > 120) cleaned = cleaned.slice(0, 120).trimEnd();
  return cleaned;
}

/**
 * Migrate legacy projects that embed background images as data URLs into
 * workspace-owned asset files. Returns true when something changed.
 */
function migrateBase64BackgroundAssets(projectData, projectDir) {
  let migrated = false;
  const assetsDir = path.join(projectDir, 'assets');

  const processBg = (obj) => {
    if (!obj || obj.type !== 'background') return;

    if (typeof obj.imageUrl === 'string' && obj.imageUrl.startsWith('data:image/')) {
      const matches = obj.imageUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1].replace('+xml', '');
        const assetName = `background_${obj.id || Date.now()}_${Date.now()}.${ext}`;
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.writeFileSync(path.join(assetsDir, assetName), Buffer.from(matches[2], 'base64'));
        obj.assetPath = `assets/${assetName}`;
        migrated = true;
      }
    }

    delete obj.imageUrl;
  };

  cleanupCorruptKeys(projectData);
  if (Array.isArray(projectData.objects)) projectData.objects.forEach(processBg);
  if (Array.isArray(projectData.backgrounds)) projectData.backgrounds.forEach(processBg);
  return migrated;
}

function readProjectFile(projectFilePath) {
  const raw = fs.readFileSync(projectFilePath, 'utf8');
  return JSON.parse(raw);
}

function listProjects(workspacePath) {
  const list = [];
  if (!workspacePath || !fs.existsSync(workspacePath)) return list;

  for (const entry of fs.readdirSync(workspacePath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const folderPath = path.join(workspacePath, entry.name);
    const projectFilePath = path.join(folderPath, 'project.floormap.json');
    if (!fs.existsSync(projectFilePath)) continue;
    try {
      const stats = fs.statSync(projectFilePath);
      let title = entry.name;
      try {
        const data = readProjectFile(projectFilePath);
        if (data && typeof data.title === 'string' && data.title.trim() !== '') title = data.title;
      } catch {
        // listing continues even if one project file is unreadable
      }
      list.push({
        id: entry.name,
        title,
        folderName: entry.name,
        projectPath: projectFilePath,
        modifiedAt: stats.mtime.toISOString(),
      });
    } catch (err) {
      console.error(`Error listing project at ${projectFilePath}:`, err);
    }
  }
  return list;
}

/**
 * Read a project folder (path must be inside the workspace).
 * Returns { handle, data } or throws when invalid.
 */
function openProject(workspacePath, folderPathOrId) {
  const projectDir = isDirUnderWorkspace(workspacePath, folderPathOrId)
    ? path.resolve(folderPathOrId)
    : path.resolve(path.join(workspacePath, String(folderPathOrId || '')));

  if (!isDirUnderWorkspace(workspacePath, projectDir)) {
    throw new Error('Access denied: path is outside the workspace.');
  }

  const projectFilePath = path.join(projectDir, 'project.floormap.json');
  if (!fs.existsSync(projectFilePath)) {
    throw new Error(`Project file not found at ${projectFilePath}`);
  }

  const data = readProjectFile(projectFilePath);
  const migrated = migrateBase64BackgroundAssets(data, projectDir);
  if (migrated) {
    fs.writeFileSync(projectFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  const folderName = path.basename(projectDir);
  return {
    handle: {
      id: folderName,
      folderPath: projectDir,
      projectPath: projectFilePath,
      title: (data && data.title) || folderName,
    },
    data,
  };
}

/**
 * Save into an existing project folder inside the workspace.
 * Never asks for confirmation — callers decide overwrite policies.
 */
function saveProject(workspacePath, handle, projectData) {
  if (!handle || !handle.folderPath) {
    throw new Error('Invalid project handle for save operation');
  }
  const projectDir = path.resolve(handle.folderPath);
  if (!isDirUnderWorkspace(workspacePath, projectDir)) {
    throw new Error('Access denied: path is outside the workspace.');
  }

  const cleanData = JSON.parse(JSON.stringify(projectData));
  migrateBase64BackgroundAssets(cleanData, projectDir);
  const projectFilePath = path.join(projectDir, 'project.floormap.json');
  writeProjectAtomic(projectFilePath, cleanData);

  return {
    id: handle.id || path.basename(projectDir),
    folderPath: projectDir,
    projectPath: projectFilePath,
    title: cleanData.title || handle.id,
  };
}

function writeProjectAtomic(projectFilePath, data) {
  const projectDir = path.dirname(projectFilePath);
  fs.mkdirSync(projectDir, { recursive: true });
  const tmpPath = path.join(projectDir, `.project.floormap.json.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, projectFilePath);
}

/**
 * Save As: create a new project folder (collision-safe), copy assets from an
 * optional source folder, write project.floormap.json and return the handle.
 */
function saveProjectAs(workspacePath, projectData, suggestedName, sourceFolderPath) {
  if (!workspacePath) throw new Error('No workspace configured');
  if (!fs.existsSync(workspacePath)) throw new Error(`Workspace folder does not exist: ${workspacePath}`);

  const baseName = sanitizeFolderName(suggestedName || (projectData && projectData.title) || 'Untitled');
  let folderName = baseName;
  let counter = 1;
  let projectDir = path.join(workspacePath, folderName);
  while (fs.existsSync(projectDir)) {
    folderName = `${baseName}_${counter}`;
    projectDir = path.join(workspacePath, folderName);
    counter++;
  }

  fs.mkdirSync(projectDir, { recursive: true });
  const assetsDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const sourceProjectDir = sourceFolderPath && isDirUnderWorkspace(workspacePath, sourceFolderPath)
    ? path.resolve(sourceFolderPath)
    : null;
  if (sourceProjectDir && fs.existsSync(path.join(sourceProjectDir, 'assets'))) {
    try {
      fs.cpSync(path.join(sourceProjectDir, 'assets'), assetsDir, { recursive: true });
    } catch (err) {
      console.error('Error copying assets in save-as:', err);
    }
  }

  const cleanData = JSON.parse(JSON.stringify(projectData));
  migrateBase64BackgroundAssets(cleanData, projectDir);
  const projectFilePath = path.join(projectDir, 'project.floormap.json');
  writeProjectAtomic(projectFilePath, cleanData);

  return {
    id: folderName,
    folderPath: projectDir,
    projectPath: projectFilePath,
    title: (cleanData && cleanData.title) || folderName,
  };
}

function validateWorkspacePath(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string') {
    return { ok: false, reason: 'no_workspace' };
  }
  try {
    const resolved = path.resolve(workspacePath);
    if (!fs.existsSync(resolved)) return { ok: false, reason: 'not_found', resolved };
    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) return { ok: false, reason: 'not_a_directory', resolved };
    return { ok: true, resolved };
  } catch (err) {
    return { ok: false, reason: 'error', error: String(err && err.message) };
  }
}

module.exports = {
  sanitizeFolderName,
  isDirUnderWorkspace,
  listProjects,
  openProject,
  saveProject,
  saveProjectAs,
  validateWorkspacePath,
  migrateBase64BackgroundAssets,
  readProjectFile,
  writeProjectAtomic,
};
