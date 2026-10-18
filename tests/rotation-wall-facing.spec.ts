import { expect, test } from '@playwright/test';
import { getDragRotation, normalizeDegrees, snapRotation } from '../src/utils/rotationSnap';
import { snapObject } from '../src/utils/snapping';
import type { MapObject } from '../src/types/project';

const unlockedLayers: Record<string, boolean> = {};
const grid = { snap: true, size: 500 };

const wall = (id: string, x1: number, y1: number, x2: number, y2: number): MapObject => ({
  id,
  type: 'wall',
  layerId: 'layer_structural_walls',
  x1,
  y1,
  x2,
  y2,
  thickness: 180,
  rotation: 0,
  visible: true,
  locked: false,
});

const furniture = (furnitureType: string, rotation = 123): MapObject => ({
  id: `f_${furnitureType}`,
  type: 'furniture',
  layerId: 'layer_furniture',
  furnitureType,
  x: 0,
  y: 0,
  width: 400,
  height: 600,
  rotation,
  visible: true,
  locked: false,
});

test.describe('rotation snapping math', () => {
  test('normalizes and snaps drag rotation', () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(snapRotation(3, 10)).toBe(0);
    expect(snapRotation(6, 10)).toBe(10);
    expect(snapRotation(355, 10)).toBe(0);
    expect(getDragRotation(44, true, false)).toBe(40);
    expect(getDragRotation(46, true, false)).toBe(50);
    expect(getDragRotation(44, false, true)).toBe(45);
    expect(getDragRotation(44.4, false, false)).toBe(44);
  });
});

test.describe('wall-facing snap math', () => {
  test('faces away from horizontal walls', () => {
    const objects = [wall('w1', -1000, 0, 1000, 0)];

    const above = snapObject(furniture('chair'), 0, -80, objects, unlockedLayers, grid);
    expect(above.y).toBeLessThan(0);
    expect(above.objectRotation).toBe(0);

    const below = snapObject(furniture('chair'), 0, 80, objects, unlockedLayers, grid);
    expect(below.y).toBeGreaterThan(0);
    expect(below.objectRotation).toBe(180);
  });

  test('faces away from vertical walls', () => {
    const objects = [wall('w1', 0, -1000, 0, 1000)];

    const left = snapObject(furniture('cabinet'), -80, 0, objects, unlockedLayers, grid);
    expect(left.x).toBeLessThan(0);
    expect(left.objectRotation).toBe(270);

    const right = snapObject(furniture('cabinet'), 80, 0, objects, unlockedLayers, grid);
    expect(right.x).toBeGreaterThan(0);
    expect(right.objectRotation).toBe(90);
  });

  test('does not wall-face table objects', () => {
    const objects = [wall('w1', -1000, 0, 1000, 0)];
    const result = snapObject(furniture('table'), 0, -80, objects, unlockedLayers, grid);
    expect(result.objectRotation).toBeUndefined();
    expect(result.y).toBe(0);
  });
});
