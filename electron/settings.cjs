const fs = require('node:fs');
const path = require('node:path');

/**
 * Small settings layer for FloorCanvas desktop.
 *
 * Persisted under Electron's app userData directory. Schema:
 *   { version: 1, workspacePath: string|null, lastProjectPath: string|null }
 *
 * No credentials are stored here. Writes are atomic (temp file + rename).
 */

const SCHEMA_VERSION = 1;

function getSettingsFilePath(app) {
  return path.join(app.getPath('userData'), 'floorcanvas-settings.json');
}

function sanitize(value) {
  const src = value && typeof value === 'object' ? value : {};
  return {
    version: SCHEMA_VERSION,
    workspacePath: typeof src.workspacePath === 'string' && src.workspacePath.trim() !== '' ? src.workspacePath : null,
    lastProjectPath: typeof src.lastProjectPath === 'string' && src.lastProjectPath.trim() !== '' ? src.lastProjectPath : null,
  };
}

function loadSettings(app) {
  try {
    const file = getSettingsFilePath(app);
    if (!fs.existsSync(file)) return sanitize(null);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return sanitize(raw);
  } catch (err) {
    // Corrupted settings must not crash the app: start fresh.
    console.error('Failed to load FloorCanvas settings, starting fresh:', err);
    return sanitize(null);
  }
}

function saveSettings(app, settings) {
  const file = getSettingsFilePath(app);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = sanitize(settings);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return next;
}

function updateSettings(app, patch) {
  const current = loadSettings(app);
  return saveSettings(app, { ...current, ...patch });
}

module.exports = {
  SCHEMA_VERSION,
  loadSettings,
  saveSettings,
  updateSettings,
};
