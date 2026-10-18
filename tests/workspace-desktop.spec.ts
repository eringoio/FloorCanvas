import { expect, test, type Page } from '@playwright/test';
import { MOCK_FIXTURE_PROJECTS } from './helpers/mockDesktopProjects';

/**
 * Desktop startup behavior (last-project reopening and start screen) with a
 * mocked Electron bridge. All fixture data is synthetic.
 */

interface DesktopMockOptions {
  lastProjectPath?: string | null;
  /** Make openProject throw (missing/corrupted project). */
  failOpen?: boolean;
}

async function setupDesktopMock(page: Page, options: DesktopMockOptions) {
  await page.addInitScript(
    ({ opts, fixtures }: { opts: DesktopMockOptions; fixtures: unknown }) => {
      const projectsMetadata = [
        { id: 'mock-office', title: 'Mock Floor Plan', modifiedAt: new Date('2026-01-02T00:00:00Z').toISOString() },
        { id: 'mock-large', title: 'Mock Large Plan', modifiedAt: new Date('2026-01-01T00:00:00Z').toISOString() },
      ];

      const api: any = {
        getWorkspaceState: async () => ({
          configured: true,
          available: true,
          reason: null,
          workspacePath: '/mock-workspace',
          lastProjectPath: opts.lastProjectPath ?? null,
        }),
        chooseWorkspace: async () => null,
        changeWorkspace: async () => null,
        clearLastProject: async () => {
          (window as any).__lastProjectCleared = true;
          return { configured: true, available: true, reason: null, workspacePath: '/mock-workspace', lastProjectPath: null };
        },
        listProjects: async () => projectsMetadata,
        openProject: async (idOrPath: string) => {
          if (opts.failOpen) throw new Error('Project file not found');
          const projectId = String(idOrPath).split('/').filter(Boolean).pop() || idOrPath;
          const projectData = (fixtures as Record<string, any>)[projectId];
          if (!projectData) throw new Error(`Project file not found (mock): ${projectId}`);
          return {
            handle: {
              id: projectId,
              folderPath: `/mock-workspace/${projectId}`,
              projectPath: `/mock-workspace/${projectId}/project.floormap.json`,
              title: projectData.title || projectId,
            },
            data: projectData,
          };
        },
        saveProject: async (handle: any) => handle,
        saveProjectAs: async (_p: any, suggestedName: string) => ({
          id: suggestedName,
          folderPath: `/mock-workspace/${suggestedName}`,
          projectPath: `/mock-workspace/${suggestedName}/project.floormap.json`,
          title: suggestedName,
        }),
        openProjectDialog: async () => null,
        importBackgroundImage: async () => null,
        resolveAssetUrl: async () => '',
        acceptClose: async () => true,
        onCloseRequested: () => {},
      };
      (window as any).floorcanvasDesktop = api;
    },
    { opts: options, fixtures: MOCK_FIXTURE_PROJECTS },
  );
}

test.describe('Desktop startup: last project reopening', () => {
  test.setTimeout(60_000);

  test('reopens a valid last project automatically', async ({ page }) => {
    await setupDesktopMock(page, { lastProjectPath: '/mock-workspace/mock-office/project.floormap.json' });
    await page.goto('/');
    await page.waitForFunction(
      () => (window as any).__store?.getState().project?.title === 'Mock Floor Plan',
      undefined,
      { timeout: 10_000 },
    );
    const title = await page.evaluate(() => (window as any).__store.getState().project.title);
    expect(title).toBe('Mock Floor Plan');
  });

  test('shows the start screen when the last project is missing and clears the stale reference', async ({ page }) => {
    await setupDesktopMock(page, { lastProjectPath: '/mock-workspace/missing/project.floormap.json', failOpen: true });
    await page.goto('/');
    const startScreen = page.locator('.start-screen');
    await expect(startScreen).toBeVisible();
    const cleared = await page.evaluate(() => (window as any).__lastProjectCleared === true);
    expect(cleared).toBe(true);
  });

  test('start screen New Project closes it and shows the editor default project', async ({ page }) => {
    await setupDesktopMock(page, { lastProjectPath: '/mock-workspace/missing/project.floormap.json', failOpen: true });
    await page.goto('/');
    const startScreen = page.locator('.start-screen');
    await expect(startScreen).toBeVisible();
    await page.locator('.start-screen button:has-text("New Project"), .start-screen button:has-text("新規プロジェクト")').first().click();
    await expect(startScreen).toBeHidden();
    await expect(page.locator('.canvas-viewport')).toBeVisible();
  });

  test('with no last project configured the editor opens directly', async ({ page }) => {
    await setupDesktopMock(page, { lastProjectPath: null });
    await page.goto('/');
    await expect(page.locator('.start-screen')).toBeHidden();
    await expect(page.locator('.canvas-viewport')).toBeVisible();
  });
});
