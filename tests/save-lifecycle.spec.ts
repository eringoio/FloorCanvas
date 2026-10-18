import { expect, test, type Page } from '@playwright/test';
import { MOCK_FIXTURE_PROJECTS } from './helpers/mockDesktopProjects';

/**
 * Regression tests for desktop first-save semantics and the close dialog.
 *
 * Covers:
 * - New project: first Save creates exactly one workspace project; later
 *   Saves overwrite the same project (no Project / Project_1 / Project_2).
 * - Built-in sample: first Save promotes the synthetic sample handle to a
 *   real workspace handle; later Saves overwrite it.
 * - Cancelled/failed saves never clear dirty state or replace the handle.
 * - Close dialog: only a successful Save accepts the close.
 *
 * The Electron bridge is mocked in-page; all fixture data is synthetic.
 */

interface SaveMockOptions {
  /** Make saveProject/saveProjectAs reject (simulated persistence failure). */
  failSave?: boolean;
  /** Make saveProjectAs resolve with null (simulated cancelled Save As). */
  cancelSaveAs?: boolean;
}

async function setupSaveMock(page: Page, options: SaveMockOptions = {}) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(
    ({ opts }: { opts: SaveMockOptions }) => {
      const state = {
        saveCalls: [] as any[],
        saveAsCalls: [] as any[],
        acceptCloseCount: 0,
      };
      (window as any).__saveMock = state;

      const api: any = {
        getWorkspaceState: async () => ({
          configured: true,
          available: true,
          reason: null,
          workspacePath: 'C:\\MockWorkspace',
          lastProjectPath: null,
        }),
        chooseWorkspace: async () => null,
        changeWorkspace: async () => null,
        revealWorkspaceFolder: async () => {},
        clearLastProject: async () => null,
        listProjects: async () => [
          { id: 'mock-office', title: 'Mock Floor Plan', folderName: 'mock-office', projectPath: 'C:\\MockWorkspace\\mock-office\\project.floormap.json', modifiedAt: new Date('2026-01-02T00:00:00Z').toISOString() },
        ],
        openProject: async (idOrPath: string) => {
          const projectId = String(idOrPath).split(/[\\/]/).filter(Boolean).pop() || idOrPath;
          const fixtures = (window as any).__mockFixtures;
          const projectData = fixtures[projectId];
          if (!projectData) throw new Error(`Project file not found (mock): ${projectId}`);
          return {
            handle: {
              id: projectId,
              folderPath: `C:\\MockWorkspace\\${projectId}`,
              projectPath: `C:\\MockWorkspace\\${projectId}\\project.floormap.json`,
              title: projectData.title || projectId,
            },
            data: projectData,
          };
        },
        saveProject: async (handle: any, projectData: any) => {
          state.saveCalls.push({ ...handle });
          if (opts.failSave) throw new Error('mock desktop save failure');
          return { ...handle, title: projectData.title };
        },
        saveProjectAs: async (_projectData: any, suggestedName: string) => {
          state.saveAsCalls.push({ suggestedName });
          if (opts.failSave) throw new Error('mock desktop save-as failure');
          if (opts.cancelSaveAs) return null;
          return {
            id: suggestedName,
            folderPath: `C:\\MockWorkspace\\${suggestedName}`,
            projectPath: `C:\\MockWorkspace\\${suggestedName}\\project.floormap.json`,
            title: suggestedName,
          };
        },
        openProjectDialog: async () => null,
        importBackgroundImage: async () => null,
        resolveAssetUrl: async () => '',
        acceptClose: async () => {
          state.acceptCloseCount++;
          return true;
        },
        onCloseRequested: (handler: any) => {
          (window as any).__closeHandler = handler;
        },
      };
      (window as any).floorcanvasDesktop = api;
    },
    { opts: options },
  );
  // Fixture data for openProject (added after the init script so it is set
  // before any app code runs on the page, on every navigation).
  await page.addInitScript((fixtures) => {
    (window as any).__mockFixtures = fixtures;
  }, JSON.parse(JSON.stringify(MOCK_FIXTURE_PROJECTS)));

  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.canvas-viewport')).toBeVisible();
}

const toolbarSaveButton = (page: Page) =>
  page.locator('header.desktop-only button[title="Save"], header.desktop-only button[title="保存"]').first();

async function addEdit(page: Page, id: string) {
  await page.evaluate((objectId) => {
    const store = (window as any).__store.getState();
    store.pushToHistory();
    store.addObjects([
      { id: objectId, type: 'wall', layerId: 'layer_structural_walls', x1: 1000, y1: 1000, x2: 4000, y2: 1000, thickness: 120, rotation: 0, visible: true, locked: false, style: 'interior' },
    ]);
  }, id);
}

function readSaveState() {
  const s = (window as any).__store.getState();
  const m = (window as any).__saveMock;
  return {
    handle: s.currentProjectHandle,
    isDirty: s.isDirty,
    saveCalls: m.saveCalls,
    saveAsCalls: m.saveAsCalls,
    acceptCloseCount: m.acceptCloseCount,
  };
}

test.describe('Desktop first-save semantics (mocked Electron bridge)', () => {
  test.setTimeout(60_000);

  test('new project: first Save creates one workspace project, second Save overwrites it', async ({ page }) => {
    await setupSaveMock(page);

    // Fresh editor: no handle, not dirty.
    const initial = await page.evaluate(readSaveState);
    expect(initial.handle).toBeNull();
    expect(initial.isDirty).toBe(false);

    // Edit + first Save.
    await addEdit(page, 'save_test_wall_1');
    expect(await page.evaluate(() => (window as any).__store.getState().isDirty)).toBe(true);
    await toolbarSaveButton(page).click();

    let state = await page.evaluate(readSaveState);
    expect(state.saveAsCalls.length).toBe(1);
    expect(state.saveCalls.length).toBe(0);
    expect(state.handle).toBeTruthy();
    expect(state.handle.folderPath).toContain('MockWorkspace');
    expect(state.handle.projectPath).toContain('project.floormap.json');
    expect(state.isDirty).toBe(false);
    const firstHandle = state.handle;

    // Second Save must overwrite the same project, not create Project_1/2…
    await addEdit(page, 'save_test_wall_2');
    await toolbarSaveButton(page).click();

    state = await page.evaluate(readSaveState);
    expect(state.saveAsCalls.length).toBe(1); // still exactly one created folder
    expect(state.saveCalls.length).toBe(1); // normal overwrite path
    expect(state.saveCalls[0].projectPath).toBe(firstHandle.projectPath);
    expect(state.isDirty).toBe(false);
    expect(state.handle.projectPath).toBe(firstHandle.projectPath);
  });

  test('built-in sample: first Save promotes it to a real workspace project', async ({ page }) => {
    await setupSaveMock(page);
    await page.goto('/?sample=sample-small-office');
    await page.waitForFunction(
      () => (window as any).__store.getState().currentProjectHandle?.isSample === true,
      undefined,
      { timeout: 10_000 },
    );

    // Synthetic sample handle: no backing file.
    const initial = await page.evaluate(readSaveState);
    expect(initial.handle.isSample).toBe(true);
    expect(initial.handle.folderPath).toBe('');
    expect(initial.handle.projectPath).toBe('');
    expect(initial.isDirty).toBe(false);

    // Edit + first Save.
    await addEdit(page, 'sample_save_wall_1');
    await toolbarSaveButton(page).click();

    let state = await page.evaluate(readSaveState);
    expect(state.saveAsCalls.length).toBe(1);
    expect(state.saveCalls.length).toBe(0);
    expect(state.handle).toBeTruthy();
    expect(state.handle.isSample).toBeUndefined();
    expect(state.handle.folderPath).toContain('MockWorkspace');
    expect(state.isDirty).toBe(false);
    const promotedHandle = state.handle;

    // Next Save uses the normal overwrite path with the promoted handle.
    await addEdit(page, 'sample_save_wall_2');
    await toolbarSaveButton(page).click();

    state = await page.evaluate(readSaveState);
    expect(state.saveAsCalls.length).toBe(1);
    expect(state.saveCalls.length).toBe(1);
    expect(state.saveCalls[0].projectPath).toBe(promotedHandle.projectPath);
    expect(state.isDirty).toBe(false);
  });

  test('cancelled Save As keeps dirty state and the current handle unchanged', async ({ page }) => {
    await setupSaveMock(page, { cancelSaveAs: true });

    await addEdit(page, 'cancel_wall_1');
    await toolbarSaveButton(page).click();

    const state = await page.evaluate(readSaveState);
    expect(state.saveAsCalls.length).toBe(1);
    expect(state.isDirty).toBe(true);
    expect(state.handle).toBeNull();
  });

  test('failed first Save keeps dirty state and does not store a handle', async ({ page }) => {
    await setupSaveMock(page, { failSave: true });

    await addEdit(page, 'fail_wall_1');
    await toolbarSaveButton(page).click();

    const state = await page.evaluate(readSaveState);
    expect(state.saveAsCalls.length).toBe(1);
    expect(state.isDirty).toBe(true);
    expect(state.handle).toBeNull();
  });

  test('failed overwrite Save keeps dirty state and the existing handle unchanged', async ({ page }) => {
    await setupSaveMock(page, { failSave: true });

    // Open an existing workspace project from the projects dropdown.
    await page.locator('select.sample-select').selectOption('mock-office');
    await page.waitForFunction(
      () => (window as any).__store.getState().currentProjectHandle?.id === 'mock-office',
      undefined,
      { timeout: 10_000 },
    );
    const opened = await page.evaluate(readSaveState);
    expect(opened.handle.folderPath).toContain('mock-office');

    await addEdit(page, 'fail_wall_2');
    await toolbarSaveButton(page).click();

    const state = await page.evaluate(readSaveState);
    expect(state.saveCalls.length).toBe(1); // overwrite path attempted
    expect(state.saveAsCalls.length).toBe(0);
    expect(state.isDirty).toBe(true);
    expect(state.handle.projectPath).toBe(opened.handle.projectPath);
  });
});

test.describe('Desktop close dialog lifecycle (mocked Electron bridge)', () => {
  test.setTimeout(60_000);

  const triggerClose = (page: Page) =>
    page.evaluate(() => (window as any).__closeHandler && (window as any).__closeHandler());

  const promptSave = (page: Page) =>
    page.locator('.close-prompt button', { hasText: /^Save$/ }).first();
  const promptDontSave = (page: Page) =>
    page.locator('.close-prompt button', { hasText: /^Don't Save$|^保存しない$/ }).first();
  const promptCancel = (page: Page) =>
    page.locator('.close-prompt button', { hasText: /^Cancel$|^キャンセル$/ }).first();

  test('successful Save before closing accepts the close exactly once', async ({ page }) => {
    await setupSaveMock(page);

    await addEdit(page, 'close_wall_ok');
    await triggerClose(page);
    await expect(page.locator('.close-prompt')).toBeVisible();

    await promptSave(page).click();
    await page.waitForFunction(
      () => (window as any).__saveMock.acceptCloseCount === 1,
      undefined,
      { timeout: 10_000 },
    );
    const state = await page.evaluate(readSaveState);
    expect(state.acceptCloseCount).toBe(1);
    expect(state.isDirty).toBe(false);
    expect(state.saveAsCalls.length).toBe(1); // first Save created the project
    await expect(page.locator('.close-prompt')).toBeHidden();
  });

  test('failed Save before closing does NOT close the app and keeps the project dirty', async ({ page }) => {
    await setupSaveMock(page, { failSave: true });

    await addEdit(page, 'close_wall_fail');
    await triggerClose(page);
    await expect(page.locator('.close-prompt')).toBeVisible();

    await promptSave(page).click();
    // Give the (rejected) save time to complete before asserting.
    await page.waitForFunction(
      () => (window as any).__saveMock.saveAsCalls.length === 1,
      undefined,
      { timeout: 10_000 },
    );
    const state = await page.evaluate(readSaveState);
    expect(state.acceptCloseCount).toBe(0);
    expect(state.isDirty).toBe(true);
    // Dialog stays available so the user can retry, Don't Save, or Cancel.
    await expect(page.locator('.close-prompt')).toBeVisible();
  });

  test('cancelled Save before closing does NOT close the app', async ({ page }) => {
    await setupSaveMock(page, { cancelSaveAs: true });

    await addEdit(page, 'close_wall_cancel');
    await triggerClose(page);
    await expect(page.locator('.close-prompt')).toBeVisible();

    await promptSave(page).click();
    await page.waitForFunction(
      () => (window as any).__saveMock.saveAsCalls.length === 1,
      undefined,
      { timeout: 10_000 },
    );
    const state = await page.evaluate(readSaveState);
    expect(state.acceptCloseCount).toBe(0);
    expect(state.isDirty).toBe(true);
    await expect(page.locator('.close-prompt')).toBeVisible();
  });

  test("Don't Save closes without saving", async ({ page }) => {
    await setupSaveMock(page);

    await addEdit(page, 'close_wall_dont');
    await triggerClose(page);
    await expect(page.locator('.close-prompt')).toBeVisible();

    await promptDontSave(page).click();
    await page.waitForFunction(
      () => (window as any).__saveMock.acceptCloseCount === 1,
      undefined,
      { timeout: 10_000 },
    );
    const state = await page.evaluate(readSaveState);
    expect(state.acceptCloseCount).toBe(1);
    expect(state.saveCalls.length).toBe(0);
    expect(state.saveAsCalls.length).toBe(0);
  });

  test('Cancel does not close and does not save', async ({ page }) => {
    await setupSaveMock(page);

    await addEdit(page, 'close_wall_cancelbtn');
    await triggerClose(page);
    await expect(page.locator('.close-prompt')).toBeVisible();

    await promptCancel(page).click();
    await expect(page.locator('.close-prompt')).toBeHidden();

    const state = await page.evaluate(readSaveState);
    expect(state.acceptCloseCount).toBe(0);
    expect(state.saveCalls.length).toBe(0);
    expect(state.saveAsCalls.length).toBe(0);
    expect(state.isDirty).toBe(true);
  });
});
