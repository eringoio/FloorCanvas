import type { Page } from '@playwright/test';
import type { Project, MapObject } from '../../src/types/project';

/**
 * In-memory mock of the desktop (Electron) project bridge for Playwright tests.
 * Uses fully synthetic fixture projects only — no private/derived sample data.
 */

const uid = (prefix: string, n: number) => `${prefix}_mock_${n}`;

function room(id: string, x: number, y: number, w: number, h: number, name: string, fill: string, stroke: string): MapObject {
  return {
    id,
    type: 'room',
    layerId: 'layer_structural_walls',
    visible: true,
    locked: false,
    rotation: 0,
    x,
    y,
    width: w,
    height: h,
    name,
    areaLabel: `${Math.round((w * h) / 10000)}㎡`,
    showLabel: true,
    walls: {
      top: { visible: true, thickness: 200, style: 'exterior' },
      right: { visible: true, thickness: 120, style: 'interior' },
      bottom: { visible: true, thickness: 180, style: 'interior' },
      left: { visible: true, thickness: 120, style: 'interior' },
    },
    openings: [
      { id: `${id}_door`, wall: 'bottom' as const, type: 'door' as const, offset: 1200, width: 900, hingeSide: 'left' as const, swingDirection: 'inward' as const, openingAngle: 90 },
    ],
    fill,
    stroke,
  } as unknown as MapObject;
}

function textLabel(id: string, x: number, y: number, text: string, fontSize = 240): MapObject {
  return {
    id,
    type: 'text',
    layerId: 'layer_labels',
    x,
    y,
    text,
    fontSize,
    fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
    fontWeight: '600',
    align: 'center',
    rotation: 0,
    keepUpright: true,
    visible: true,
    locked: false,
    color: '#0f172a',
  } as unknown as MapObject;
}

const MOCK_FIXTURE_PROJECTS: Record<string, Project> = {
  'mock-office': {
    version: '1.0.0',
    title: 'Mock Floor Plan',
    unit: 'mm',
    scale: { status: 'calibrated', pixelsPerUnit: 0.025, drawingScale: '1:100' },
    canvas: { paperSize: 'A4', orientation: 'landscape', width: 297, height: 210, paperUnit: 'mm' },
    grid: { visible: true, snap: true, size: 500 },
    layers: [
      { id: 'layer_structural_walls', name: 'Structural Walls', visible: true, locked: false, order: 2 },
      { id: 'layer_furniture', name: 'Furniture', visible: true, locked: false, order: 7 },
      { id: 'layer_labels', name: 'Labels', visible: true, locked: false, order: 8 },
      { id: 'layer_dimensions', name: 'Dimensions', visible: true, locked: false, order: 9 },
    ],
    backgrounds: [],
    objects: [
      // Standalone exterior walls (render as .canvas-wall-object for wall-selection tests)
      {
        id: 'mock_wall_top',
        type: 'wall',
        layerId: 'layer_structural_walls',
        x1: 2000, y1: 2000, x2: 5000, y2: 2000,
        thickness: 200,
        rotation: 0,
        visible: true,
        locked: false,
        style: 'exterior',
      } as unknown as MapObject,
      room('mock_room_a', 2000, 2000, 8000, 6000, 'Room A', 'rgba(59, 130, 246, 0.05)', '#3b82f6'),
      room('mock_room_b', 11000, 2000, 6000, 6000, 'Room B', 'rgba(16, 185, 129, 0.05)', '#10b981'),
      textLabel('mock_label_a', 6000, 5000, 'Room A'),
      textLabel('mock_label_b', 14000, 5000, 'Room B'),
      {
        id: uid('dim', 1),
        type: 'dimension',
        layerId: 'layer_dimensions',
        x1: 2000, y1: 1000, x2: 17000, y2: 1000,
        offset: -800, unit: 'mm', autoValue: 15000, rotation: 0,
        visible: true, locked: false,
      } as unknown as MapObject,
    ],
  },
  'mock-large': {
    version: '1.0.0',
    title: 'Mock Large Plan',
    unit: 'mm',
    scale: { status: 'calibrated', pixelsPerUnit: 0.025, drawingScale: '1:100' },
    canvas: { paperSize: 'A3', orientation: 'landscape', width: 420, height: 297, paperUnit: 'mm' },
    grid: { visible: true, snap: true, size: 500 },
    layers: [
      { id: 'layer_structural_walls', name: 'Structural Walls', visible: true, locked: false, order: 2 },
      { id: 'layer_furniture', name: 'Furniture', visible: true, locked: false, order: 7 },
      { id: 'layer_labels', name: 'Labels', visible: true, locked: false, order: 8 },
    ],
    backgrounds: [],
    objects: (() => {
      const objects: MapObject[] = [];
      const names = ['Room A', 'Room B', 'Room C', 'Room D', 'Room E', 'Room F'];
      const palette = [
        ['rgba(59, 130, 246, 0.05)', '#3b82f6'],
        ['rgba(16, 185, 129, 0.05)', '#10b981'],
        ['rgba(245, 158, 11, 0.05)', '#f59e0b'],
        ['rgba(139, 92, 246, 0.05)', '#8b5cf6'],
      ];
      let index = 0;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const x = 2000 + col * 9000;
          const y = 2000 + row * 7000;
          const [fill, stroke] = palette[index % palette.length];
          const name = names[index % names.length];
          objects.push(room(`mock_large_room_${index}`, x, y, 8000, 6000, name, fill, stroke));
          objects.push(textLabel(`mock_large_label_${index}`, x + 4000, y + 3000, `${name}\n48㎡`));
          index++;
        }
      }
      return objects;
    })(),
  },
};

const MOCK_PROJECT_IDS = Object.keys(MOCK_FIXTURE_PROJECTS);

export { MOCK_FIXTURE_PROJECTS, MOCK_PROJECT_IDS };

export async function installMockDesktopProjects(page: Page) {
  await page.exposeFunction('readMockProject', async (projectId: string) => {
    const project = MOCK_FIXTURE_PROJECTS[projectId];
    if (!project) throw new Error(`Unknown mock project: ${projectId}`);
    return JSON.parse(JSON.stringify(project));
  });

  await page.addInitScript((ids) => {
    (window as any).floorcanvasDesktop = {
      listProjects: async () => Promise.all(ids.map(async (id: string) => {
        const projectData = await (window as any).readMockProject(id);
        return {
          id,
          title: projectData.title || id,
          folderName: id,
          projectPath: `/projects/${id}/project.floormap.json`,
          isSample: false,
          modifiedAt: new Date().toISOString(),
        };
      })),
      openProject: async (idOrPath: string) => {
        const projectId = idOrPath.split('/').pop() || idOrPath;
        const projectData = await (window as any).readMockProject(projectId);
        return {
          handle: {
            id: projectId,
            folderPath: `/projects/${projectId}`,
            projectPath: `/projects/${projectId}/project.floormap.json`,
            title: projectData.title || projectId,
            isSample: false,
          },
          data: projectData,
        };
      },
      saveProject: async (handle: any) => handle,
      saveProjectAs: async (_projectData: any, suggestedName: string) => ({
        id: suggestedName,
        folderPath: `/projects/${suggestedName}`,
        projectPath: `/projects/${suggestedName}/project.floormap.json`,
        title: suggestedName,
        isSample: false,
      }),
      resolveAssetUrl: async () => '',
    };
  }, [...MOCK_PROJECT_IDS]);
}
