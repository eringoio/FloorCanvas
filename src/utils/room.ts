import type { RoomObject, RoomWallConfig } from '../types/project';

export interface CreateRoomParams {
  id: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  name?: string;
  showLabel?: boolean;
  thickness?: number;
  style?: 'exterior' | 'interior' | 'guide';
}

/**
 * Creates a default RoomObject with standard settings, visible walls, and estimated area label.
 */
export const createRoomObject = (params: CreateRoomParams): RoomObject => {
  const rotation = params.rotation ?? 0;
  const name = params.name ?? 'Room';
  const showLabel = params.showLabel ?? true;
  const thickness = params.thickness ?? 180;
  const style = params.style ?? 'exterior';

  const defaultWall = (): RoomWallConfig => ({
    visible: true,
    thickness,
    style,
  });

  // Calculate approximate area in square meters (width * height in mm / 1,000,000)
  const areaSqM = (params.width * params.height) / 1000000;
  const areaLabel = `${areaSqM.toFixed(1)}㎡`;

  return {
    id: params.id,
    type: 'room',
    layerId: params.layerId,
    visible: true,
    locked: false,
    rotation,
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    name,
    areaLabel,
    areaLabelMode: 'auto',
    showLabel,
    walls: {
      top: defaultWall(),
      right: defaultWall(),
      bottom: defaultWall(),
      left: defaultWall(),
    },
    openings: [],
  };
};
