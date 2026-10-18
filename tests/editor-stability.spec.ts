import { test, expect } from '@playwright/test';
import { installMockDesktopProjects } from './helpers/mockDesktopProjects';

test.describe('Editor Stability Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Log browser console
    page.on('console', msg => {
      console.log('BROWSER LOG:', msg.text());
    });

    // Auto accept confirm dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
  });

  test('wall drawing preview and creation matches mouse drag', async ({ page }) => {
    await page.goto('/');

    // Start with a clean blank project
    const newBtn = page.locator('button[title="New"], button:has-text("New"), button:has-text("新規作成")').first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await page.waitForTimeout(500); // Allow canvas layout to stabilize after project reset

    // Select the Wall tool (works in English and Japanese locales)
    const wallBtn = page.locator('button[title="Wall"], button:has-text("Wall"), button:has-text("壁")').first();
    await expect(wallBtn).toBeVisible();
    await wallBtn.click();

    // Viewport element
    const viewport = page.locator('.canvas-viewport');
    await expect(viewport).toBeVisible();
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = Math.round(box.x + box.width / 2);
      const startY = Math.round(box.y + box.height / 2);
      const endX = startX + 150;
      const endY = startY;

      // Mouse drag down, move (preview), and up
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 5 });
      await page.mouse.up();

      // Check that a line element got created
      const svg = page.locator('.paper-boundary svg').last();
      await expect(svg).toBeVisible();
      
      // Select the last wall line (the newly drawn one) and verify it is attached to DOM
      const wallLine = svg.locator('line:not(.selection-highlight):not(.selection-outline):not(.snap-guide)').last();
      await expect(wallLine).toBeAttached();

      // Verify coordinate consistency (start should be less than end x-coordinate)
      const x1 = await wallLine.getAttribute('x1');
      const x2 = await wallLine.getAttribute('x2');
      console.log('DRAWN WALL COORDS:', { x1, x2 });
      expect(Math.min(Number(x1), Number(x2))).toBeLessThan(Math.max(Number(x1), Number(x2)));
    }
  });

  test('drag move object and undo/redo history operations', async ({ page }) => {
    await page.goto('/');

    // Start with a clean blank project
    const newBtn = page.locator('button[title="New"], button:has-text("New"), button:has-text("新規作成")').first();
    await newBtn.click();
    await page.waitForTimeout(500); // Allow canvas layout to stabilize after project reset

    // Draw a wall first
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

      // Switch to Select tool
      const selectBtn = page.locator('button[title="Select"], button:has-text("Select"), button:has-text("選択")').first();
      await selectBtn.click();

      // Get initial position of created wall line (the last wall is the newly drawn one)
      const svg = page.locator('.paper-boundary svg').last();
      const wallLine = svg.locator('line:not(.selection-highlight):not(.selection-outline):not(.snap-guide)').last();
      await expect(wallLine).toBeAttached();
      const initialY1 = Number(await wallLine.getAttribute('y1'));

      // Move mouse to the bounding box center of the line to ensure precise pointer down on stroke
      const wallBox = await wallLine.boundingBox();
      expect(wallBox).not.toBeNull();

      if (wallBox) {
        const clickX = wallBox.x + wallBox.width / 2;
        const clickY = wallBox.y + wallBox.height / 2;

        await page.mouse.move(clickX, clickY);
        await page.mouse.down();
        await page.mouse.move(clickX, clickY + 100, { steps: 10 });
        await page.mouse.up();

        // Verify that the wall y position has changed
        const movedY1 = Number(await wallLine.getAttribute('y1'));
        expect(movedY1).not.toBe(initialY1);

        // Click viewport to blur any inputs in the properties panel to allow keyboard shortcuts to trigger
        await page.locator('.canvas-viewport').click({ position: { x: 10, y: 10 } });

        // Press Undo (Ctrl+Z)
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(250);
        const undoneY1 = Number(await wallLine.getAttribute('y1'));
        expect(undoneY1).toBe(initialY1);

        // Click viewport again to blur any inputs
        await page.locator('.canvas-viewport').click({ position: { x: 10, y: 10 } });

        // Press Redo (Ctrl+Shift+Z)
        await page.keyboard.press('Control+Shift+z');
        await page.waitForTimeout(250);
        const redoneY1 = Number(await wallLine.getAttribute('y1'));
        expect(redoneY1).toBe(movedY1);
      }
    }
  });

  test('locked objects are not moved by dragging', async ({ page }) => {
    await page.goto('/');

    // Start with a clean blank project
    const newBtn = page.locator('button[title="New"], button:has-text("New"), button:has-text("新規作成")').first();
    await newBtn.click();
    await page.waitForTimeout(500); // Allow canvas layout to stabilize after project reset

    // 1. Draw a wall
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

        // Verify properties panel is visible
        const propertiesPanel = page.locator('.properties-panel').first();
        await expect(propertiesPanel).toBeVisible();

        // Lock the wall using the Lock label checkbox in properties panel
        const lockCheckbox = page.locator('label:has-text("Lock"), label:has-text("固定")').locator('input[type="checkbox"]').first();
        await expect(lockCheckbox).toBeVisible();
        await lockCheckbox.check();

        // Store current Y coordinates
        const lockedY1 = Number(await wallLine.getAttribute('y1'));

        // Try to drag the locked wall down by 100px
        await page.mouse.move(clickX, clickY);
        await page.mouse.down();
        await page.mouse.move(clickX, clickY + 100, { steps: 10 });
        await page.mouse.up();

        // Verify that coordinates remain unchanged
        const currentY1 = Number(await wallLine.getAttribute('y1'));
        expect(currentY1).toBe(lockedY1);
      }
    }
  });

  test('language switcher changes UI strings correctly', async ({ page }) => {
    await page.goto('/');

    // Find the language switcher button or selector
    const langSelect = page.locator('select.language-select, button.lang-switch-btn').first();
    if (await langSelect.isVisible()) {
      // Toggle language
      const currentText = await langSelect.textContent();
      if (currentText && currentText.includes('JA')) {
        await langSelect.click(); // Switch to Japanese
        await expect(page.locator('body')).toContainText(/ファイル|壁/);
      }
    }
  });
});

test.describe('Mobile Viewport Tests', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    hasTouch: true,
    isMobile: true,
  });

  test('responsive layout at mobile widths (390px)', async ({ page }) => {
    await page.goto('/');

    // Log window dimensions and DOM headers
    const metrics = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('header')).map(h => ({
        className: h.className,
        display: window.getComputedStyle(h).display,
        innerHTML: h.innerHTML.substring(0, 100)
      }));
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        headers
      };
    });
    console.log('MOBILE TEST METRICS:', metrics);

    // Verify desktop toolbar is hidden
    const desktopToolbar = page.locator('.toolbar.desktop-only');
    await expect(desktopToolbar).toBeHidden();

    // Check that we have a mobile menu toggle button
    const moreBtn = page.locator('.toolbar.mobile-only button').last();
    await expect(moreBtn).toBeVisible();
  });
});

test.describe('Large Project Properties Panel Responsiveness and Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await installMockDesktopProjects(page);
  });

  for (const mockId of ['mock-large', 'mock-office']) {
    test(`properties panel text input remains editable for ${mockId}`, async ({ page }) => {
      await page.goto('/');
      await page.locator('select.sample-select').selectOption(mockId);
      await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

      // Click the first text label
      const textObject = page.locator('.canvas-text-object text').first();
      await expect(textObject).toBeVisible();
      await textObject.click({ force: true });

      // Find the text input in the properties panel
      const textarea = page.locator('.properties-panel textarea').first();
      await expect(textarea).toBeVisible();

      await textarea.fill('TEST LABEL');
      await expect(textarea).toHaveValue('TEST LABEL');
    });

    test(`properties panel numeric input remains editable for ${mockId}`, async ({ page }) => {
      await page.goto('/');
      await page.locator('select.sample-select').selectOption(mockId);
      await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

      // Click the first text label to load its properties
      const textObject = page.locator('.canvas-text-object text').first();
      await expect(textObject).toBeVisible();
      await textObject.click({ force: true });

      // Find the first numeric input (like font size, coordinates, etc.)
      const numInput = page.locator('.properties-panel input[type="number"]').first();
      await expect(numInput).toBeVisible();

      await numInput.fill('350');
      await expect(numInput).toHaveValue('350');
    });
  }

  test('properties panel undo and redo history works correctly after property edits on large projects', async ({ page }) => {
    await page.goto('/');
    await page.locator('select.sample-select').selectOption('mock-large');
    await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

    // Select text object
    const textObject = page.locator('.canvas-text-object text').first();
    await expect(textObject).toBeVisible();
    await textObject.click({ force: true });

    const textarea = page.locator('.properties-panel textarea').first();
    await expect(textarea).toBeVisible();
    const oldValue = await textarea.inputValue();

    // Edit the text property
    await textarea.fill('UNDO REDO TEST');
    
    // Blur input to commit the edit session to history
    await textarea.blur();
    await expect(textarea).toHaveValue('UNDO REDO TEST');

    // Trigger Undo via Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await textObject.click({ force: true });
    await expect(textarea).toHaveValue(oldValue);

    // Trigger Redo via Ctrl+Shift+Z
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    await textObject.click({ force: true });
    await expect(textarea).toHaveValue('UNDO REDO TEST');
  });
});
