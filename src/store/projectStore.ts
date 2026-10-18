import { create } from 'zustand';
import type { 
  Project, 
  Layer, 
  MapObject, 
  UnitType, 
  ScaleConfig, 
  GridConfig, 
  CanvasConfig,
  ShapeObject
} from '../types/project';
import { transformObject } from '../utils/transformObjects';
import { validateProject } from '../utils/projectValidation';

// Default layers requested by prompt
const DEFAULT_LAYERS: Layer[] = [
  { id: 'layer_background', name: 'Background Reference', visible: true, locked: false, order: 1 },
  { id: 'layer_structural_walls', name: 'Structural Walls', visible: true, locked: false, order: 2 },
  { id: 'layer_internal_walls', name: 'Internal Walls', visible: true, locked: false, order: 3 },
  { id: 'layer_doors_windows', name: 'Doors and Windows', visible: true, locked: false, order: 4 },
  { id: 'layer_columns', name: 'Columns', visible: true, locked: false, order: 5 },
  { id: 'layer_circulation', name: 'Circulation', visible: true, locked: false, order: 6 },
  { id: 'layer_furniture', name: 'Furniture', visible: true, locked: false, order: 7 },
  { id: 'layer_labels', name: 'Labels', visible: true, locked: false, order: 8 },
  { id: 'layer_dimensions', name: 'Dimensions', visible: true, locked: false, order: 9 },
  { id: 'layer_notes', name: 'Notes', visible: true, locked: false, order: 10 },
];

const DEFAULT_OBJECTS: MapObject[] = [
  {
    id: 'col_1',
    type: 'column',
    layerId: 'layer_columns',
    x: 2000,
    y: 2000,
    width: 400,
    height: 400,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'col_2',
    type: 'column',
    layerId: 'layer_columns',
    x: 12000,
    y: 2000,
    width: 400,
    height: 400,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'col_3',
    type: 'column',
    layerId: 'layer_columns',
    x: 12000,
    y: 8000,
    width: 400,
    height: 400,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'col_4',
    type: 'column',
    layerId: 'layer_columns',
    x: 2000,
    y: 8000,
    width: 400,
    height: 400,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'wall_1',
    type: 'wall',
    layerId: 'layer_structural_walls',
    x1: 2000,
    y1: 2000,
    x2: 12000,
    y2: 2000,
    thickness: 200,
    rotation: 0,
    visible: true,
    locked: false,
    style: 'exterior',
  },
  {
    id: 'wall_2',
    type: 'wall',
    layerId: 'layer_structural_walls',
    x1: 12000,
    y1: 2000,
    x2: 12000,
    y2: 8000,
    thickness: 200,
    rotation: 0,
    visible: true,
    locked: false,
    style: 'exterior',
  },
  {
    id: 'wall_3',
    type: 'wall',
    layerId: 'layer_structural_walls',
    x1: 12000,
    y1: 8000,
    x2: 2000,
    y2: 8000,
    thickness: 200,
    rotation: 0,
    visible: true,
    locked: false,
    style: 'exterior',
  },
  {
    id: 'wall_4',
    type: 'wall',
    layerId: 'layer_structural_walls',
    x1: 2000,
    y1: 8000,
    x2: 2000,
    y2: 2000,
    thickness: 200,
    rotation: 0,
    visible: true,
    locked: false,
    style: 'exterior',
  },
  {
    id: 'wall_internal_1',
    type: 'wall',
    layerId: 'layer_internal_walls',
    x1: 7000,
    y1: 2000,
    x2: 7000,
    y2: 8000,
    thickness: 120,
    rotation: 0,
    visible: true,
    locked: false,
    style: 'interior',
  },
  {
    id: 'door_1',
    type: 'door',
    layerId: 'layer_doors_windows',
    x: 4000,
    y: 2000,
    width: 900,
    rotation: 0,
    hingeSide: 'left',
    swingDirection: 'inward',
    openingAngle: 90,
    visible: true,
    locked: false,
  },
  {
    id: 'window_1',
    type: 'window',
    layerId: 'layer_doors_windows',
    x: 9500,
    y: 2000,
    width: 1500,
    rotation: 0,
    thickness: 200,
    visible: true,
    locked: false,
  },
  {
    id: 'desk_1',
    type: 'furniture',
    layerId: 'layer_furniture',
    furnitureType: 'table',
    x: 4500,
    y: 4500,
    width: 1400,
    height: 700,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'chair_1',
    type: 'furniture',
    layerId: 'layer_furniture',
    furnitureType: 'chair',
    x: 4500,
    y: 5100,
    width: 500,
    height: 500,
    rotation: 180,
    visible: true,
    locked: false,
  },
  {
    id: 'stair_1',
    type: 'stair',
    layerId: 'layer_circulation',
    x: 10500,
    y: 6500,
    width: 1200,
    height: 2000,
    rotation: 90,
    steps: 10,
    visible: true,
    locked: false,
  },
  {
    id: 'el_1',
    type: 'elevator',
    layerId: 'layer_circulation',
    x: 10500,
    y: 4000,
    width: 1500,
    height: 1500,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'label_1',
    type: 'text',
    layerId: 'layer_labels',
    x: 4500,
    y: 3200,
    text: 'Room 101\n40㎡',
    fontSize: 240,
    fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
    fontWeight: '600',
    align: 'center',
    rotation: 0,
    visible: true,
    locked: false,
    color: '#0f172a',
  },
  {
    id: 'label_2',
    type: 'text',
    layerId: 'layer_labels',
    x: 9500,
    y: 3200,
    text: 'Office\n38㎡',
    fontSize: 240,
    fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
    fontWeight: '600',
    align: 'center',
    rotation: 0,
    visible: true,
    locked: false,
    color: '#0f172a',
  },
  {
    id: 'dim_1',
    type: 'dimension',
    layerId: 'layer_dimensions',
    x1: 2000,
    y1: 2000,
    x2: 12000,
    y2: 2000,
    offset: -800,
    unit: 'mm',
    autoValue: 10000,
    displayText: '10,000',
    textOverride: false,
    rotation: 0,
    visible: true,
    locked: false,
  },
  {
    id: 'room_test_1',
    type: 'room',
    layerId: 'layer_structural_walls',
    visible: true,
    locked: false,
    rotation: 0,
    x: 7000,
    y: 11000,
    width: 6000,
    height: 4000,
    name: '実験室',
    areaLabel: '24.0㎡',
    showLabel: true,
    walls: {
      top: { visible: true, thickness: 180, style: 'exterior' },
      right: { visible: true, thickness: 180, style: 'exterior' },
      bottom: { visible: true, thickness: 180, style: 'exterior' },
      left: { visible: true, thickness: 180, style: 'exterior' },
    },
    openings: [],
  }
];

const createDefaultProject = (title = 'New Floor Plan'): Project => ({
  version: '1.0.0',
  title,
  unit: 'mm',
  scale: {
    status: 'calibrated',
    pixelsPerUnit: 0.025, // default 40mm = 1px representation
    drawingScale: '1:100',
  },
  canvas: {
    paperSize: 'A4',
    orientation: 'landscape',
    width: 297, // paper mm
    height: 210, // paper mm
    paperUnit: 'mm',
  },
  grid: {
    visible: true,
    snap: true,
    size: 500, // 500mm grid lines
  },
  layers: [...DEFAULT_LAYERS],
  objects: [...DEFAULT_OBJECTS],
  backgrounds: [],
});

interface ProjectState {
  project: Project;
  selectedIds: string[];
  past: Project[];
  future: Project[];
  currentProjectHandle: {
    id: string;
    folderPath: string;
    projectPath: string;
    title: string;
    isSample?: boolean;
  } | null;
  isDirty: boolean;
  lastSavedAt?: string;
  setProjectHandle: (handle: any) => void;
  setDirty: (isDirty: boolean) => void;
  
  // History operations
  undo: () => void;
  redo: () => void;
  pushToHistory: () => void;
  
  // Project operations
  createNewProject: (title?: string) => void;
  loadProject: (project: Project) => void;
  importProjectMerge: (importedProject: Project, options: {
    selectedObjectTypes: Record<string, boolean>;
    importBackground: boolean;
    importPageSize: boolean;
    importGeneralSettings: boolean;
  }) => void;
  
  // Object operations
  addObject: (object: MapObject) => void;
  addObjects: (objects: MapObject[]) => void;
  updateObject: (id: string, updates: Partial<MapObject>) => void;
  updateObjectRuntime: (id: string, updates: Partial<MapObject>) => void;
  updateObjectWithHistory: (id: string, updates: Partial<MapObject>) => void;
  deleteObject: (id: string) => void;
  setObjects: (objects: MapObject[]) => void;
  deleteObjects: (ids: string[]) => void;
  updateObjects: (ids: string[], updates: Partial<MapObject>) => void;
  duplicateObjects: (ids: string[]) => void;
  convertWallsToRoom: (wallIds: string[], newRoom: MapObject, deleteOld: boolean) => void;
  explodeRoom: (roomId: string, newWalls: MapObject[]) => void;
  nudgeObjects: (ids: string[], dx: number, dy: number) => void;
  
  // Layer operations
  addLayer: (layer: Layer) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  
  // Settings operations
  setUnit: (unit: UnitType) => void;
  setScale: (scale: Partial<ScaleConfig>) => void;
  setGrid: (grid: Partial<GridConfig>) => void;
  setCanvas: (canvas: Partial<CanvasConfig>) => void;
  setStylePreset: (stylePreset: 'modern-editor' | 'architectural-reference') => void;
  
  // Selection operations
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  selectedRoomSide: { roomId: string; side: 'top' | 'right' | 'bottom' | 'left' } | null;
  setSelectedRoomSide: (side: { roomId: string; side: 'top' | 'right' | 'bottom' | 'left' } | null) => void;

  // Viewport navigation
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetZoomAndPan: () => void;

  // Real-time mouse coordinates
  cursorCoords: { x: number; y: number; inside: boolean };
  setCursorCoords: (coords: { x: number; y: number; inside: boolean }) => void;

  // Viewport center trigger
  viewTrigger: number;
  triggerCenterView: () => void;

  // Scale Calibration operations
  isCalibrating: boolean;
  calibrationPoints: { x: number; y: number }[]; // in paper pixels
  startCalibration: () => void;
  addCalibrationPoint: (point: { x: number; y: number }) => void;
  cancelCalibration: () => void;
  applyCalibration: (distanceInMm: number, target: 'background' | 'project') => void;

  // Drawing tool state
  activeTool: 'select' | 'pan' | 'dimension' | 'wall' | 'rect' | 'room' | 'poly_wall';
  drawingStartPoint: { x: number; y: number } | null; // in real-world mm
  setActiveTool: (tool: 'select' | 'pan' | 'dimension' | 'wall' | 'rect' | 'room' | 'poly_wall') => void;
  setDrawingStartPoint: (pt: { x: number; y: number } | null) => void;
  currentWallConfig: { thickness: number; style: string; layerId: string };
  setCurrentWallConfig: (config: { thickness: number; style: string; layerId: string }) => void;

  snapGuides: any[];
  setSnapGuides: (guides: any[]) => void;

  // Active layer for new objects
  activeLayerId: string;
  setActiveLayerId: (id: string) => void;

  // Clipboard operations
  clipboard: {
    objects: MapObject[];
    pasteCount: number;
  } | null;
  copySelectedObjects: () => void;
  pasteClipboard: () => void;
  cutSelectedObjects: () => void;

  // Free Stretch & Group Transforms
  freeStretch: boolean;
  setFreeStretch: (val: boolean) => void;
  transformObjects: (ids: string[], transform: any) => void;
  transformObjectsWithHistory: (ids: string[], transform: any) => void;
  transformSessionObjects: MapObject[] | null;
  beginTransformSession: () => void;
  updateTransformSession: (ids: string[], transform: any) => void;
  endTransformSession: () => void;
}

const backgroundImageCache = new Map<string, string>();

const cloneForHistory = (project: Project): Project => {
  const savedUrls = new Map<string, string>();
  if (project.objects) {
    project.objects.forEach((obj) => {
      if (obj.type === 'background' && (obj as any).imageUrl) {
        savedUrls.set(obj.id, (obj as any).imageUrl);
        backgroundImageCache.set(obj.id, (obj as any).imageUrl);
        (obj as any).imageUrl = '';
      }
    });
  }
  
  const clone = JSON.parse(JSON.stringify(project)) as Project;
  
  if (project.objects) {
    project.objects.forEach((obj) => {
      if (obj.type === 'background') {
        const url = savedUrls.get(obj.id);
        if (url) {
          (obj as any).imageUrl = url;
        }
      }
    });
  }
  
  return clone;
};

const restoreFromHistory = (project: Project): Project => {
  if (project.objects) {
    project.objects.forEach((obj) => {
      if (obj.type === 'background') {
        const cached = backgroundImageCache.get(obj.id);
        if (cached) {
          (obj as any).imageUrl = cached;
        }
      }
    });
  }
  return project;
};

export const useProjectStore = create<ProjectState>((rawSet) => {
  const set = (
    partial: | ProjectState
             | Partial<ProjectState>
             | ((state: ProjectState) => ProjectState | Partial<ProjectState>),
    replace?: boolean
  ) => {
    (rawSet as any)((state: any) => {
      const nextState = typeof partial === 'function' ? (partial as any)(state) : { ...partial };
      if (nextState.project !== undefined && nextState.isDirty === undefined) {
        nextState.isDirty = true;
      }
      return nextState;
    }, replace);
  };

  return {
    project: createDefaultProject(),
  selectedIds: [],
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  cursorCoords: { x: 0, y: 0, inside: true },
  past: [],
  future: [],
  currentProjectHandle: null,
  isDirty: false,
  lastSavedAt: undefined,
  setProjectHandle: (currentProjectHandle) => set({ currentProjectHandle }),
  setDirty: (isDirty) => set({ isDirty }),
  activeLayerId: 'auto',
  setActiveLayerId: (activeLayerId) => set({ activeLayerId }),
  clipboard: null,
  freeStretch: false,
  setFreeStretch: (freeStretch) => set({ freeStretch }),
  selectedRoomSide: null,
  setSelectedRoomSide: (selectedRoomSide) => set({ selectedRoomSide }),

  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  resetZoomAndPan: () => set({ zoom: 1.0, pan: { x: 0, y: 0 } }),
  setCursorCoords: (cursorCoords) => set({ cursorCoords }),
  viewTrigger: 0,
  triggerCenterView: () => set((state) => ({ viewTrigger: state.viewTrigger + 1 })),

  isCalibrating: false,
  calibrationPoints: [],

  startCalibration: () => set({ isCalibrating: true, calibrationPoints: [], selectedIds: [] }),
  
  addCalibrationPoint: (pt) => set((state) => ({ 
    calibrationPoints: [...state.calibrationPoints, pt] 
  })),
  
  cancelCalibration: () => set({ isCalibrating: false, calibrationPoints: [] }),
  
  applyCalibration: (distanceInMm, target) => set((state) => {
    if (state.calibrationPoints.length < 2) return {};
    const [p1, p2] = state.calibrationPoints;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dPx = Math.sqrt(dx * dx + dy * dy);
    
    if (dPx === 0 || distanceInMm <= 0) return {};
    
    const currentProject = cloneForHistory(state.project);
    
    if (target === 'background') {
      const bgObjIdx = state.project.objects.findIndex(o => o.type === 'background');
      if (bgObjIdx !== -1) {
        const bgObj = state.project.objects[bgObjIdx] as any;
        const currentDistanceMm = dPx / state.project.scale.pixelsPerUnit;
        const factor = distanceInMm / currentDistanceMm;
        
        // Midpoint in paper pixels, then to world coords
        const midPxX = (p1.x + p2.x) / 2;
        const midPxY = (p1.y + p2.y) / 2;
        const midWorldX = midPxX / state.project.scale.pixelsPerUnit;
        const midWorldY = midPxY / state.project.scale.pixelsPerUnit;
        
        const newX = midWorldX + (bgObj.x - midWorldX) * factor;
        const newY = midWorldY + (bgObj.y - midWorldY) * factor;
        const newW = bgObj.width * factor;
        const newH = bgObj.height * factor;
        
        const updatedObjects = [...state.project.objects];
        updatedObjects[bgObjIdx] = {
          ...bgObj,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        };
        
        return {
          past: [...state.past, currentProject].slice(-50),
          future: [],
          project: {
            ...state.project,
            objects: updatedObjects
          },
          isCalibrating: false,
          calibrationPoints: []
        };
      }
    }
    
    const newPixelsPerUnit = dPx / distanceInMm;
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        scale: {
          status: 'calibrated',
          pixelsPerUnit: newPixelsPerUnit,
          drawingScale: `Calibrated`,
        }
      },
      isCalibrating: false,
      calibrationPoints: []
    };
  }),

  activeTool: 'select',
  drawingStartPoint: null,
  currentWallConfig: { thickness: 180, style: 'exterior', layerId: 'layer_structural_walls' },
  setActiveTool: (activeTool) => set({ activeTool, drawingStartPoint: null }),
  setDrawingStartPoint: (drawingStartPoint) => set({ drawingStartPoint }),
  setCurrentWallConfig: (currentWallConfig) => set({ currentWallConfig }),

  snapGuides: [],
  setSnapGuides: (snapGuides) => set({ snapGuides }),

  pushToHistory: () => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      isDirty: true
    };
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return {};
    const previous = restoreFromHistory(state.past[state.past.length - 1]);
    const newPast = state.past.slice(0, state.past.length - 1);
    const currentProject = cloneForHistory(state.project);
    return {
      past: newPast,
      project: previous,
      future: [currentProject, ...state.future],
      selectedIds: [],
      isDirty: true
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return {};
    const next = restoreFromHistory(state.future[0]);
    const newFuture = state.future.slice(1);
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject],
      project: next,
      future: newFuture,
      selectedIds: [],
      isDirty: true
    };
  }),

  createNewProject: (title) => set({ 
    project: createDefaultProject(title),
    selectedIds: [],
    activeTool: 'select',
    drawingStartPoint: null,
    currentWallConfig: { thickness: 180, style: 'exterior', layerId: 'layer_structural_walls' },
    past: [],
    future: [],
    currentProjectHandle: null,
    isDirty: false,
    lastSavedAt: undefined
  }),

  loadProject: (project) => set(() => {
    let updatedObjects = [...project.objects];
    if (project.backgrounds && project.backgrounds.length > 0) {
      project.backgrounds.forEach((bg) => {
        const alreadyExists = updatedObjects.some(
          (obj) => obj.type === 'background' && (obj as any).imageUrl === bg.imageUrl
        );
        if (!alreadyExists) {
          updatedObjects.push({
            ...bg,
            type: 'background',
            layerId: bg.layerId || 'layer_background',
          } as MapObject);
        }
      });
    }

    updatedObjects.forEach((obj) => {
      if (obj.type === 'background' && (obj as any).imageUrl) {
        backgroundImageCache.set(obj.id, (obj as any).imageUrl);
      }
    });

    return {
      project: {
        ...project,
        objects: updatedObjects,
        backgrounds: [],
      },
      selectedIds: [],
      past: [],
      future: [],
      isDirty: false
    };
  }),

  importProjectMerge: (importedProject, options) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    let importedObjs: MapObject[] = [];
    
    // 1. Gather all objects to import
    let rawImportedObjs = [...importedProject.objects];
    if (options.importBackground && importedProject.backgrounds && importedProject.backgrounds.length > 0) {
      importedProject.backgrounds.forEach((bg) => {
        const alreadyExists = rawImportedObjs.some(
          (obj) => obj.type === 'background' && (obj as any).imageUrl === bg.imageUrl
        );
        if (!alreadyExists) {
          rawImportedObjs.push({
            ...bg,
            type: 'background',
            layerId: bg.layerId || 'layer_background',
          } as MapObject);
        }
      });
    }

    // Filter objects by type
    rawImportedObjs.forEach((obj) => {
      if (obj.type === 'background') {
        if (options.importBackground) {
          importedObjs.push(obj);
        }
      } else {
        if (options.selectedObjectTypes[obj.type]) {
          importedObjs.push(obj);
        }
      }
    });

    // 2. Assign unique IDs to avoid collision
    const timestamp = Date.now();
    const newImportedObjs = importedObjs.map((obj, i) => {
      const newId = `${obj.type}_imported_${timestamp}_${i}_${Math.random().toString(36).substr(2, 5)}`;
      return {
        ...obj,
        id: newId
      } as MapObject;
    });

    newImportedObjs.forEach((obj) => {
      if (obj.type === 'background' && (obj as any).imageUrl) {
        backgroundImageCache.set(obj.id, (obj as any).imageUrl);
      }
    });

    // 3. Handle layers
    let finalLayers = [...state.project.layers];
    if (options.importGeneralSettings && importedProject.layers) {
      finalLayers = importedProject.layers;
    } else {
      if (importedProject.layers) {
        importedProject.layers.forEach((l) => {
          if (!finalLayers.some((existing) => existing.id === l.id)) {
            finalLayers.push(l);
          }
        });
      }
    }

    // 4. Handle canvas
    const finalCanvas = options.importPageSize ? importedProject.canvas : state.project.canvas;

    // 5. Handle scale and grid
    const finalScale = options.importGeneralSettings ? importedProject.scale : state.project.scale;
    const finalGrid = options.importGeneralSettings ? importedProject.grid : state.project.grid;

    const mergedObjects = [...state.project.objects, ...newImportedObjs];
    const newSelectedIds = newImportedObjs.map((obj) => obj.id);

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        canvas: finalCanvas,
        scale: finalScale,
        grid: finalGrid,
        layers: finalLayers,
        objects: mergedObjects,
        backgrounds: []
      },
      selectedIds: newSelectedIds,
      activeTool: 'select'
    };
  }),

  addObject: (object) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: [...state.project.objects, object]
      }
    };
  }),

  addObjects: (objects) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: [...state.project.objects, ...objects]
      }
    };
  }),

  updateObject: (id, updates) => set((state) => ({
    project: {
      ...state.project,
      objects: state.project.objects.map((obj) =>
        obj.id === id ? ({ ...obj, ...updates } as MapObject) : obj
      )
    },
    isDirty: true
  })),

  updateObjectRuntime: (id, updates) => set((state) => ({
    project: {
      ...state.project,
      objects: state.project.objects.map((obj) =>
        obj.id === id ? ({ ...obj, ...updates } as MapObject) : obj
      )
    },
    isDirty: state.isDirty
  })),

  updateObjectWithHistory: (id, updates) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: state.project.objects.map((obj) => 
          obj.id === id ? ({ ...obj, ...updates } as MapObject) : obj
        )
      }
    };
  }),

  deleteObject: (id) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      selectedIds: state.selectedIds.filter((selId) => selId !== id),
      project: {
        ...state.project,
        objects: state.project.objects.filter((obj) => obj.id !== id)
      }
    };
  }),

  setObjects: (objects) => set((state) => ({
    project: {
      ...state.project,
      objects
    },
    isDirty: true
  })),

  deleteObjects: (ids) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    
    // Build a map of locked layers
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const objectsToDelete = state.project.objects.filter((obj) => {
      if (!ids.includes(obj.id)) return false;
      // Do not delete locked objects or objects on locked layers
      if (obj.locked || (obj.layerId && layerLockedMap[obj.layerId])) return false;
      return true;
    });
    
    const idsToDelete = objectsToDelete.map(o => o.id);

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      selectedIds: state.selectedIds.filter((selId) => !idsToDelete.includes(selId)),
      project: {
        ...state.project,
        objects: state.project.objects.filter((obj) => !idsToDelete.includes(obj.id))
      }
    };
  }),

  updateObjects: (ids, updates) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    
    // Build a map of locked layers
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const updatedObjects = state.project.objects.map((obj) => {
      if (!ids.includes(obj.id)) return obj;
      // Do not update locked objects or objects on locked layers, unless we are updating lock status
      if (updates.locked === undefined && (obj.locked || (obj.layerId && layerLockedMap[obj.layerId]))) {
        return obj;
      }
      return { ...obj, ...updates } as MapObject;
    });

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: updatedObjects
      }
    };
  }),

  duplicateObjects: (ids) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const objectsToDuplicate = state.project.objects.filter(obj => 
      ids.includes(obj.id) && !obj.locked && !(obj.layerId && layerLockedMap[obj.layerId])
    );
    if (objectsToDuplicate.length === 0) return {};

    const offsetVal = 500;
    const timestamp = Date.now();
    
    const duplicated = objectsToDuplicate.map((obj, index) => {
      const newId = `${obj.type}_${timestamp}_${index}`;
      
      const clonedOpenings = (obj as any).openings 
        ? (obj as any).openings.map((op: any) => ({
            ...op,
            id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          }))
        : undefined;

      if (obj.type === 'shape') {
        const sh = obj as ShapeObject;
        if (sh.x !== undefined && sh.y !== undefined) {
          return {
            ...sh,
            id: newId,
            x: sh.x + offsetVal,
            y: sh.y + offsetVal,
            locked: false,
            ...(clonedOpenings ? { openings: clonedOpenings } : {}),
          } as MapObject;
        } else if (sh.points) {
          return {
            ...sh,
            id: newId,
            points: sh.points.map((p: { x: number; y: number }) => ({ x: p.x + offsetVal, y: p.y + offsetVal })),
            locked: false,
            ...(clonedOpenings ? { openings: clonedOpenings } : {}),
          } as MapObject;
        }
        return { 
          ...sh, 
          id: newId, 
          locked: false,
          ...(clonedOpenings ? { openings: clonedOpenings } : {}),
        } as MapObject;
      }

      if ('x' in obj && (obj as any).x !== undefined) {
        return {
          ...obj,
          id: newId,
          x: (obj as any).x + offsetVal,
          y: (obj as any).y + offsetVal,
          locked: false,
          ...(clonedOpenings ? { openings: clonedOpenings } : {}),
        } as MapObject;
      } else if ('x1' in obj) {
        const lineObj = obj as any;
        return {
          ...obj,
          id: newId,
          x1: lineObj.x1 + offsetVal,
          y1: lineObj.y1 + offsetVal,
          x2: lineObj.x2 + offsetVal,
          y2: lineObj.y2 + offsetVal,
          locked: false,
          ...(clonedOpenings ? { openings: clonedOpenings } : {}),
        } as MapObject;
      }
      return { 
        ...obj, 
        id: newId, 
        locked: false,
        ...(clonedOpenings ? { openings: clonedOpenings } : {}),
      } as MapObject;
    });

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: [...state.project.objects, ...duplicated]
      },
      selectedIds: duplicated.map(o => o.id)
    };
  }),

  convertWallsToRoom: (wallIds, newRoom, deleteOld) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    
    let updatedObjects = state.project.objects;
    if (deleteOld) {
      const layerLockedMap: Record<string, boolean> = {};
      state.project.layers.forEach((l) => {
        layerLockedMap[l.id] = l.locked;
      });
      updatedObjects = updatedObjects.filter(
        (o) => !(wallIds.includes(o.id) && !o.locked && !(o.layerId && layerLockedMap[o.layerId]))
      );
    }
    
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: [...updatedObjects, newRoom]
      },
      selectedIds: [newRoom.id]
    };
  }),

  explodeRoom: (roomId, newWalls) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });
    
    const room = state.project.objects.find(o => o.id === roomId);
    let updatedObjects = state.project.objects;
    if (room && !room.locked && !(room.layerId && layerLockedMap[room.layerId])) {
      updatedObjects = updatedObjects.filter(o => o.id !== roomId);
    }
    
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: [...updatedObjects, ...newWalls]
      },
      selectedIds: newWalls.map(o => o.id)
    };
  }),

  copySelectedObjects: () => set((state) => {
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const selected = state.project.objects.filter(obj => 
      state.selectedIds.includes(obj.id) && !obj.locked && !(obj.layerId && layerLockedMap[obj.layerId])
    );
    if (selected.length === 0) return {};

    try {
      const payload = JSON.stringify(selected, null, 2);
      navigator.clipboard.writeText(payload).catch(() => {});
    } catch (_) {}

    return {
      clipboard: {
        objects: JSON.parse(JSON.stringify(selected)),
        pasteCount: 0
      }
    };
  }),

  cutSelectedObjects: () => set((state) => {
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const selected = state.project.objects.filter(obj => 
      state.selectedIds.includes(obj.id) && !obj.locked && !(obj.layerId && layerLockedMap[obj.layerId])
    );
    if (selected.length === 0) return {};

    try {
      const payload = JSON.stringify(selected, null, 2);
      navigator.clipboard.writeText(payload).catch(() => {});
    } catch (_) {}

    const currentProject = cloneForHistory(state.project);
    const selectedIdsToCut = selected.map(o => o.id);
    const remainingObjects = state.project.objects.filter(obj => !selectedIdsToCut.includes(obj.id));

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: remainingObjects
      },
      selectedIds: [],
      clipboard: {
        objects: JSON.parse(JSON.stringify(selected)),
        pasteCount: 0
      }
    };
  }),

  pasteClipboard: () => set((state) => {
    if (!state.clipboard) return {};
    
    const currentProject = cloneForHistory(state.project);
    const { objects: copiedObjects, pasteCount } = state.clipboard;
    
    const offsetVal = 500 * (pasteCount + 1);
    const timestamp = Date.now();
    
    const layerIds = state.project.layers.map(l => l.id);
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });
    const defaultLayerId = state.project.layers[0]?.id || '';
    
    const pasted = copiedObjects.map((obj, index) => {
      const newId = `${obj.type}_${timestamp}_paste_${index}`;
      
      let destLayerId = obj.layerId;
      if (!destLayerId || !layerIds.includes(destLayerId) || layerLockedMap[destLayerId]) {
        if (state.activeLayerId && state.activeLayerId !== 'auto' && !layerLockedMap[state.activeLayerId]) {
          destLayerId = state.activeLayerId;
        } else {
          const firstUnlocked = state.project.layers.find(l => !l.locked && l.visible);
          destLayerId = firstUnlocked ? firstUnlocked.id : defaultLayerId;
        }
      }

      let newObj = JSON.parse(JSON.stringify(obj)) as any;
      newObj.id = newId;
      newObj.layerId = destLayerId;
      newObj.locked = false;

      if (newObj.type === 'shape') {
        if (newObj.x !== undefined && newObj.y !== undefined) {
          newObj.x += offsetVal;
          newObj.y += offsetVal;
        } else if (newObj.points) {
          newObj.points = newObj.points.map((p: { x: number; y: number }) => ({ x: p.x + offsetVal, y: p.y + offsetVal }));
        }
      } else if ('x' in newObj && newObj.x !== undefined) {
        newObj.x += offsetVal;
        newObj.y += offsetVal;
      } else if ('x1' in newObj) {
        newObj.x1 += offsetVal;
        newObj.y1 += offsetVal;
        newObj.x2 += offsetVal;
        newObj.y2 += offsetVal;
      }
      
      return newObj as MapObject;
    });

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: [...state.project.objects, ...pasted]
      },
      selectedIds: pasted.map(o => o.id),
      clipboard: {
        ...state.clipboard,
        pasteCount: pasteCount + 1
      }
    };
  }),

  transformObjects: (ids, transform) => set((state) => {
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const updatedObjects = state.project.objects.map((obj) => {
      if (!ids.includes(obj.id)) return obj;
      if (obj.locked || (obj.layerId && layerLockedMap[obj.layerId])) return obj;
      
      return transformObject(obj, transform);
    });

    return {
      project: {
        ...state.project,
        objects: updatedObjects
      }
    };
  }),

  transformObjectsWithHistory: (ids, transform) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const updatedObjects = state.project.objects.map((obj) => {
      if (!ids.includes(obj.id)) return obj;
      if (obj.locked || (obj.layerId && layerLockedMap[obj.layerId])) return obj;
      
      return transformObject(obj, transform);
    });

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: updatedObjects
      }
    };
  }),

  transformSessionObjects: null,

  beginTransformSession: () => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      transformSessionObjects: JSON.parse(JSON.stringify(state.project.objects)),
      past: [...state.past, currentProject].slice(-50),
      future: [],
    };
  }),

  updateTransformSession: (ids, transform) => set((state) => {
    if (!state.transformSessionObjects) return {};

    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const updatedObjects = state.project.objects.map((obj) => {
      if (!ids.includes(obj.id)) return obj;
      if (obj.locked || (obj.layerId && layerLockedMap[obj.layerId])) return obj;

      const initialObj = state.transformSessionObjects?.find((o) => o.id === obj.id);
      if (!initialObj) return obj;

      return transformObject(initialObj, transform);
    });

    return {
      project: {
        ...state.project,
        objects: updatedObjects
      }
    };
  }),

  endTransformSession: () => set({ transformSessionObjects: null }),

  nudgeObjects: (ids, dx, dy) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    
    const layerLockedMap: Record<string, boolean> = {};
    state.project.layers.forEach((l) => {
      layerLockedMap[l.id] = l.locked;
    });

    const updatedObjects = state.project.objects.map((obj) => {
      if (!ids.includes(obj.id)) return obj;
      if (obj.locked || (obj.layerId && layerLockedMap[obj.layerId])) return obj;
      
      if (obj.type === 'shape') {
        const sh = obj as ShapeObject;
        if (sh.x !== undefined && sh.y !== undefined) {
          return { ...sh, x: sh.x + dx, y: sh.y + dy } as MapObject;
        } else if (sh.points) {
          return { ...sh, points: sh.points.map((p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy })) } as MapObject;
        }
        return sh;
      }

      if ('x' in obj && (obj as any).x !== undefined) {
        return { ...obj, x: (obj as any).x + dx, y: (obj as any).y + dy } as MapObject;
      } else if ('x1' in obj) {
        const lineObj = obj as any;
        return { ...obj, x1: lineObj.x1 + dx, y1: lineObj.y1 + dy, x2: lineObj.x2 + dx, y2: lineObj.y2 + dy } as MapObject;
      }
      return obj;
    });

    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        objects: updatedObjects
      }
    };
  }),

  addLayer: (layer) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        layers: [...state.project.layers, layer].sort((a, b) => a.order - b.order)
      }
    };
  }),

  updateLayer: (id, updates) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        layers: state.project.layers.map((layer) => 
          layer.id === id ? { ...layer, ...updates } : layer
        )
      }
    };
  }),

  deleteLayer: (id) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        layers: state.project.layers.filter((layer) => layer.id !== id)
      }
    };
  }),

  moveLayer: (id, direction) => set((state) => {
    // Clone and sort the layers list to determine visual order
    const layers = [...state.project.layers].sort((a, b) => a.order - b.order);
    const idx = layers.findIndex(l => l.id === id);
    if (idx === -1) return {};

    // Determine swap index
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return {};

    // Swap the order values of idx and targetIdx
    const tempOrder = layers[idx].order;
    layers[idx].order = layers[targetIdx].order;
    layers[targetIdx].order = tempOrder;

    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        layers: [...layers].sort((a, b) => a.order - b.order)
      }
    };
  }),

  setUnit: (unit) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        unit
      }
    };
  }),

  setScale: (scaleUpdates) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        scale: {
          ...state.project.scale,
          ...scaleUpdates
        }
      }
    };
  }),

  setGrid: (gridUpdates) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        grid: {
          ...state.project.grid,
          ...gridUpdates
        }
      }
    };
  }),

  setCanvas: (canvasUpdates) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        canvas: {
          ...state.project.canvas,
          ...canvasUpdates
        }
      }
    };
  }),

  setStylePreset: (stylePreset) => set((state) => {
    const currentProject = cloneForHistory(state.project);
    return {
      past: [...state.past, currentProject].slice(-50),
      future: [],
      project: {
        ...state.project,
        stylePreset
      }
    };
  }),

  setSelectedIds: (ids) => set({ selectedIds: ids, selectedRoomSide: null }),
  
  clearSelection: () => set({ selectedIds: [], selectedRoomSide: null }),
};
});

if (typeof window !== 'undefined') {
  (window as any).__store = useProjectStore;
  (window as any).__projectValidation = { validateProject };
}

