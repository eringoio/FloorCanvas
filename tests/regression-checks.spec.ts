import { test, expect } from '@playwright/test';

test.describe('Additional Regression Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Log browser console
    page.on('console', msg => {
      console.log('BROWSER LOG:', msg.text());
    });

    // Auto-accept confirmation prompts (needed for Delete Walls and Explode Room)
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
  });

  test('compound undo history for room conversion and room explode', async ({ page }) => {
    await page.goto('/');

    // Start with a clean blank project
    const newBtn = page.locator('button[title="New"], button:has-text("New"), button:has-text("新規作成")').first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await page.waitForTimeout(500);

    // Clear all default objects to have an absolutely empty slate
    await page.evaluate(() => {
      const store = (window as any).__store.getState();
      store.setObjects([]);
      store.setSelectedIds([]);
    });
    await page.waitForTimeout(200);

    // Switch to Rectangular Walls tool
    const rectWallBtn = page.locator('button[title="Rectangular Walls"], button:has-text("Rectangular Walls"), button:has-text("長方形の壁")').first();
    await expect(rectWallBtn).toBeVisible();
    await rectWallBtn.click();

    const viewport = page.locator('.canvas-viewport');
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = Math.round(box.x + box.width / 2 - 100);
      const startY = Math.round(box.y + box.height / 2 - 100);
      const endX = startX + 200;
      const endY = startY + 200;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      // Select all 4 newly created walls via the store for robust E2E selection
      await page.evaluate(() => {
        const store = (window as any).__store;
        const ids = store.getState().project.objects.map((o: any) => o.id);
        store.getState().setSelectedIds(ids);
        store.getState().setActiveTool('select');
      });
      await page.waitForTimeout(200);

      // Check that convert to room button is visible and click it
      const convertBtn = page.locator('button:has-text("Convert 4 Walls to Smart Room"), button:has-text("Convert to Smart Room"), button:has-text("4枚の壁をスマートルームに変換"), button:has-text("スマート部屋に変換")').first();
      await expect(convertBtn).toBeVisible();
      await convertBtn.click();
      await page.waitForTimeout(200);

      // Verify a room element got created in the DOM
      const svg = page.locator('.paper-boundary svg').last();
      const roomElement = svg.locator('.room-element');
      await expect(roomElement).toBeAttached();

      // Verify that undoing ONCE removes the room and restores the 4 walls
      await page.locator('.canvas-viewport').click({ position: { x: 10, y: 10 } });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      await expect(roomElement).not.toBeAttached();

      // Verify that redoing ONCE restores the room
      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(200);
      await expect(roomElement).toBeAttached();

      // Select the room
      const roomBox = await roomElement.boundingBox();
      expect(roomBox).not.toBeNull();
      if (roomBox) {
        await page.mouse.click(roomBox.x + roomBox.width / 2, roomBox.y + roomBox.height / 2);
        
        // Explode room to walls
        const explodeBtn = page.locator('button:has-text("Explode to Walls"), button:has-text("壁に分解")').first();
        await expect(explodeBtn).toBeVisible();
        await explodeBtn.click();
        await page.waitForTimeout(200);

        // Verify room is deleted and wall lines are attached
        await expect(roomElement).not.toBeAttached();
        const wallLines = svg.locator('line:not(.selection-highlight):not(.selection-outline):not(.snap-guide)');
        const wallCount = await wallLines.count();
        expect(wallCount).toBeGreaterThanOrEqual(4);

        // Verify that undoing ONCE restores the room and deletes the exploded walls
        await page.locator('.canvas-viewport').click({ position: { x: 10, y: 10 } });
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(200);
        await expect(roomElement).toBeAttached();
      }
    }
  });

  test('locked layer drag protection', async ({ page }) => {
    await page.goto('/');

    // Start with a clean blank project
    const newBtn = page.locator('button[title="New"], button:has-text("New"), button:has-text("新規作成")').first();
    await newBtn.click();
    await page.waitForTimeout(500);

    // Draw a wall
    const wallBtn = page.locator('button[title="Wall"], button:has-text("Wall"), button:has-text("壁")').first();
    await wallBtn.click();

    const viewport = page.locator('.canvas-viewport');
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = Math.round(box.x + box.width / 2);
      const startY = Math.round(box.y + box.height / 2);
      const endX = startX + 200;
      const endY = startY;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 5 });
      await page.mouse.up();

      // Switch to Select tool and select the wall
      const selectBtn = page.locator('button[title="Select"], button:has-text("Select"), button:has-text("選択")').first();
      await selectBtn.click();

      const svg = page.locator('.paper-boundary svg').last();
      const wallLine = svg.locator('line:not(.selection-highlight):not(.selection-outline):not(.snap-guide)').last();
      await expect(wallLine).toBeAttached();

      const wallBox = await wallLine.boundingBox();
      expect(wallBox).not.toBeNull();

      if (wallBox) {
        const clickX = wallBox.x + wallBox.width / 2;
        const clickY = wallBox.y + wallBox.height / 2;

        await page.mouse.click(clickX, clickY);

        // Verify properties panel layer select is visible and find the active layer name
        const layerSelect = page.locator('span:has-text("Layer"), span:has-text("レイヤー")').locator('..').locator('select').first();
        await expect(layerSelect).toBeVisible();
        const activeLayerId = await layerSelect.inputValue();

        // Lock the layer in the layers panel
        // Find layer item matching activeLayerId or its name, and click its lock button
        const activeLayerNameOption = await layerSelect.locator(`option[value="${activeLayerId}"]`).textContent();
        expect(activeLayerNameOption).not.toBeNull();
        const activeLayerName = activeLayerNameOption?.trim() || '';

        // Find the lock button of this layer in the layers panel
        const layerItem = page.locator(`.layer-item:has-text("${activeLayerName}")`).first();
        await expect(layerItem).toBeVisible();

        const lockBtn = layerItem.locator('button').last(); // The lock button is the last button in the layer item
        await lockBtn.click();
        await page.waitForTimeout(200);

        // Store Y coordinates before attempt
        const origY1 = Number(await wallLine.getAttribute('y1'));

        // Try to drag the wall down by 100px
        await page.mouse.move(clickX, clickY);
        await page.mouse.down();
        await page.mouse.move(clickX, clickY + 100, { steps: 10 });
        await page.mouse.up();

        // Verify coordinates remain unchanged
        const currentY1 = Number(await wallLine.getAttribute('y1'));
        expect(currentY1).toBe(origY1);
      }
    }
  });
});
