const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const storage = require('../../electron/project-storage.cjs');
const settingsMod = require('../../electron/settings.cjs');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeWorkspace() {
  const ws = makeTempDir('fc-ws-');
  fs.mkdirSync(path.join(ws, 'Alpha'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'Beta'), { recursive: true });
  fs.writeFileSync(
    path.join(ws, 'Alpha', 'project.floormap.json'),
    JSON.stringify({ version: '1.0.0', title: 'Alpha Project', unit: 'mm', layers: [], objects: [], backgrounds: [] }),
    'utf8',
  );
  // Beta has no project file → not listed
  return ws;
}

test('sanitizeFolderName handles Unicode, reserved characters and device names', () => {
  assert.strictEqual(storage.sanitizeFolderName('My Office'), 'My Office');
  assert.strictEqual(storage.sanitizeFolderName('アパート計画A'), 'アパート計画A');
  assert.strictEqual(storage.sanitizeFolderName('bad:name*?<>|'), 'bad_name_____');
  assert.strictEqual(storage.sanitizeFolderName('trailing dots...'), 'trailing dots');
  assert.strictEqual(storage.sanitizeFolderName('CON'), '_CON');
  assert.strictEqual(storage.sanitizeFolderName('com1'), '_com1');
  assert.strictEqual(storage.sanitizeFolderName('   '), 'Untitled');
});

test('listProjects returns only folders containing project.floormap.json', () => {
  const ws = makeWorkspace();
  const list = storage.listProjects(ws);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].folderName, 'Alpha');
  assert.strictEqual(list[0].title, 'Alpha Project');
  // No sample-* semantics: folder names are passed through as-is
  fs.mkdirSync(path.join(ws, 'My Office'));
  fs.writeFileSync(path.join(ws, 'My Office', 'project.floormap.json'), JSON.stringify({ title: 'My Office' }), 'utf8');
  assert.strictEqual(storage.listProjects(ws).length, 2);
});

test('openProject reads and returns handle/data', () => {
  const ws = makeWorkspace();
  const result = storage.openProject(ws, 'Alpha');
  assert.strictEqual(result.handle.title, 'Alpha Project');
  assert.ok(result.handle.folderPath, 'folderPath present');
  assert.strictEqual(result.data.title, 'Alpha Project');
});

test('openProject rejects paths outside the workspace', () => {
  const ws = makeWorkspace();
  const outside = makeTempDir('fc-outside-');
  assert.throws(() => storage.openProject(ws, outside), /outside the workspace/);
  assert.throws(() => storage.openProject(ws, '../..'), /outside the workspace|Project file not found/);
});

test('saveProject writes project.floormap.json atomically', () => {
  const ws = makeWorkspace();
  const result = storage.openProject(ws, 'Alpha');
  result.data.title = 'Alpha Updated';
  const saved = storage.saveProject(ws, result.handle, result.data);
  assert.strictEqual(saved.title, 'Alpha Updated');
  const data = JSON.parse(fs.readFileSync(saved.projectPath, 'utf8'));
  assert.strictEqual(data.title, 'Alpha Updated');
  // no leftover tmp file
  const files = fs.readdirSync(path.dirname(saved.projectPath));
  assert.ok(!files.some((f) => f.includes('.tmp')), `no tmp remaining: ${files}`);
});

test('saveProject rejects handles outside the workspace', () => {
  const ws = makeWorkspace();
  const outside = makeTempDir('fc-outside2-');
  assert.throws(
    () => storage.saveProject(ws, { id: 'X', folderPath: outside, projectPath: path.join(outside, 'project.floormap.json'), title: 'X' }, {}),
    /outside the workspace/,
  );
});

test('saveProjectAs creates folder + assets, copies source assets, handles collisions', () => {
  const ws = makeWorkspace();
  // source assets
  const srcDir = path.join(ws, 'Alpha');
  fs.mkdirSync(path.join(srcDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'assets', 'img.png'), Buffer.from([1, 2, 3]));

  const first = storage.saveProjectAs(ws, { title: 'My Office' }, 'My Office', srcDir);
  assert.strictEqual(first.folderPath, path.join(ws, 'My Office'));
  assert.ok(fs.existsSync(path.join(first.folderPath, 'assets', 'img.png')));
  assert.ok(fs.existsSync(first.projectPath));

  const second = storage.saveProjectAs(ws, { title: 'My Office' }, 'My Office', null);
  assert.strictEqual(second.folderPath, path.join(ws, 'My Office_1'));
});

test('saveProjectAs rejects when workspace missing', () => {
  const missing = path.join(os.tmpdir(), 'fc-does-not-exist-xyz');
  assert.throws(() => storage.saveProjectAs(missing, {}, 'A'), /does not exist/);
});

test('migrateBase64BackgroundAssets extracts data URLs into assets/', () => {
  const ws = makeWorkspace();
  const projectDir = path.join(ws, 'Alpha');
  const tinyPixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const data = {
    objects: [
      { id: 'bg_1', type: 'background', imageUrl: `data:image/png;base64,${tinyPixel.toString('base64')}`, opacity: 1 },
    ],
  };
  const migrated = storage.migrateBase64BackgroundAssets(data, projectDir);
  assert.strictEqual(migrated, true);
  const bg = data.objects[0];
  assert.ok(bg.assetPath.startsWith('assets/'));
  assert.strictEqual(bg.imageUrl, undefined);
  assert.ok(fs.existsSync(path.join(projectDir, bg.assetPath)));
});

// ---------------------------------------------------------------------------
// Settings layer (simulates restart by re-loading from a fresh userData dir)
// ---------------------------------------------------------------------------

test('settings load/save/update with atomic writes and corrupted-file fallback', () => {
  const userData = makeTempDir('fc-userdata-');
  const fakeApp = { getPath: (p) => (p === 'userData' ? userData : os.tmpdir()) };

  const initial = settingsMod.loadSettings(fakeApp);
  assert.strictEqual(initial.workspacePath, null);
  assert.strictEqual(initial.lastProjectPath, null);

  settingsMod.updateSettings(fakeApp, { workspacePath: 'D:\\FloorCanvas Projects', lastProjectPath: null });
  const reloaded = settingsMod.loadSettings(fakeApp);
  assert.strictEqual(reloaded.workspacePath, 'D:\\FloorCanvas Projects');
  assert.strictEqual(reloaded.version, 1);

  // Atomic write: no tmp leftovers
  const files = fs.readdirSync(userData);
  assert.ok(!files.some((f) => f.endsWith('.tmp')));

  // Corrupted settings file → fresh defaults, no crash
  fs.writeFileSync(path.join(userData, 'floorcanvas-settings.json'), '{not json', 'utf8');
  const recovered = settingsMod.loadSettings(fakeApp);
  assert.strictEqual(recovered.workspacePath, null);
});

test('validateWorkspacePath reports missing directories without throwing', () => {
  const missing = path.join(os.tmpdir(), 'fc-missing-ws-xyz');
  const result = storage.validateWorkspacePath(missing);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'not_found');
  const ok = storage.validateWorkspacePath(os.tmpdir());
  assert.strictEqual(ok.ok, true);
});

// ---------------------------------------------------------------------------
// Symlink / junction escape protection
// ---------------------------------------------------------------------------

/** Create a directory symlink (junction on Windows); returns false when the platform/privileges do not allow it. */
function tryCreateDirSymlink(target, linkPath) {
  try {
    if (process.platform === 'win32') {
      // Junctions do not require administrator privileges on Windows.
      fs.symlinkSync(target, linkPath, 'junction');
    } else {
      fs.symlinkSync(target, linkPath, 'dir');
    }
    return true;
  } catch {
    return false;
  }
}

test('symlink/junction inside the workspace pointing outside is rejected (where supported)', () => {
  const ws = makeWorkspace();
  const outside = makeTempDir('fc-outside-link-');
  fs.writeFileSync(
    path.join(outside, 'project.floormap.json'),
    JSON.stringify({ version: '1.0.0', title: 'Evil Outside Project', unit: 'mm', layers: [], objects: [], backgrounds: [] }),
    'utf8',
  );

  const linkPath = path.join(ws, 'evil-link');
  const created = tryCreateDirSymlink(outside, linkPath);
  if (!created) {
    // Symlink creation not permitted in this environment — skip rather than weaken the check.
    return;
  }

  // Opening through the link must be denied.
  assert.throws(() => storage.openProject(ws, linkPath), /outside the workspace/);
  // Saving through the link must be denied too.
  assert.throws(
    () =>
      storage.saveProject(
        ws,
        { id: 'evil-link', folderPath: linkPath, projectPath: path.join(linkPath, 'project.floormap.json'), title: 'Evil' },
        { version: '1.0.0', title: 'Evil', unit: 'mm', layers: [], objects: [], backgrounds: [] },
      ),
    /outside the workspace/,
  );
});

test('legitimate normal workspace folders still work with canonicalized checks', () => {
  const ws = makeWorkspace();
  // Open by id and by absolute path both work.
  const byId = storage.openProject(ws, 'Alpha');
  assert.strictEqual(byId.handle.title, 'Alpha Project');
  const byPath = storage.openProject(ws, path.join(ws, 'Alpha'));
  assert.strictEqual(byPath.handle.title, 'Alpha Project');
  // Save As into a not-yet-existing folder under the workspace works.
  const saved = storage.saveProjectAs(ws, { title: 'Brand New', unit: 'mm', layers: [], objects: [], backgrounds: [] }, 'Brand New', null);
  assert.ok(path.relative(ws, saved.folderPath).startsWith('Brand New'));
});

test('isDirUnderWorkspace canonicalizes symlinks: escape links rejected, real paths pass', () => {
  const ws = makeWorkspace();
  const outside = makeTempDir('fc-outside-asset-');
  const linkPath = path.join(ws, 'escape-link');
  const created = tryCreateDirSymlink(outside, linkPath);
  if (!created) {
    return;
  }
  // The canonical containment check must treat the link as outside.
  assert.strictEqual(storage.isDirUnderWorkspace(ws, linkPath), false);
  // A real subfolder of the workspace is still inside.
  assert.strictEqual(storage.isDirUnderWorkspace(ws, path.join(ws, 'Alpha')), true);
  // The workspace root itself is inside.
  assert.strictEqual(storage.isDirUnderWorkspace(ws, ws), true);
});
