import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { MapObject, ObjectType } from '../types/project';
import { getRealPaperSize } from '../utils/scale';
import * as Icons from '../ui/icons/Icons';
import { useI18n } from '../i18n';
import { ClassroomArrayIcon, PlanSymbolIcon } from '../symbols/PlanSymbol';
import { getPlanSymbolMetadata, isPlanSymbolId } from '../symbols/symbolMetadata';
import { createDeskChairSet, type ChairSide } from '../utils/furnitureSets';

const getPartIcon = (id: string) => {
  if (id === 'classroom_array') {
    return <ClassroomArrayIcon size={28} />;
  }

  if (isPlanSymbolId(id)) {
    return <PlanSymbolIcon symbolId={id} size={28} />;
  }

  switch (id) {
    case 'wall':
      return <Icons.StraightWallIcon size={22} />;
    case 'thick_wall':
      return <Icons.ExteriorWallIcon size={22} />;
    case 'thin_wall':
      return <Icons.InteriorWallIcon size={22} />;
    case 'wall_rect':
      return <Icons.RectangularWallsIcon size={22} />;
    case 'column':
      return <Icons.ColumnIcon size={22} />;
    case 'window':
      return <Icons.ArchitecturalWindowIcon size={22} />;
    case 'room_rect':
      return <Icons.RoomAreaIcon size={22} />;
    case 'room_grid':
      return <Icons.RoomGridIcon size={22} />;
    case 'door':
    case 'double_door':
    case 'door_opening':
      return <Icons.DoorIcon size={22} />;
    case 'stair':
    case 'ramp':
      return <Icons.StairsIcon size={22} />;
    case 'elevator':
    case 'freight_lift':
      return <Icons.ElevatorIcon size={22} />;
    case 'text_label':
    case 'room_label':
      return <Icons.TextIcon size={22} />;
    case 'dimension':
      return <Icons.DimensionIcon size={22} />;
    default:
      return <Icons.HelpIcon size={22} />;
  }
};

type CategoryKey = 'structure' | 'doors' | 'circulation' | 'furniture' | 'labels';

interface PartItem {
  id: string;
  name: string;
  icon: string;
  type: 
    | ObjectType 
    | 'thick_wall' 
    | 'thin_wall' 
    | 'double_door' 
    | 'door_opening' 
    | 'freight_lift' 
    | 'ramp' 
    | 'text_label' 
    | 'room_label'
    | 'student_desk'
    | 'chair'
    | 'office_chair'
    | 'desk_with_chair'
    | 'teacher_desk'
    | 'table'
    | 'conference_table'
    | 'sofa'
    | 'armchair'
    | 'cabinet'
    | 'closet'
    | 'shelf'
    | 'bed'
    | 'toilet'
    | 'urinal'
    | 'sink'
    | 'kitchen_sink'
    | 'portable_sink'
    | 'whiteboard'
    | 'room_rect'
    | 'wall_rect'
    | 'classroom_array'
    | 'room_grid'
    | 'poly_wall'
    | 'opening_window';
}

interface Category {
  id: CategoryKey;
  title: string;
  items: PartItem[];
}

export const PartsLibrary: React.FC = () => {
  const { t } = useI18n();
  const [openCategories, setOpenCategories] = useState<Record<CategoryKey, boolean>>({
    structure: true,
    doors: true,
    circulation: false,
    furniture: false,
    labels: false,
  });

  const canvas = useProjectStore((state) => state.project.canvas);
  const scale = useProjectStore((state) => state.project.scale);
  const addObject = useProjectStore((state) => state.addObject);
  const addObjects = useProjectStore((state) => state.addObjects);
  const setSelectedIds = useProjectStore((state) => state.setSelectedIds);
  const setActiveTool = useProjectStore((state) => state.setActiveTool);
  const setCurrentWallConfig = useProjectStore((state) => state.setCurrentWallConfig);
  const layers = useProjectStore((state) => state.project.layers);

  const getTargetLayer = (preferredId: string) => {
    return layers.some((l) => l.id === preferredId) ? preferredId : (layers[0]?.id || '');
  };

  // Classroom Layout Array Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(6);
  const [hGap, setHGap] = useState(800);
  const [vGap, setVGap] = useState(900);
  const [arrayRotation, setArrayRotation] = useState(0);
  const [groupAsOne, setGroupAsOne] = useState(false);
  const [furnitureSet, setFurnitureSet] = useState<'desk_chair' | 'desk_only' | 'chair_only'>('desk_chair');
  const arrayDeskMeta = getPlanSymbolMetadata('student_desk');
  const arrayChairMeta = getPlanSymbolMetadata('chair');
  const [deskW, setDeskW] = useState(arrayDeskMeta.defaultWidth);
  const [deskH, setDeskH] = useState(arrayDeskMeta.defaultHeight);
  const [chairW, setChairW] = useState(arrayChairMeta.defaultWidth);
  const [chairH, setChairH] = useState(arrayChairMeta.defaultHeight);

  // Desk with Chair Modal States
  const [isDeskChairModalOpen, setIsDeskChairModalOpen] = useState(false);
  const [deskChairCount, setDeskChairCount] = useState(1);
  const [deskChairSide, setDeskChairSide] = useState<ChairSide>('front');
  const [deskChairDeskW, setDeskChairDeskW] = useState(getPlanSymbolMetadata('student_desk').defaultWidth);
  const [deskChairDeskH, setDeskChairDeskH] = useState(getPlanSymbolMetadata('student_desk').defaultHeight);
  const [deskChairChairW, setDeskChairChairW] = useState(getPlanSymbolMetadata('chair').defaultWidth);
  const [deskChairChairH, setDeskChairChairH] = useState(getPlanSymbolMetadata('chair').defaultHeight);
  const [deskChairRotation, setDeskChairRotation] = useState(0);
  const [deskChairGroupAsOne, setDeskChairGroupAsOne] = useState(true);

  // Room Row / Grid Modal States
  const [isRoomGridModalOpen, setIsRoomGridModalOpen] = useState(false);
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(3);
  const [roomW, setRoomW] = useState(6000);
  const [roomH, setRoomH] = useState(5000);
  const [roomGridMode, setRoomGridMode] = useState<'touch' | 'gap'>('touch');
  const [roomGap, setRoomGap] = useState(1000);
  const [startingName, setStartingName] = useState('601');
  const [autoNumber, setAutoNumber] = useState(true);
  const [doorTop, setDoorTop] = useState(false);
  const [doorBottom, setDoorBottom] = useState(true);
  const [doorLeft, setDoorLeft] = useState(false);
  const [doorRight, setDoorRight] = useState(false);

  const categories: Category[] = [
    {
      id: 'structure',
      title: 'Structure',
      items: [
        { id: 'wall', name: 'Wall (Standard)', icon: '🧱', type: 'wall' },
        { id: 'thick_wall', name: 'Thick Wall', icon: '🧱', type: 'thick_wall' },
        { id: 'thin_wall', name: 'Thin Wall', icon: '🧱', type: 'thin_wall' },
        { id: 'poly_wall', name: 'Free Room Path / Continuous Wall', icon: '〰️', type: 'poly_wall' },
        { id: 'column', name: 'Column', icon: '🏛️', type: 'column' },
        { id: 'window', name: 'Window', icon: '🪟', type: 'window' },
        { id: 'opening_window', name: 'Opening Window', icon: '🪟🚪', type: 'opening_window' },
        { id: 'room_rect', name: 'Smart Room', icon: '⬜', type: 'room_rect' },
        { id: 'room_grid', name: 'Room Row / Grid', icon: '🧱🏢', type: 'room_grid' },
        { id: 'wall_rect', name: 'Wall Rectangle', icon: '🧱⬜', type: 'wall_rect' },
      ],
    },
    {
      id: 'doors',
      title: 'Doors',
      items: [
        { id: 'door', name: 'Single Door', icon: '🚪', type: 'door' },
        { id: 'double_door', name: 'Double Door', icon: '🚪🚪', type: 'double_door' },
        { id: 'door_opening', name: 'Door Opening', icon: '🕳️', type: 'door_opening' },
      ],
    },
    {
      id: 'circulation',
      title: 'Circulation',
      items: [
        { id: 'stair', name: 'Stairs', icon: '🪜', type: 'stair' },
        { id: 'elevator', name: 'Elevator', icon: '🛗', type: 'elevator' },
        { id: 'freight_lift', name: 'Freight Lift', icon: '🛗', type: 'freight_lift' },
        { id: 'ramp', name: 'Ramp', icon: '📐', type: 'ramp' },
      ],
    },
    {
      id: 'furniture',
      title: 'Furniture & Fixtures',
      items: [
        { id: 'classroom_array', name: 'Classroom Layout Array', icon: '🏫🏫', type: 'classroom_array' },
        { id: 'student_desk', name: 'Student Desk', icon: '🏫', type: 'student_desk' },
        { id: 'chair', name: 'Chair', icon: '🪑', type: 'chair' },
        { id: 'office_chair', name: 'Office Chair', icon: '💺', type: 'office_chair' },
        { id: 'desk_with_chair', name: 'Desk with Chair', icon: '🏫🪑', type: 'desk_with_chair' },
        { id: 'teacher_desk', name: 'Teacher Desk', icon: '👨‍🏫', type: 'teacher_desk' },
        { id: 'table', name: 'Table', icon: '🪵', type: 'table' },
        { id: 'conference_table', name: 'Conference Table', icon: '🪵🪵', type: 'conference_table' },
        { id: 'sofa', name: 'Sofa', icon: '🛋️', type: 'sofa' },
        { id: 'armchair', name: 'Armchair', icon: '🪑🛋️', type: 'armchair' },
        { id: 'cabinet', name: 'Cabinet', icon: '🗄️', type: 'cabinet' },
        { id: 'closet', name: 'Closet', icon: '▥', type: 'closet' },
        { id: 'shelf', name: 'Shelf', icon: '📚', type: 'shelf' },
        { id: 'bed', name: 'Bed', icon: '🛏️', type: 'bed' },
        { id: 'toilet', name: 'Toilet', icon: '🚽', type: 'toilet' },
        { id: 'urinal', name: 'Urinal', icon: '🚹', type: 'urinal' },
        { id: 'sink', name: 'Sink', icon: '🚰', type: 'sink' },
        { id: 'kitchen_sink', name: 'Kitchen Sink', icon: '🚰', type: 'kitchen_sink' },
        { id: 'portable_sink', name: 'Portable Sink', icon: '🚰🧼', type: 'portable_sink' },
        { id: 'whiteboard', name: 'Whiteboard', icon: '📋', type: 'whiteboard' },
      ],
    },
    {
      id: 'labels',
      title: 'Labels & Dimensions',
      items: [
        { id: 'text_label', name: 'Text Label', icon: '📝', type: 'text_label' },
        { id: 'room_label', name: 'Room Label', icon: '🏷️', type: 'room_label' },
        { id: 'dimension', name: 'Dimension Line', icon: '📏', type: 'dimension' },
      ],
    },
  ];



  const addPart = (item: PartItem) => {
    const realSize = getRealPaperSize(canvas, scale);
    const cx = Math.round(realSize.width / 2);
    const cy = Math.round(realSize.height / 2);

    const timestamp = Date.now();
    const newId = `${item.id}_${timestamp}`;

    let newObj: MapObject;

    switch (item.type) {
      case 'wall':
        setCurrentWallConfig({ thickness: 180, style: 'exterior', layerId: getTargetLayer('layer_structural_walls') });
        setActiveTool('wall');
        return;

      case 'poly_wall':
        setCurrentWallConfig({ thickness: 180, style: 'exterior', layerId: getTargetLayer('layer_structural_walls') });
        setActiveTool('poly_wall');
        return;

      case 'thick_wall':
        setCurrentWallConfig({ thickness: 300, style: 'exterior', layerId: getTargetLayer('layer_structural_walls') });
        setActiveTool('wall');
        return;

      case 'thin_wall':
        setCurrentWallConfig({ thickness: 100, style: 'interior', layerId: getTargetLayer('layer_internal_walls') });
        setActiveTool('wall');
        return;

      case 'room_rect':
        setCurrentWallConfig({ thickness: 180, style: 'exterior', layerId: getTargetLayer('layer_structural_walls') });
        setActiveTool('room');
        return;

      case 'wall_rect':
        setCurrentWallConfig({ thickness: 180, style: 'exterior', layerId: getTargetLayer('layer_structural_walls') });
        setActiveTool('rect');
        return;

      case 'column':
        newObj = {
          id: newId,
          type: 'column',
          layerId: getTargetLayer('layer_columns'),
          x: cx,
          y: cy,
          width: 400,
          height: 400,
          rotation: 0,
          visible: true,
          locked: false,
        };
        break;

      case 'window':
        newObj = {
          id: newId,
          type: 'window',
          layerId: getTargetLayer('layer_doors_windows'),
          x: cx,
          y: cy,
          width: 1200,
          thickness: 180,
          rotation: 0,
          visible: true,
          locked: false,
          style: 'double-line',
        };
        break;

      case 'opening_window':
        newObj = {
          id: newId,
          type: 'window',
          layerId: getTargetLayer('layer_doors_windows'),
          x: cx,
          y: cy,
          width: 1200,
          thickness: 180,
          rotation: 0,
          visible: true,
          locked: false,
          style: 'opening',
        };
        break;

      case 'door':
        newObj = {
          id: newId,
          type: 'door',
          layerId: getTargetLayer('layer_doors_windows'),
          x: cx,
          y: cy,
          width: 900,
          rotation: 0,
          hingeSide: 'left',
          swingDirection: 'inward',
          openingAngle: 90,
          visible: true,
          locked: false,
        };
        break;

      case 'double_door':
        newObj = {
          id: newId,
          type: 'furniture', // Represented as special furniture symbol
          layerId: getTargetLayer('layer_doors_windows'),
          furnitureType: 'double_door',
          x: cx,
          y: cy,
          width: 1800,
          height: 400,
          rotation: 0,
          visible: true,
          locked: false,
        };
        break;

      case 'door_opening':
        newObj = {
          id: newId,
          type: 'furniture',
          layerId: getTargetLayer('layer_doors_windows'),
          furnitureType: 'door_opening',
          x: cx,
          y: cy,
          width: 900,
          height: 180,
          rotation: 0,
          visible: true,
          locked: false,
        };
        break;

      case 'stair':
        newObj = {
          id: newId,
          type: 'stair',
          layerId: getTargetLayer('layer_circulation'),
          x: cx,
          y: cy,
          width: 1200,
          height: 2000,
          rotation: 0,
          steps: 8,
          visible: true,
          locked: false,
        };
        break;

      case 'elevator':
        newObj = {
          id: newId,
          type: 'elevator',
          layerId: getTargetLayer('layer_circulation'),
          x: cx,
          y: cy,
          width: 1500,
          height: 1500,
          rotation: 0,
          visible: true,
          locked: false,
        };
        break;

      case 'freight_lift':
        newObj = {
          id: newId,
          type: 'elevator',
          layerId: getTargetLayer('layer_circulation'),
          x: cx,
          y: cy,
          width: 2000,
          height: 2000,
          rotation: 0,
          visible: true,
          locked: false,
          stroke: '#1e293b',
          fill: '#cbd5e1',
        };
        // flag it as freight lift using store properties, we'll render it custom in SvgCanvas
        break;

      case 'ramp':
        newObj = {
          id: newId,
          type: 'furniture',
          layerId: getTargetLayer('layer_circulation'),
          furnitureType: 'ramp',
          x: cx,
          y: cy,
          width: 1200,
          height: 2500,
          rotation: 0,
          visible: true,
          locked: false,
        };
        break;

      case 'desk_with_chair':
        setIsDeskChairModalOpen(true);
        return;

      case 'student_desk':
      case 'chair':
      case 'teacher_desk':
      case 'table':
      case 'sofa':
      case 'cabinet':
      case 'shelf':
      case 'closet':
      case 'bed':
      case 'toilet':
      case 'urinal':
      case 'sink':
      case 'kitchen_sink':
      case 'portable_sink':
      case 'office_chair':
      case 'conference_table':
      case 'armchair':
      case 'whiteboard': {
        const meta = getPlanSymbolMetadata(item.type);
        newObj = {
          id: newId,
          type: 'furniture',
          layerId: getTargetLayer('layer_furniture'),
          furnitureType: meta.id,
          x: cx,
          y: cy,
          width: meta.defaultWidth,
          height: meta.defaultHeight,
          rotation: 0,
          visible: true,
          locked: false,
        };
        break;
      }

      case 'text_label':
        newObj = {
          id: newId,
          type: 'text',
          layerId: getTargetLayer('layer_notes'),
          x: cx,
          y: cy,
          text: 'Text Note',
          fontSize: 240,
          fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
          fontWeight: '400',
          align: 'center',
          rotation: 0,
          keepUpright: true,
          visible: true,
          locked: false,
        };
        break;

      case 'room_label':
        newObj = {
          id: newId,
          type: 'text',
          layerId: getTargetLayer('layer_labels'),
          x: cx,
          y: cy,
          text: 'Room 101\n40㎡',
          fontSize: 240,
          fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
          fontWeight: '600',
          align: 'center',
          rotation: 0,
          keepUpright: true,
          visible: true,
          locked: false,
        };
        break;

      case 'classroom_array':
        setIsModalOpen(true);
        return;

      case 'room_grid':
        setIsRoomGridModalOpen(true);
        return;

      case 'dimension':
        setActiveTool('dimension');
        return;

      default:
        return;
    }

    addObject(newObj);
    setSelectedIds([newId]);
  };

  const handleRoomGridSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const realSize = getRealPaperSize(canvas, scale);
    const cx = Math.round(realSize.width / 2);
    const cy = Math.round(realSize.height / 2);

    const colSpacing = roomGridMode === 'touch' ? roomW : roomW + roomGap;
    const rowSpacing = roomGridMode === 'touch' ? roomH : roomH + roomGap;

    const totalWidth = (gridCols - 1) * colSpacing + roomW;
    const totalHeight = (gridRows - 1) * rowSpacing + roomH;

    const leftStart = cx - totalWidth / 2 + roomW / 2;
    const topStart = cy - totalHeight / 2 + roomH / 2;

    const newRooms: MapObject[] = [];

    // Parse starting room name for auto-numbering
    let namePrefix = startingName;
    let startNum = 1;
    let hasNumber = false;

    if (autoNumber) {
      const match = startingName.match(/^(.*?)(\d+)$/);
      if (match) {
        namePrefix = match[1];
        startNum = parseInt(match[2], 10);
        hasNumber = true;
      }
    }

    const timestamp = Date.now();

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const roomIdx = r * gridCols + c;
        const rx = leftStart + c * colSpacing;
        const ry = topStart + r * rowSpacing;

        let roomName = startingName;
        if (autoNumber) {
          if (hasNumber) {
            roomName = `${namePrefix}${startNum + roomIdx}`;
          } else {
            roomName = `${startingName} ${roomIdx + 1}`;
          }
        }

        // Configure shared walls if touch mode is enabled
        const isExteriorTop = roomGridMode !== 'touch' || r === 0;
        const isExteriorBottom = roomGridMode !== 'touch' || r === gridRows - 1;
        const isExteriorLeft = roomGridMode !== 'touch' || c === 0;
        const isExteriorRight = roomGridMode !== 'touch' || c === gridCols - 1;

        const defaultWall = (isExterior: boolean) => ({
          visible: true,
          thickness: isExterior ? 200 : 120, // thicker outer walls, thinner inner shared partitions
          style: (isExterior ? 'exterior' : 'interior') as 'exterior' | 'interior',
        });

        // Set up room openings (doors)
        const openings: any[] = [];
        if (doorTop) {
          openings.push({
            id: `op_door_top_${roomIdx}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            wall: 'top',
            type: 'door',
            offset: Math.round(roomW / 2 - 450),
            width: 900,
            hingeSide: 'left',
            swingDirection: 'inward',
            openingAngle: 90,
          });
        }
        if (doorBottom) {
          openings.push({
            id: `op_door_bottom_${roomIdx}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            wall: 'bottom',
            type: 'door',
            offset: Math.round(roomW / 2 - 450),
            width: 900,
            hingeSide: 'left',
            swingDirection: 'inward',
            openingAngle: 90,
          });
        }
        if (doorLeft) {
          openings.push({
            id: `op_door_left_${roomIdx}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            wall: 'left',
            type: 'door',
            offset: Math.round(roomH / 2 - 450),
            width: 900,
            hingeSide: 'left',
            swingDirection: 'inward',
            openingAngle: 90,
          });
        }
        if (doorRight) {
          openings.push({
            id: `op_door_right_${roomIdx}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            wall: 'right',
            type: 'door',
            offset: Math.round(roomH / 2 - 450),
            width: 900,
            hingeSide: 'left',
            swingDirection: 'inward',
            openingAngle: 90,
          });
        }

        const areaSqM = (roomW * roomH) / 1000000;
        const areaLabel = `${areaSqM.toFixed(1)}㎡`;

        const roomObj = {
          id: `room_${timestamp}_${roomIdx}`,
          type: 'room' as const,
          layerId: getTargetLayer('layer_structural_walls'),
          visible: true,
          locked: false,
          rotation: 0,
          x: rx,
          y: ry,
          width: roomW,
          height: roomH,
          name: roomName,
          areaLabel,
          showLabel: true,
          walls: {
            top: defaultWall(isExteriorTop),
            bottom: defaultWall(isExteriorBottom),
            left: defaultWall(isExteriorLeft),
            right: defaultWall(isExteriorRight),
          },
          openings,
        };

        newRooms.push(roomObj);
      }
    }

    addObjects(newRooms);
    setSelectedIds(newRooms.map((r) => r.id));
    setIsRoomGridModalOpen(false);
  };

  const handleArraySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);

    const realSize = getRealPaperSize(canvas, scale);
    const cx = Math.round(realSize.width / 2);
    const cy = Math.round(realSize.height / 2);

    const newObjects: MapObject[] = [];
    const timestamp = Date.now();
    const groupId = groupAsOne ? `array_${timestamp}` : undefined;

    const rad = (arrayRotation * Math.PI) / 180;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Calculate slot local offset relative to center of array grid
        const lx = (c - (cols - 1) / 2) * hGap;
        const ly = (r - (rows - 1) / 2) * vGap;

        // Rotate slot offset by arrayRotation
        const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
        const ry = lx * Math.sin(rad) + ly * Math.cos(rad);

        // Center of the slot in canvas space
        const slotX = cx + rx;
        const slotY = cy + ry;

        // Generate IDs for this grid cell
        const deskId = `array_desk_${timestamp}_r${r}_c${c}`;
        const chairId = `array_chair_${timestamp}_r${r}_c${c}`;

        if (furnitureSet === 'desk_chair') {
          // Desk offset Y = -chair_height / 2
          // Chair offset Y = +desk_height / 2
          const deskOffsetLocalY = -chairH / 2;
          const chairOffsetLocalY = deskH / 2;

          // Rotate offsets
          const deskRx = -deskOffsetLocalY * Math.sin(rad);
          const deskRy = deskOffsetLocalY * Math.cos(rad);
          const chairRx = -chairOffsetLocalY * Math.sin(rad);
          const chairRy = chairOffsetLocalY * Math.cos(rad);

          const deskObj: MapObject = {
            id: deskId,
            type: 'furniture',
            layerId: getTargetLayer('layer_furniture'),
            furnitureType: 'student_desk',
            x: Math.round(slotX + deskRx),
            y: Math.round(slotY + deskRy),
            width: deskW,
            height: deskH,
            rotation: arrayRotation,
            visible: true,
            locked: false,
            groupId,
          };

          const chairObj: MapObject = {
            id: chairId,
            type: 'furniture',
            layerId: getTargetLayer('layer_furniture'),
            furnitureType: 'chair',
            x: Math.round(slotX + chairRx),
            y: Math.round(slotY + chairRy),
            width: chairW,
            height: chairH,
            // Chair sits in front of the desk (toward +y) and must face the desk: the chair
            // glyph's backrest is at its top, so keep it un-rotated relative to the array so the
            // backrest ends up on the far side (away from the desk).
            rotation: arrayRotation % 360,
            visible: true,
            locked: false,
            groupId,
          };

          newObjects.push(deskObj, chairObj);
        } else if (furnitureSet === 'desk_only') {
          const deskObj: MapObject = {
            id: deskId,
            type: 'furniture',
            layerId: getTargetLayer('layer_furniture'),
            furnitureType: 'student_desk',
            x: Math.round(slotX),
            y: Math.round(slotY),
            width: deskW,
            height: deskH,
            rotation: arrayRotation,
            visible: true,
            locked: false,
            groupId,
          };
          newObjects.push(deskObj);
        } else if (furnitureSet === 'chair_only') {
          const chairObj: MapObject = {
            id: chairId,
            type: 'furniture',
            layerId: getTargetLayer('layer_furniture'),
            furnitureType: 'chair',
            x: Math.round(slotX),
            y: Math.round(slotY),
            width: chairW,
            height: chairH,
            rotation: arrayRotation,
            visible: true,
            locked: false,
            groupId,
          };
          newObjects.push(chairObj);
        }
      }
    }

    if (newObjects.length > 0) {
      addObjects(newObjects);
      setSelectedIds(newObjects.map((o) => o.id));
    }
  };

  const handleDeskChairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeskChairModalOpen(false);

    const realSize = getRealPaperSize(canvas, scale);
    const cx = Math.round(realSize.width / 2);
    const cy = Math.round(realSize.height / 2);

    const objects = createDeskChairSet({
      centerX: cx,
      centerY: cy,
      rotation: deskChairRotation,
      layerId: getTargetLayer('layer_furniture'),
      deskWidth: deskChairDeskW,
      deskHeight: deskChairDeskH,
      chairWidth: deskChairChairW,
      chairHeight: deskChairChairH,
      chairCount: deskChairCount,
      chairSide: deskChairSide,
      groupAsOne: deskChairGroupAsOne,
    });

    addObjects(objects);
    setSelectedIds(objects.map((o) => o.id));
  };

  const toggleCategory = (id: CategoryKey) => {
    setOpenCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <>
      <aside className="sidebar-left">
        <div className="panel-header">
          <span>{t('parts.title')}</span>
        </div>
        <div className="panel-body" style={{ gap: '8px', padding: '12px' }}>
          {categories.map((cat) => (
            <div key={cat.id} className="accordion">
              <div className="accordion-summary" onClick={() => toggleCategory(cat.id)}>
                <span>{t(`parts.category.${cat.id}`)}</span>
                <span>{openCategories[cat.id] ? '▼' : '▶'}</span>
              </div>
              {openCategories[cat.id] && (
                <div className="accordion-details">
                  <div className="parts-grid">
                    {cat.items.map((item) => (
                      <button 
                        key={item.id} 
                        className="part-item-btn" 
                        onClick={() => addPart(item)}
                        title={t(`parts.item.${item.id}`)}
                      >
                        <span className="part-item-icon">{getPartIcon(item.id)}</span>
                        <span className="part-item-label">{t(`parts.item.${item.id}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('parts.modal.array.title')}</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleArraySubmit}>
              <div className="modal-body">
                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.array.rows')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={rows} 
                      onChange={(e) => setRows(parseInt(e.target.value) || 1)} 
                      required 
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.array.cols')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={cols} 
                      onChange={(e) => setCols(parseInt(e.target.value) || 1)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.array.hGap')}</label>
                    <input 
                      type="number" 
                      min="100" 
                      value={hGap} 
                      onChange={(e) => setHGap(parseInt(e.target.value) || 800)} 
                      required 
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.array.vGap')}</label>
                    <input 
                      type="number" 
                      min="100" 
                      value={vGap} 
                      onChange={(e) => setVGap(parseInt(e.target.value) || 900)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.array.rotation')}</label>
                    <input 
                      type="number" 
                      value={arrayRotation} 
                      onChange={(e) => setArrayRotation(parseInt(e.target.value) || 0)} 
                      required 
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.array.group')}</label>
                    <select 
                      value={groupAsOne ? 'yes' : 'no'} 
                      onChange={(e) => setGroupAsOne(e.target.value === 'yes')}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="modal-form-group">
                  <label>{t('parts.modal.array.furnitureSet')}</label>
                  <select 
                    value={furnitureSet} 
                    onChange={(e) => setFurnitureSet(e.target.value as any)}
                  >
                    <option value="desk_chair">{t('parts.modal.array.furnitureSet.deskChair')}</option>
                    <option value="desk_only">{t('parts.modal.array.furnitureSet.deskOnly')}</option>
                    <option value="chair_only">{t('parts.modal.array.furnitureSet.chairOnly')}</option>
                  </select>
                </div>

                {furnitureSet !== 'chair_only' && (
                  <div className="modal-form-row">
                    <div className="modal-form-group">
                      <label>Desk Width (mm)</label>
                      <input 
                        type="number" 
                        min="100"
                        value={deskW} 
                        onChange={(e) => setDeskW(parseInt(e.target.value) || 700)} 
                        required 
                      />
                    </div>
                    <div className="modal-form-group">
                      <label>Desk Height (mm)</label>
                      <input 
                        type="number" 
                        min="100"
                        value={deskH} 
                        onChange={(e) => setDeskH(parseInt(e.target.value) || 450)} 
                        required 
                      />
                    </div>
                  </div>
                )}

                {furnitureSet !== 'desk_only' && (
                  <div className="modal-form-row">
                    <div className="modal-form-group">
                      <label>Chair Width (mm)</label>
                      <input 
                        type="number" 
                        min="100"
                        value={chairW} 
                        onChange={(e) => setChairW(parseInt(e.target.value) || 350)} 
                        required 
                      />
                    </div>
                    <div className="modal-form-group">
                      <label>Chair Height (mm)</label>
                      <input 
                        type="number" 
                        min="100"
                        value={chairH} 
                        onChange={(e) => setChairH(parseInt(e.target.value) || 350)} 
                        required 
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-btn modal-btn-secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="modal-btn modal-btn-primary">{t('parts.modal.array.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeskChairModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDeskChairModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('parts.modal.deskChair.title')}</h3>
              <button className="modal-close-btn" onClick={() => setIsDeskChairModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleDeskChairSubmit}>
              <div className="modal-body">
                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.chairCount')}</label>
                    <input
                      type="number"
                      min="0"
                      max="8"
                      value={deskChairCount}
                      onChange={(e) => setDeskChairCount(Math.min(8, Math.max(0, parseInt(e.target.value) || 0)))}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.chairSide')}</label>
                    <select
                      value={deskChairSide}
                      onChange={(e) => setDeskChairSide(e.target.value as ChairSide)}
                    >
                      <option value="front">{t('parts.modal.deskChair.chairSide.front')}</option>
                      <option value="back">{t('parts.modal.deskChair.chairSide.back')}</option>
                      <option value="left">{t('parts.modal.deskChair.chairSide.left')}</option>
                      <option value="right">{t('parts.modal.deskChair.chairSide.right')}</option>
                      <option value="around">{t('parts.modal.deskChair.chairSide.around')}</option>
                    </select>
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.deskWidth')}</label>
                    <input
                      type="number"
                      min="100"
                      value={deskChairDeskW}
                      onChange={(e) => setDeskChairDeskW(parseInt(e.target.value) || 700)}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.deskHeight')}</label>
                    <input
                      type="number"
                      min="100"
                      value={deskChairDeskH}
                      onChange={(e) => setDeskChairDeskH(parseInt(e.target.value) || 450)}
                      required
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.chairWidth')}</label>
                    <input
                      type="number"
                      min="100"
                      value={deskChairChairW}
                      onChange={(e) => setDeskChairChairW(parseInt(e.target.value) || 400)}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.chairHeight')}</label>
                    <input
                      type="number"
                      min="100"
                      value={deskChairChairH}
                      onChange={(e) => setDeskChairChairH(parseInt(e.target.value) || 400)}
                      required
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.rotation')}</label>
                    <input
                      type="number"
                      value={deskChairRotation}
                      onChange={(e) => setDeskChairRotation(parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.deskChair.group')}</label>
                    <select
                      value={deskChairGroupAsOne ? 'yes' : 'no'}
                      onChange={(e) => setDeskChairGroupAsOne(e.target.value === 'yes')}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-btn modal-btn-secondary" onClick={() => setIsDeskChairModalOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="modal-btn modal-btn-primary">{t('parts.modal.deskChair.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRoomGridModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRoomGridModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('parts.modal.grid.title')}</h3>
              <button className="modal-close-btn" onClick={() => setIsRoomGridModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleRoomGridSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.grid.rows')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10"
                      value={gridRows} 
                      onChange={(e) => setGridRows(parseInt(e.target.value) || 1)} 
                      required 
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.grid.cols')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10"
                      value={gridCols} 
                      onChange={(e) => setGridCols(parseInt(e.target.value) || 1)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.grid.width')}</label>
                    <input 
                      type="number" 
                      min="1000" 
                      max="20000"
                      value={roomW} 
                      onChange={(e) => setRoomW(parseInt(e.target.value) || 6000)} 
                      required 
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>{t('parts.modal.grid.height')}</label>
                    <input 
                      type="number" 
                      min="1000" 
                      max="20000"
                      value={roomH} 
                      onChange={(e) => setRoomH(parseInt(e.target.value) || 5000)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.grid.gapMode')}</label>
                    <select 
                      value={roomGridMode} 
                      onChange={(e) => setRoomGridMode(e.target.value as 'touch' | 'gap')}
                    >
                      <option value="touch">{t('parts.modal.grid.touch')}</option>
                      <option value="gap">{t('parts.modal.grid.gapModeOption')}</option>
                    </select>
                  </div>
                  {roomGridMode === 'gap' && (
                    <div className="modal-form-group">
                      <label>{t('parts.modal.grid.gap')}</label>
                      <input 
                        type="number" 
                        min="100" 
                        max="10000"
                        value={roomGap} 
                        onChange={(e) => setRoomGap(parseInt(e.target.value) || 1000)} 
                        required 
                      />
                    </div>
                  )}
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>{t('parts.modal.grid.startingName')}</label>
                    <input 
                      type="text" 
                      value={startingName} 
                      onChange={(e) => setStartingName(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="modal-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                    <input 
                      type="checkbox" 
                      id="autoNumber"
                      checked={autoNumber} 
                      onChange={(e) => setAutoNumber(e.target.checked)} 
                    />
                    <label htmlFor="autoNumber" style={{ margin: 0, cursor: 'pointer' }}>{t('parts.modal.grid.autoNumber')}</label>
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '8px' }}>{t('parts.modal.grid.doorPositions')}:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={doorTop} onChange={(e) => setDoorTop(e.target.checked)} />
                      {t('parts.modal.grid.doorPositions.top')}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={doorBottom} onChange={(e) => setDoorBottom(e.target.checked)} />
                      {t('parts.modal.grid.doorPositions.bottom')}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={doorLeft} onChange={(e) => setDoorLeft(e.target.checked)} />
                      {t('parts.modal.grid.doorPositions.left')}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={doorRight} onChange={(e) => setDoorRight(e.target.checked)} />
                      {t('parts.modal.grid.doorPositions.right')}
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-btn modal-btn-secondary" onClick={() => setIsRoomGridModalOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="modal-btn modal-btn-primary">{t('parts.modal.grid.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
export default PartsLibrary;
