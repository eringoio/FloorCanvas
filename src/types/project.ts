export type UnitType = 'mm' | 'cm' | 'm';

export interface ScaleConfig {
  status: 'not_set' | 'calibrated';
  pixelsPerUnit: number; // Conversion factor (e.g. pixels per mm)
  drawingScale: string; // e.g. "1:100"
}

export interface CanvasConfig {
  paperSize: 'A4' | 'A3' | 'custom';
  orientation: 'landscape' | 'portrait';
  width: number; // Width in paper mm
  height: number; // Height in paper mm
  paperUnit: 'mm';
}

export interface GridConfig {
  visible: boolean;
  snap: boolean;
  size: number; // Grid spacing in units (e.g. 500 mm)
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export type ObjectType =
  | 'wall'
  | 'column'
  | 'door'
  | 'window'
  | 'furniture'
  | 'text'
  | 'dimension'
  | 'stair'
  | 'elevator'
  | 'background'
  | 'room'
  | 'shape';

export interface BaseObject {
  id: string;
  type: ObjectType;
  layerId: string;
  visible: boolean;
  locked: boolean;
  rotation: number; // in degrees
  groupId?: string;
  allowStretch?: boolean;
  lockAspectRatio?: boolean;
}

export interface WallObject extends BaseObject {
  type: 'wall';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  style?: string; // e.g., 'exterior', 'interior'
  stroke?: string;
  fill?: string;
  openings?: RoomOpening[];
}

export interface ColumnObject extends BaseObject {
  type: 'column';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  fill?: string;
}

export interface DoorObject extends BaseObject {
  type: 'door';
  x: number;
  y: number;
  width: number;
  hingeSide: 'left' | 'right';
  swingDirection: 'inward' | 'outward';
  openingAngle: number;
  stroke?: string;
}

export interface WindowObject extends BaseObject {
  type: 'window';
  x: number;
  y: number;
  width: number;
  thickness?: number;
  style?: string; // e.g. 'double-line', 'single-line'
}

export interface FurnitureObject extends BaseObject {
  type: 'furniture';
  x: number;
  y: number;
  width: number;
  height: number;
  furnitureType: string; // e.g. 'student_desk', 'chair', 'table'
  stroke?: string;
  fill?: string;

  furnitureSetId?: string;
  furnitureSetRole?: 'anchor' | 'chair';
  attachedToId?: string;
  chairIndex?: number;
  chairSide?: 'front' | 'back' | 'left' | 'right' | 'around';
}

export interface TextObject extends BaseObject {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
  keepUpright?: boolean;
  color?: string;
}

export interface DimensionObject extends BaseObject {
  type: 'dimension';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
  unit: string;
  autoValue?: number;
  displayText?: string;
  textOverride?: boolean;
  labelMode?: 'auto' | 'mm' | 'm' | 'manual';
  style?: string;
  labelFontScale?: number;
}

export interface StairObject extends BaseObject {
  type: 'stair';
  x: number;
  y: number;
  width: number;
  height: number;
  steps?: number;
  direction?: 'up' | 'down';
  stroke?: string;
  fill?: string;
  showDirectionLabel?: boolean;
  showArrow?: boolean;
}

export interface ElevatorObject extends BaseObject {
  type: 'elevator';
  x: number;
  y: number;
  width: number;
  height: number;
  elevatorType?: 'elevator' | 'freight_lift';
  stroke?: string;
  fill?: string;
  label?: string;
  showBadge?: boolean;
  symbolStyle?: 'modern' | 'architectural';
}

export interface BackgroundObject extends BaseObject {
  type: 'background';
  x: number;
  y: number;
  width: number;
  height: number;
  assetPath?: string;
  imageUrl?: string; // runtime/backward compatibility only
  opacity: number;
}

export interface ShapeObject extends BaseObject {
  type: 'shape';
  shapeType: 'line' | 'rect' | 'circle' | 'ellipse' | 'polyline' | 'polygon';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: { x: number; y: number }[];
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
}

export type MapObject =
  | WallObject
  | ColumnObject
  | DoorObject
  | WindowObject
  | FurnitureObject
  | TextObject
  | DimensionObject
  | StairObject
  | ElevatorObject
  | BackgroundObject
  | RoomObject
  | ShapeObject;

export interface RoomWallConfig {
  visible: boolean;
  thickness: number;
  style: 'exterior' | 'interior' | 'guide';
  stroke?: string;
  fill?: string;
}

export interface RoomOpening {
  id: string;
  wall: 'top' | 'right' | 'bottom' | 'left';
  type: 'door' | 'window' | 'opening' | 'opening_window';
  offset: number; // offset from start of wall (clockwise)
  width: number;
  hingeSide?: 'left' | 'right';
  swingDirection?: 'inward' | 'outward';
  openingAngle?: number;
}

export interface RoomObject extends BaseObject {
  type: 'room';
  x: number; // center x of the room in real mm
  y: number; // center y of the room in real mm
  width: number; // width in real mm
  height: number; // height in real mm
  rotation: number;
  name: string;
  areaLabel?: string;
  areaLabelMode?: 'auto' | 'manual';
  showLabel: boolean;
  labelX?: number;
  labelY?: number;
  walls: {
    top: RoomWallConfig;
    right: RoomWallConfig;
    bottom: RoomWallConfig;
    left: RoomWallConfig;
  };
  openings: RoomOpening[];
  fill?: string;
  stroke?: string;
  labelFontScale?: number;
}

export interface Project {
  version: string;
  title: string;
  unit: UnitType;
  scale: ScaleConfig;
  canvas: CanvasConfig;
  grid: GridConfig;
  layers: Layer[];
  objects: MapObject[];
  backgrounds: BackgroundObject[];
  stylePreset?: 'modern-editor' | 'architectural-reference';
}
