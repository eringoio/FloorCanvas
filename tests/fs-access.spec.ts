import { expect, test } from '@playwright/test';

/**
 * File System Access API save/open tests (browser mode, no Electron bridge).
 *
 * ONLY the browser-native picker APIs are mocked; the application's
 * persistence layer (projectFileService) runs for real. Covers:
 *  - first save opens a picker and writes through the returned handle
 *  - second save reuses the remembered handle without reopening the picker
 *  - picker cancellation keeps the project dirty and writes nothing
 *  - write-permission rejection falls back to the download flow
 *  - opening a project through showOpenFilePicker
 */

interface FsAccessOptions {
  failPermission?: boolean;
  cancelPicker?: boolean;
}

async function installFsAccessMock(page: import('@playwright/test').Page, opts: FsAccessOptions = {}) {
  await page.addInitScript(
    ({ initialFailPermission, initialCancelPicker }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__pickerCalls = [];
      w.__writes = [];
      w.__closedCount = 0;
      w.__pickerAttempts = 0;
      w.__permissionDenied = false;
      w.__failPermission = initialFailPermission;
      w.__pickerThrows = false;
      Object.defineProperty(w, 'floorcanvasDesktop', { get: () => undefined });
      // FS Access support requires BOTH picker functions to exist.
      w.showOpenFilePicker = async () => {
        throw new DOMException('Open picker not used in this test', 'NotAllowedError');
      };

      const deny = () => {
        w.__permissionDenied = true;
        return 'denied';
      };

      const makeHandle = () => ({
        name: 'chosen-name.floormap.json',
        queryPermission: async () => (w.__failPermission ? 'denied' : 'granted'),
        requestPermission: async () => (w.__failPermission ? deny() : 'granted'),
        createWritable: async () => ({
          write: async (chunk: unknown) => {
            (w.__writes as unknown[]).push(chunk);
          },
          close: async () => {
            w.__closedCount = (w.__closedCount as number) + 1;
          },
        }),
      });

      w.showSaveFilePicker = async (pickerOpts: { suggestedName?: string } | undefined) => {
        w.__pickerAttempts = (w.__pickerAttempts as number) + 1;
        (w.__pickerCalls as unknown[]).push(pickerOpts ?? null);
        if (w.__pickerThrows) throw new TypeError('Save file picker unavailable');
        if (initialCancelPicker) throw new DOMException('User cancelled', 'AbortError');
        return makeHandle();
      };
    },
    { initialFailPermission: opts.failPermission ?? false, initialCancelPicker: opts.cancelPicker ?? false },
  );
}

const saveButton = 'header.desktop-only button[title="Save"]';

test('first Save uses the picker once and writes the project JSON through the handle', async ({ page }) => {
  await installFsAccessMock(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

  await page.locator(saveButton).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);

  await expect
    .poll(async () => {
      const calls = await page.evaluate(() => (window as unknown as Record<string, unknown[]>).__pickerCalls as unknown[]);
      const closed = await page.evaluate(() => (window as unknown as Record<string, unknown>).__closedCount as number);
      return { pickers: calls.length, closed };
    })
    .toEqual({ pickers: 1, closed: 1 });

  const pickOpts = await page.evaluate(() => (window as unknown as Record<string, { suggestedName?: string }[]>).__pickerCalls[0]);
  expect(String(pickOpts?.suggestedName)).toMatch(/\.floormap\.json$/);

  // Handle is remembered for overwrite saves.
  const handle = await page.evaluate(() => (window as any).__store!.getState().currentProjectHandle);
  expect(handle).toBeTruthy();

  const written = await page.evaluate(async () => {
    const writes = (window as unknown as { __writes: string[] }).__writes;
    const content = typeof writes[0] === 'string' ? writes[0] : await (writes[0] as unknown as Blob).text();
    return JSON.parse(content);
  });
  expect(written.version).toBe('1.0.0');
  expect(Array.isArray(written.objects)).toBe(true);
});

test('second Save reuses the remembered handle without opening the picker again', async ({ page }) => {
  await installFsAccessMock(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

  await page.locator(saveButton).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);

  // Make an identifiable edit, then Save again: writes straight through.
  await page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => { addObject: (o: object) => void } } }).__store.getState();
    s.addObject({
      id: 'fs_access_edit_marker',
      type: 'text',
      layerId: 'layer_labels',
      x: 12000,
      y: 4000,
      text: 'FS-ACCESS-OVERWRITE',
      fontSize: 240,
      rotation: 0,
      visible: true,
      locked: false,
      color: '#0f172a',
    });
  });

  await page.locator(saveButton).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);

  await expect
    .poll(async () => {
      const pickers = await page.evaluate(() => ((window as unknown as { __pickerCalls: unknown[] }).__pickerCalls.length));
      const writes = await page.evaluate(() => ((window as unknown as { __writes: Blob[] }).__writes.length));
      return { pickers, writes };
    })
    .toEqual({ pickers: 1, writes: 2 });

  const last = await page.evaluate(async () => {
    const blobs = (window as unknown as { __writes: string[] }).__writes;
    const content = typeof blobs[1] === 'string' ? blobs[1] : await (blobs[1] as unknown as Blob).text();
    return JSON.parse(content);
  });
  expect(last.objects.some((o: { id: string }) => o.id === 'fs_access_edit_marker')).toBe(true);
});

test('picker cancellation leaves the project dirty and writes nothing', async ({ page }) => {
  await installFsAccessMock(page, { cancelPicker: true });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

  // Make an edit first so the project is dirty before the cancelled Save.
  await page.evaluate(() => {
    (window as unknown as { __store: { getState: () => { addObject: (o: object) => void } } }).__store.getState().addObject({
      id: 'e2e_cancel_marker',
      type: 'text',
      layerId: 'layer_labels',
      x: 12000,
      y: 4000,
      text: 'CANCEL-MARKER',
      fontSize: 240,
      rotation: 0,
      visible: true,
      locked: false,
      color: '#0f172a',
    });
  });
  await expect.poll(async () => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(true);

  await page.locator(saveButton).first().click();
  await expect
    .poll(async () => {
      const writes = await page.evaluate(() => ((window as unknown as { __writes: Blob[] }).__writes.length));
      const closed = await page.evaluate(() => (window as unknown as { __closedCount: number }).__closedCount);
      return { writes, closed };
    })
    .toEqual({ writes: 0, closed: 0 });
  // Cancelled save keeps the dirty state (changes are not lost silently).
  expect(await page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(true);
});

test('write-permission rejection on overwrite re-prompts through the picker', async ({ page }) => {
  await installFsAccessMock(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

  // First Save goes through the picker and remembers the handle.
  await page.locator(saveButton).first().click();
  await expect.poll(async () => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);
  expect(await page.evaluate(() => (window as any).__store!.getState().currentProjectHandle)).toBeTruthy();

  // Second Save (overwrite path) rejects the write permission: the app drops
  // the stale handle and asks the user again through a fresh picker, which
  // then writes the latest content successfully.
  await page.evaluate(() => {
    (window as unknown as { __store: { getState: () => { addObject: (o: object) => void } } }).__store.getState().addObject({
      id: 'e2e_perm_marker',
      type: 'text',
      layerId: 'layer_labels',
      x: 12000,
      y: 4000,
      text: 'PERM-MARKER',
      fontSize: 240,
      rotation: 0,
      visible: true,
      locked: false,
      color: '#0f172a',
    });
    (window as unknown as { __failPermission: boolean }).__failPermission = true;
  });

  await page.locator(saveButton).first().click();
  await expect.poll(async () => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __permissionDenied: boolean }).__permissionDenied)).toBe(true);
  // A second picker was opened and the fresh writable received the content.
  const attempts = await page.evaluate(() => ((window as unknown as { __pickerAttempts: number }).__pickerAttempts));
  expect(attempts).toBe(2);
  const lastWrite = await page.evaluate(async () => {
    const writes = (window as unknown as { __writes: string[] }).__writes;
    const content = typeof writes[1] === 'string' ? writes[1] : await (writes[1] as unknown as Blob).text();
    return JSON.parse(content);
  });
  expect(lastWrite.objects.some((o: { id: string }) => o.id === 'e2e_perm_marker')).toBe(true);
});

test('picker API rejection (non-abort) falls back to the download flow', async ({ page }) => {
  await installFsAccessMock(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

  // First Save works normally; then make the picker API itself fail with a
  // non-abort error on the next attempt (permission still granted).
  await page.locator(saveButton).first().click();
  await expect.poll(async () => page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);
  await page.evaluate(() => {
    (window as unknown as { __store: { getState: () => { addObject: (o: object) => void } } }).__store.getState().addObject({
      id: 'e2e_pickerfail_marker',
      type: 'text',
      layerId: 'layer_labels',
      x: 12000,
      y: 4000,
      text: 'PICKERFAIL-MARKER',
      fontSize: 240,
      rotation: 0,
      visible: true,
      locked: false,
      color: '#0f172a',
    });
    (window as unknown as { __pickerThrows: boolean }).__pickerThrows = true;
    // The remembered handle must ALSO lose write permission so the app leaves
    // the overwrite path and reaches the picker fallback.
    (window as unknown as { __failPermission: boolean }).__failPermission = true;
  });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    page.locator(saveButton).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.floormap\.json$/);
  // Still one successful writable close (the first Save); the second Save
  // bypassed the broken picker via the download fallback.
  expect(await page.evaluate(() => (window as unknown as { __closedCount: number }).__closedCount)).toBe(1);
  expect(await page.evaluate(() => (window as any).__store!.getState().isDirty)).toBe(false);
});

test('Open through showOpenFilePicker loads the project and remembers the handle for re-save', async ({ page }) => {
  const fixture = {
    version: '1.0.0',
    title: 'FS-Access Opened Project',
    unit: 'mm',
    layers: [{ id: 'layer_structural_walls', name: 'Structural Walls', visible: true, locked: false, order: 2 }],
    scale: { status: 'calibrated', pixelsPerUnit: 0.025, drawingScale: '1:100' },
    canvas: { paperSize: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 },
    grid: { size: 500, visible: true, snap: true },
    backgrounds: [],
    objects: [{ id: 'fs_open_obj_1', type: 'text', layerId: 'layer_structural_walls', x: 1000, y: 1000, text: 'FS OPEN', fontSize: 240, rotation: 0, visible: true, locked: false }],
  };
  await page.addInitScript((projectJson) => {
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(w, 'floorcanvasDesktop', { get: () => undefined });
    // FS Access support requires BOTH picker functions to exist.
    w.showSaveFilePicker = async () => {
      throw new DOMException('not used in this test', 'AbortError');
    };
    w.showOpenFilePicker = async () => [
      {
        name: 'fs-open-project.floormap.json',
        queryPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        getFile: async () => new File([projectJson], 'fs-open-project.floormap.json', { type: 'application/json' }),
        createWritable: async () => ({
          write: async (chunk: unknown) => {
            (w.__writes as unknown[]).push(chunk);
          },
          close: async () => {
            w.__closedCount = (w.__closedCount as number) + 1;
          },
        }),
      },
    ];
    w.__writes = [];
    w.__closedCount = 0;
  }, JSON.stringify(fixture));

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

  await page.locator('header.desktop-only button[title="Open"]').click();
  await expect
    .poll(async () =>
      page.evaluate(() => (window as unknown as { __store?: { getState: () => { project: { title: string } } } }).__store!.getState().project.title),
    )
    .toBe('FS-Access Opened Project');
  const opened = await page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => { currentProjectHandle: { id: string; projectPath: string }; project: { objects: { id: string }[] } } } }).__store.getState();
    return { handle: s.currentProjectHandle, hasObj: s.project.objects.some((o) => o.id === 'fs_open_obj_1') };
  });
  expect(opened.hasObj).toBe(true);
  expect(opened.handle?.id).toBe('fs-open-project.floormap.json');

  // Re-save immediately writes through the remembered handle (no second pick).
  await page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => { addObject: (o: object) => void } } }).__store.getState();
    s.addObject({ id: 'fs_open_resave_marker', type: 'text', layerId: 'layer_labels', x: 9000, y: 9000, text: 'RESAVE', fontSize: 240, rotation: 0, visible: true, locked: false, color: '#0f172a' });
  });
  await page.locator(saveButton).first().click();
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __store?: { getState: () => { isDirty: boolean } } }).__store!.getState().isDirty))
    .toBe(false);
  const text = await page.evaluate(async () => {
    const blob = (window as unknown as { __writes: Blob[] }).__writes[0];
    const content = typeof blob === 'string' ? blob : await blob.text();
    return JSON.parse(content);
  });
  expect(text.objects.some((o: { id: string }) => o.id === 'fs_open_resave_marker')).toBe(true);
});
