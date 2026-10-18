import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Regression tests for defensive validation of untrusted imported
 * `.floormap.json` documents. Runs the real `validateProject` /
 * `ensureValidProject` utilities in the page (exposed for tests) against
 * synthetic malformed inputs.
 */

const VALID_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve('tests/fixtures/valid-project.floormap.json'), 'utf8'),
);

async function openPage(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.canvas-viewport')).toBeVisible();
}

async function validate(page: Page, value: unknown) {
  return page.evaluate(
    (json) => (window as any).__projectValidation.validateProject(json),
    JSON.parse(JSON.stringify(value)),
  );
}

async function ensureValid(page: Page, value: unknown) {
  return page.evaluate(
    (json) => {
      try {
        const project = (window as any).__projectValidation.ensureValidProject(json);
        return { ok: true, project };
      } catch (err: any) {
        return { ok: false, error: String(err && err.message) };
      }
    },
    JSON.parse(JSON.stringify(value)),
  );
}

test.describe('Project validation (untrusted .floormap.json input)', () => {
  test.setTimeout(60_000);

  test('valid fixture passes', async ({ page }) => {
    await openPage(page);
    const result = await validate(page, VALID_FIXTURE);
    expect(result.valid, result.error).toBe(true);
  });

  test('missing required top-level field is rejected', async ({ page }) => {
    await openPage(page);
    const broken = { ...VALID_FIXTURE } as Record<string, unknown>;
    delete broken.layers;
    const result = await validate(page, broken);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('layers');
  });

  test('objects not an array is rejected', async ({ page }) => {
    await openPage(page);
    const result = await validate(page, { ...VALID_FIXTURE, objects: { not: 'an array' } });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('objects');
  });

  test('null object item is rejected', async ({ page }) => {
    await openPage(page);
    const result = await validate(page, { ...VALID_FIXTURE, objects: [null] });
    expect(result.valid).toBe(false);
    expect(result.missing.some((m: string) => m.startsWith('objects['))).toBe(true);
  });

  test('primitive object item is rejected', async ({ page }) => {
    await openPage(page);
    const result = await validate(page, { ...VALID_FIXTURE, objects: [123, 'bad'] });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('objects[0]');
    expect(result.missing).toContain('objects[1]');
  });

  test('object item missing id is rejected', async ({ page }) => {
    await openPage(page);
    const noId = { ...(VALID_FIXTURE.objects as unknown[])[0] } as Record<string, unknown>;
    delete noId.id;
    const result = await validate(page, { ...VALID_FIXTURE, objects: [noId] });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('objects[0].id');
  });

  test('object item missing type is rejected', async ({ page }) => {
    await openPage(page);
    const noType = { ...(VALID_FIXTURE.objects as unknown[])[0] } as Record<string, unknown>;
    delete noType.type;
    const result = await validate(page, { ...VALID_FIXTURE, objects: [noType] });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('objects[0].type');
  });

  test('malformed layers are rejected', async ({ page }) => {
    await openPage(page);
    const nullLayer = await validate(page, { ...VALID_FIXTURE, layers: [null] });
    expect(nullLayer.valid).toBe(false);
    expect(nullLayer.missing).toContain('layers[0]');

    const primitiveLayer = await validate(page, { ...VALID_FIXTURE, layers: ['not-a-layer'] });
    expect(primitiveLayer.valid).toBe(false);

    const noIdLayer = await validate(page, {
      ...VALID_FIXTURE,
      layers: [{ name: 'No Id', visible: true, locked: false, order: 1 }],
    });
    expect(noIdLayer.valid).toBe(false);
    expect(noIdLayer.missing).toContain('layers[0].id');
  });

  test('unsupported unit is rejected', async ({ page }) => {
    await openPage(page);
    const result = await validate(page, { ...VALID_FIXTURE, unit: 'inches' });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('unit');
  });

  test('non-object scale/canvas/grid are rejected', async ({ page }) => {
    await openPage(page);
    const scaleResult = await validate(page, { ...VALID_FIXTURE, scale: 'nope' });
    expect(scaleResult.valid).toBe(false);
    expect(scaleResult.missing).toContain('scale');

    const canvasResult = await validate(page, { ...VALID_FIXTURE, canvas: [1, 2] });
    expect(canvasResult.valid).toBe(false);
    expect(canvasResult.missing).toContain('canvas');

    const gridResult = await validate(page, { ...VALID_FIXTURE, grid: 42 });
    expect(gridResult.valid).toBe(false);
    expect(gridResult.missing).toContain('grid');
  });

  test('old file missing backgrounds normalizes successfully', async ({ page }) => {
    await openPage(page);
    const oldFile = { ...VALID_FIXTURE } as Record<string, unknown>;
    delete oldFile.backgrounds;
    const result = await ensureValid(page, oldFile);
    expect(result.ok, result.error).toBe(true);
    expect((result as any).project.backgrounds).toEqual([]);
  });

  test('saved editor project still passes validation', async ({ page }) => {
    await openPage(page);
    const project = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__store.getState().project)));
    const result = await validate(page, project);
    expect(result.valid, result.error).toBe(true);
  });
});
