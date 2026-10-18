import React from 'react';
import { useProjectStore } from '../store/projectStore';
import type { MapObject, Layer } from '../types/project';
import { SelectionOverlay } from './SelectionOverlay';
import * as Icons from '../ui/icons/Icons';
import { snapObject, snapEndpoint } from '../utils/snapping';
import { useI18n } from '../i18n';
import { clientToWorldPoint } from '../utils/coordinates';
import {
  getRoomAutoAreaLabel,
  getDimensionLengthMm,
  formatDimensionLabel,
  getRoomLabelFinalFontSizePx,
  getDimensionLabelFinalFontSizePx
} from '../utils/measurements';
import { PlanSymbolRenderer } from '../symbols/PlanSymbol';

import { getStyle } from '../utils/style';
import { getPaperPixelSize } from '../utils/scale';

const DEFAULT_FONT_STACK = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';

export const SvgCanvas: React.FC = () => {
  const { t } = useI18n();
  const objects = useProjectStore((state) => state.project.objects);
  const layers = useProjectStore((state) => state.project.layers);
  const scale = useProjectStore((state) => state.project.scale);
  const canvasConfig = useProjectStore((state) => state.project.canvas);
  const stylePreset = useProjectStore((state) => state.project.stylePreset);
  const isRef = stylePreset === 'architectural-reference';
  const s = getStyle(stylePreset);
  const zoom = useProjectStore((state) => state.zoom);
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const setSelectedIds = useProjectStore((state) => state.setSelectedIds);
  const pushToHistory = useProjectStore((state) => state.pushToHistory);
  const activeTool = useProjectStore((state) => state.activeTool);
  const setObjects = useProjectStore((state) => state.setObjects);
  const selectedRoomSide = useProjectStore((state) => state.selectedRoomSide);
  const setSelectedRoomSide = useProjectStore((state) => state.setSelectedRoomSide);
  const updateObject = useProjectStore((state) => state.updateObjectWithHistory);
  const snapGuides = useProjectStore((state) => state.snapGuides);
  const setSnapGuides = useProjectStore((state) => state.setSnapGuides);

  const toPx = (val: number) => val * scale.pixelsPerUnit;

  // Build a map of layers for quick visibility checks
  const layerVisibility = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    layers.forEach((l: Layer) => {
      map[l.id] = l.visible;
    });
    return map;
  }, [layers]);

  // Build a map of layers for quick lock status checks
  const layerLocked = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    layers.forEach((l: Layer) => {
      map[l.id] = l.locked;
    });
    return map;
  }, [layers]);

  const handlePointerDown = (e: React.PointerEvent, obj: MapObject) => {
    if (obj.layerId && layerLocked[obj.layerId]) {
      return;
    }
    e.stopPropagation(); // Prevent deselecting via canvas click
    
    let activeSelection = selectedIds;
    const isShiftOrCtrl = e.shiftKey || e.ctrlKey || e.metaKey;
    if (isShiftOrCtrl) {
      if (selectedIds.includes(obj.id)) {
        setSelectedIds(selectedIds.filter(id => id !== obj.id));
        return; // Do not drag on deselect
      } else {
        activeSelection = [...selectedIds, obj.id];
        setSelectedIds(activeSelection);
      }
    } else {
      if (!selectedIds.includes(obj.id)) {
        activeSelection = [obj.id];
        setSelectedIds(activeSelection);
      }
    }

    if (obj.locked) return; // Locked objects cannot be moved

    // Filter activeSelection to only unlocked objects and objects not on locked layers
    const movableObjects = objects.filter((o) => {
      if (!activeSelection.includes(o.id)) return false;
      if (o.locked) return false;
      if (o.layerId && layerLocked[o.layerId]) return false;
      return true;
    });

    if (movableObjects.length === 0) return;

    const paperElement = document.querySelector('.paper-boundary') as HTMLElement;
    if (!paperElement) return;

    const startWorld = clientToWorldPoint(e, paperElement, zoom, scale.pixelsPerUnit);

    // Capture initial positions of all movable selected objects
    const initialCoordsMap = new Map<string, any>();
    movableObjects.forEach((mObj) => {
      if ('x' in mObj && mObj.x !== undefined) {
        initialCoordsMap.set(mObj.id, { x: mObj.x, y: mObj.y });
      } else if ('x1' in mObj) {
        initialCoordsMap.set(mObj.id, { x1: mObj.x1, y1: mObj.y1, x2: mObj.x2, y2: mObj.y2 });
      } else if ('points' in mObj && (mObj as any).points) {
        initialCoordsMap.set(mObj.id, { points: (mObj as any).points });
      }
    });

    const grid = useProjectStore.getState().project.grid;

    let hasPushedHistory = false;

    const handleMouseMove = (moveEvent: PointerEvent) => {
      const activePaper = document.querySelector('.paper-boundary') as HTMLElement;
      if (!activePaper) return;
      const currentWorld = clientToWorldPoint(moveEvent, activePaper, zoom, scale.pixelsPerUnit);
      const deltaX = currentWorld.x - startWorld.x;
      const deltaY = currentWorld.y - startWorld.y;

      if (deltaX !== 0 || deltaY !== 0) {
        if (!hasPushedHistory) {
          pushToHistory();
          hasPushedHistory = true;
        }
      }

      const allObjects = useProjectStore.getState().project.objects;
      let snappedDeltaX = deltaX;
      let snappedDeltaY = deltaY;
      let activeGuides: any[] = [];
      let doorWindowUpdates: any = null;
      let wallFacingRotation: number | undefined;

      const primaryInitial = initialCoordsMap.get(obj.id);
      if (primaryInitial && grid.snap) {
        if ('x' in obj) {
          const tentativeX = primaryInitial.x + deltaX;
          const tentativeY = primaryInitial.y + deltaY;
          const snapResult = snapObject(obj, tentativeX, tentativeY, allObjects, layerLocked, grid);
          snappedDeltaX = snapResult.x - primaryInitial.x;
          snappedDeltaY = snapResult.y - primaryInitial.y;
          activeGuides = snapResult.guides;

          if (obj.type === 'door' || obj.type === 'window') {
            doorWindowUpdates = {
              rotation: snapResult.rotation ?? obj.rotation,
              wallId: snapResult.wallId
            };
          } else if (obj.type === 'furniture' && !moveEvent.altKey && snapResult.objectRotation !== undefined) {
            wallFacingRotation = snapResult.objectRotation;
          }
        } else if ('x1' in obj) {
          const tentativeX1 = primaryInitial.x1 + deltaX;
          const tentativeY1 = primaryInitial.y1 + deltaY;
          const snapResult = snapEndpoint(tentativeX1, tentativeY1, allObjects, layerLocked, grid, obj.id);
          snappedDeltaX = snapResult.x - primaryInitial.x1;
          snappedDeltaY = snapResult.y - primaryInitial.y1;
          activeGuides = snapResult.guides;
        }
      } else {
        // No grid snap: round to integer
        snappedDeltaX = Math.round(deltaX);
        snappedDeltaY = Math.round(deltaY);
      }

      // Update positions of all movable selected objects in one setObjects call
      const updatedObjects = allObjects.map((o) => {
        if (!initialCoordsMap.has(o.id)) return o;
        const initial = initialCoordsMap.get(o.id);
        
        if (o.id === obj.id && doorWindowUpdates) {
          return {
            ...o,
            x: initial.x + snappedDeltaX,
            y: initial.y + snappedDeltaY,
            ...doorWindowUpdates
          } as MapObject;
        }

        if ('x' in o && o.x !== undefined) {
          return {
            ...o,
            x: initial.x + snappedDeltaX,
            y: initial.y + snappedDeltaY,
            ...(o.id === obj.id && wallFacingRotation !== undefined ? { rotation: wallFacingRotation } : {}),
          } as MapObject;
        } else if ('x1' in o) {
          return {
            ...o,
            x1: initial.x1 + snappedDeltaX,
            y1: initial.y1 + snappedDeltaY,
            x2: initial.x2 + snappedDeltaX,
            y2: initial.y2 + snappedDeltaY,
          } as MapObject;
        } else if ('points' in o && (o as any).points && initial.points) {
          return {
            ...o,
            points: initial.points.map((p: any) => ({
              x: p.x + snappedDeltaX,
              y: p.y + snappedDeltaY
            }))
          } as MapObject;
        }
        return o;
      });

      setObjects(updatedObjects);
      setSnapGuides(activeGuides);
    };

    const handleMouseUp = () => {
      setSnapGuides([]);
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
  };

  const renderObjectInner = (obj: MapObject, isSelected: boolean) => {

    switch (obj.type) {
      case 'wall': {
        const thickness = toPx(obj.thickness);
        let strokeColor = s.outerWallStroke;
        let isGuide = false;
        
        if (obj.style === 'interior') {
          strokeColor = s.innerWallStroke;
        } else if (obj.style === 'guide') {
          strokeColor = s.hiddenStroke;
          isGuide = true;
        }

        const openings = (obj as any).openings || [];
        const x1 = obj.x1;
        const y1 = obj.y1;
        const x2 = obj.x2;
        const y2 = obj.y2;

        const wallLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const dx = wallLen > 0 ? (x2 - x1) / wallLen : 1;
        const dy = wallLen > 0 ? (y2 - y1) / wallLen : 0;
        const angleRad = Math.atan2(y2 - y1, x2 - x1);
        const angleDeg = angleRad * (180 / Math.PI);

        // Sort openings by offset
        const sortedOps = [...openings].sort((a, b) => a.offset - b.offset);
        const wallSegments: { sx1: number; sy1: number; sx2: number; sy2: number }[] = [];
        let lastOffset = 0;

        sortedOps.forEach((op) => {
          if (op.offset > lastOffset + 1) {
            wallSegments.push({
              sx1: x1 + dx * lastOffset,
              sy1: y1 + dy * lastOffset,
              sx2: x1 + dx * op.offset,
              sy2: y1 + dy * op.offset,
            });
          }
          lastOffset = op.offset + op.width;
        });

        if (wallLen > lastOffset + 1) {
          wallSegments.push({
            sx1: x1 + dx * lastOffset,
            sy1: y1 + dy * lastOffset,
            sx2: x2,
            sy2: y2,
          });
        }

        return (
          <g key={obj.id} className="canvas-wall-object" onPointerDown={(e) => handlePointerDown(e, obj)} style={{ cursor: obj.locked ? 'pointer' : 'move' }}>
            {/* Selection highlight (drawn under) */}
            {isSelected && (
              <line
                className="selection-highlight"
                x1={toPx(obj.x1)}
                y1={toPx(obj.y1)}
                x2={toPx(obj.x2)}
                y2={toPx(obj.y2)}
                stroke="#3b82f6"
                strokeWidth={thickness + 6}
                strokeOpacity={0.4}
                strokeLinecap="square"
              />
            )}

            {/* Render solid wall segments */}
            {wallSegments.map((seg, idx) => (
              <line
                key={`seg_${idx}`}
                x1={toPx(seg.sx1)}
                y1={toPx(seg.sy1)}
                x2={toPx(seg.sx2)}
                y2={toPx(seg.sy2)}
                stroke={obj.stroke || strokeColor}
                strokeWidth={thickness}
                strokeLinecap="square"
                strokeDasharray={isGuide ? "4 4" : undefined}
              />
            ))}

            {/* Invisible thick line for easy interaction/clicking */}
            <line
              x1={toPx(obj.x1)}
              y1={toPx(obj.y1)}
              x2={toPx(obj.x2)}
              y2={toPx(obj.y2)}
              stroke="red"
              strokeOpacity={0}
              strokeWidth={Math.max(thickness, 16)}
              strokeLinecap="square"
              style={{ pointerEvents: 'stroke' }}
            />

            {/* Render openings */}
            {sortedOps.map((op) => {
              const opX1 = x1 + dx * op.offset;
              const opY1 = y1 + dy * op.offset;
              const opW = toPx(op.width);
              const thick = toPx(obj.thickness);

              return (
                <g
                  key={`op_${op.id}`}
                  className="opening-element"
                  transform={`translate(${toPx(opX1)}, ${toPx(opY1)}) rotate(${angleDeg})`}
                >
                  {op.type === 'door' && (() => {
                    const angleDegSwing = op.openingAngle ?? 90;
                    const alpha = (angleDegSwing * Math.PI) / 180;
                    const isLeft = op.hingeSide !== 'right';
                    const isInward = op.swingDirection !== 'outward';

                    let hingeX = 0;
                    let leafX = 0;
                    let leafY = 0;
                    let startArcX = 0;
                    let sweepFlag = 0;

                    if (isLeft) {
                      hingeX = 0;
                      startArcX = opW;
                      leafX = opW * Math.cos(alpha);
                      if (isInward) {
                        leafY = opW * Math.sin(alpha);
                        sweepFlag = 1;
                      } else {
                        leafY = -opW * Math.sin(alpha);
                        sweepFlag = 0;
                      }
                    } else {
                      hingeX = opW;
                      startArcX = 0;
                      leafX = opW - opW * Math.cos(alpha);
                      if (isInward) {
                        leafY = opW * Math.sin(alpha);
                        sweepFlag = 0;
                      } else {
                        leafY = -opW * Math.sin(alpha);
                        sweepFlag = 1;
                      }
                    }

                    return (
                      <g>
                        <line x1={0} y1={0} x2={opW} y2={0} stroke={s.furnitureDetailStroke} strokeWidth={1} strokeDasharray="2 2" />
                        <line x1={hingeX} y1={0} x2={leafX} y2={leafY} stroke={obj.stroke || s.doorStroke} strokeWidth={2.5} />
                        <path
                          d={`M ${startArcX} 0 A ${opW} ${opW} 0 0 ${sweepFlag} ${leafX} ${leafY}`}
                          fill="none"
                          stroke={obj.stroke || s.doorSwingStroke}
                          strokeWidth={1.2}
                          strokeDasharray={isRef ? undefined : "3 3"}
                        />
                      </g>
                    );
                  })()}

                  {op.type === 'window' && (
                    <g>
                      <rect x={0} y={-thick / 2} width={opW} height={thick} fill={obj.fill || s.windowGlassFill} stroke={obj.stroke || s.windowStroke} strokeWidth={1} />
                      <line x1={0} y1={-thick * 0.25} x2={opW} y2={-thick * 0.25} stroke={obj.stroke || s.windowGlassStroke} strokeWidth={1.5} />
                      <line x1={0} y1={thick * 0.25} x2={opW} y2={thick * 0.25} stroke={obj.stroke || s.windowGlassStroke} strokeWidth={1.5} />
                      <line x1={0} y1={0} x2={opW} y2={0} stroke={isRef ? (obj.stroke || s.windowGlassStroke) : '#93c5fd'} strokeWidth={1} />
                    </g>
                  )}

                  {op.type === 'opening_window' && (() => {
                    const isLeft = op.hingeSide !== 'right';
                    const isInward = op.swingDirection !== 'outward';
                    const angleDegSwing = op.openingAngle ?? 45;
                    const alpha = (angleDegSwing * Math.PI) / 180;
                    
                    let hingeX = 0;
                    let leafX = 0;
                    let leafY = 0;
                    let startArcX = 0;
                    let sweepFlag = 0;

                    if (isLeft) {
                      hingeX = 0;
                      startArcX = opW;
                      leafX = opW * Math.cos(alpha);
                      if (isInward) {
                        leafY = opW * Math.sin(alpha);
                        sweepFlag = 1;
                      } else {
                        leafY = -opW * Math.sin(alpha);
                        sweepFlag = 0;
                      }
                    } else {
                      hingeX = opW;
                      startArcX = 0;
                      leafX = opW - opW * Math.cos(alpha);
                      if (isInward) {
                        leafY = opW * Math.sin(alpha);
                        sweepFlag = 0;
                      } else {
                        leafY = -opW * Math.sin(alpha);
                        sweepFlag = 1;
                      }
                    }

                    return (
                      <g>
                        <rect x={0} y={-thick / 2} width={opW} height={thick} fill={obj.fill || s.windowGlassFill} stroke={obj.stroke || s.windowStroke} strokeWidth={1} />
                        <line x1={0} y1={-thick * 0.25} x2={opW} y2={-thick * 0.25} stroke={obj.stroke || s.windowGlassStroke} strokeWidth={1.5} />
                        <line x1={0} y1={thick * 0.25} x2={opW} y2={thick * 0.25} stroke={obj.stroke || s.windowGlassStroke} strokeWidth={1.5} />
                        <line x1={0} y1={0} x2={opW} y2={0} stroke={isRef ? (obj.stroke || s.windowGlassStroke) : '#93c5fd'} strokeWidth={1} />
                        <line x1={hingeX} y1={0} x2={leafX} y2={leafY} stroke={obj.stroke || s.windowStroke} strokeWidth={2.5} />
                        <path
                          d={`M ${startArcX} 0 A ${opW} ${opW} 0 0 ${sweepFlag} ${leafX} ${leafY}`}
                          fill="none"
                          stroke={obj.stroke || s.doorSwingStroke}
                          strokeWidth={1.2}
                          strokeDasharray={isRef ? undefined : "3 3"}
                        />
                      </g>
                    );
                  })()}

                  {op.type === 'opening' && (
                    <g>
                      <line x1={0} y1={0} x2={opW} y2={0} stroke={obj.stroke || s.furnitureDetailStroke} strokeWidth={1.2} strokeDasharray="3 3" />
                      <line x1={0} y1={-thick / 2} x2={0} y2={thick / 2} stroke={obj.stroke || s.outerWallStroke} strokeWidth={1.2} />
                      <line x1={opW} y1={-thick / 2} x2={opW} y2={thick / 2} stroke={obj.stroke || s.outerWallStroke} strokeWidth={1.2} />
                    </g>
                  )}
                </g>
              );
            })}

          </g>
        );
      }

      case 'column': {
        const w = toPx(obj.width);
        const h = toPx(obj.height);
        return (
          <g 
            key={obj.id} 
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)} 
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill={obj.fill || 'none'}
              stroke={obj.stroke || s.columnStroke}
              strokeWidth={1.5}
            />
            {/* Selection outline */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-h / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={h + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}
          </g>
        );
      }

      case 'furniture': {
        const w = toPx(obj.width);
        const h = toPx(obj.height);
        const stroke = obj.stroke || s.furnitureStroke;
        const fill = obj.fill || 'none';
        const detailStroke = isRef ? s.furnitureStroke : s.furnitureDetailStroke;

        return (
          <g
            key={obj.id}
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            <PlanSymbolRenderer
              symbolId={obj.furnitureType}
              width={w}
              height={h}
              stroke={stroke}
              fill={fill}
              detailStroke={detailStroke}
            />
            {/* Selection outline */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-h / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={h + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}
          </g>
        );
      }

      case 'text': {
        const lines = obj.text.split('\n');
        const fontSize = toPx(obj.fontSize);
        const textAnchor = obj.align === 'center' ? 'middle' : obj.align === 'right' ? 'end' : 'start';
        
        const maxLen = Math.max(...lines.map(l => l.length));
        const estimatedW = fontSize * maxLen * 0.65;
        const estimatedH = fontSize * lines.length * 1.2;

        let localX = 0;
        if (obj.align === 'center') localX = -estimatedW / 2;
        else if (obj.align === 'right') localX = -estimatedW;

        const keepUpright = obj.keepUpright !== false;
        const groupRotation = keepUpright ? 0 : obj.rotation;

        return (
          <g 
            key={obj.id}
            className="canvas-text-object"
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${groupRotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            {/* selection highlight background */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={localX - 6 / zoom}
                y={-fontSize - 4 / zoom}
                width={estimatedW + 12 / zoom}
                height={estimatedH + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}
            <text
              x={0}
              y={0}
              fontSize={`${fontSize}px`}
              fontFamily={obj.fontFamily || DEFAULT_FONT_STACK}
              fontWeight={obj.fontWeight || '400'}
              fill={obj.color || '#000000'}
              textAnchor={textAnchor}
              style={{ userSelect: 'none' }}
            >
              {lines.map((line, idx) => (
                <tspan key={idx} x={0} dy={idx === 0 ? 0 : '1.2em'}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      }

      case 'stair': {
        const w = toPx(obj.width);
        const h = toPx(obj.height);
        const steps = obj.steps || (isRef ? 15 : 8);
        const stepH = h / steps;
        const stepLines = [];
        
        for (let i = 1; i < steps; i++) {
          const yPos = -h / 2 + i * stepH;
          stepLines.push(
            <line key={i} x1={-w / 2} y1={yPos} x2={w / 2} y2={yPos} stroke={obj.stroke || s.stairStroke} strokeWidth={1} />
          );
        }

        const dir = obj.direction || 'up';
        const isUp = dir === 'up';

        const startY = isUp ? h * 0.35 : -h * 0.35;
        const endY = isUp ? -h * 0.35 : h * 0.35;
        const arrowHeadY = isUp ? -h * 0.38 : h * 0.38;

        const showArrow = obj.showArrow !== false;

        return (
          <g 
            key={obj.id} 
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill={obj.fill || 'none'}
              stroke={obj.stroke || s.stairStroke}
              strokeWidth={isRef ? 1 : 1.5}
            />
            {stepLines}
            {showArrow && (
              <>
                <line x1={0} y1={startY} x2={0} y2={endY} stroke={s.stairArrowStroke} strokeWidth={isRef ? 1 : 1.5} />
                <polygon 
                  points={isUp 
                    ? `0,${arrowHeadY} -4,${arrowHeadY + 8} 4,${arrowHeadY + 8}` 
                    : `0,${arrowHeadY} -4,${arrowHeadY - 8} 4,${arrowHeadY - 8}`
                  } 
                  fill={s.stairArrowFill} 
                />
                <circle cx={0} cy={startY} r={2.5} fill={s.stairArrowFill} />
              </>
            )}
            {/* Selection outline */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-h / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={h + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}
          </g>
        );
      }

      case 'elevator': {
        const w = toPx(obj.width);
        const h = toPx(obj.height);
        // Detect freight lift by elevatorType or ID prefix
        const isFreight = obj.elevatorType === 'freight_lift' || obj.id.startsWith('freight_lift');
        const labelText = obj.label || (isFreight ? '貨物EV' : 'EV');
        const labelFontSize = 10;
        const textWidth = labelText.length * 6 + 6;
        const showBadge = obj.showBadge !== false;
        
        const isArchitectural = obj.symbolStyle === 'architectural' || isRef;
        const mainStroke = isArchitectural ? s.elevatorStroke : '#475569';
        const innerStroke = isArchitectural ? s.elevatorInnerStroke : '#94a3b8';
        const diagonalStroke = isArchitectural ? s.elevatorDiagonalStroke : '#cbd5e1';

        return (
          <g 
            key={obj.id} 
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill={obj.fill || 'none'}
              stroke={mainStroke}
              strokeWidth={1.5}
            />
            {/* Elegant double wall effect for elevator shaft: draw an inner rect */}
            <rect
              x={-w / 2 + 3}
              y={-h / 2 + 3}
              width={Math.max(0, w - 6)}
              height={Math.max(0, h - 6)}
              fill="none"
              stroke={innerStroke}
              strokeWidth={1}
            />
            <line x1={-w / 2 + 3} y1={-h / 2 + 3} x2={w / 2 - 3} y2={h / 2 - 3} stroke={diagonalStroke} strokeWidth={1} />
            <line x1={-w / 2 + 3} y1={h / 2 - 3} x2={w / 2 - 3} y2={-h / 2 + 3} stroke={diagonalStroke} strokeWidth={1} />
            
            {/* Center label badge */}
            {showBadge && (
              <rect x={-textWidth/2 - 4} y={-10} width={textWidth + 8} height={20} fill="#ffffff" stroke={mainStroke} strokeWidth={1.2} rx={3} />
            )}
            <text
              fontSize={`${labelFontSize}px`}
              fontWeight="600"
              fontFamily={DEFAULT_FONT_STACK}
              fill={isArchitectural ? s.elevatorText : '#1e293b'}
              textAnchor="middle"
              dominantBaseline="central"
              y={0}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {labelText}
            </text>
            
            {/* Selection outline */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-h / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={h + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}
          </g>
        );
      }

      case 'shape': {
        const stroke = obj.stroke || '#000000';
        const fill = obj.fill || 'none';
        const strokeWidth = obj.strokeWidth ?? 1.5;
        const strokeDasharray = obj.strokeDasharray;
        const opacity = obj.opacity;
        const rotation = obj.rotation ?? 0;
        
        const renderShapeInner = () => {
          switch (obj.shapeType) {
            case 'line': {
              const points = obj.points || [];
              if (points.length < 2) return null;
              return (
                <line
                  x1={toPx(points[0].x)}
                  y1={toPx(points[0].y)}
                  x2={toPx(points[1].x)}
                  y2={toPx(points[1].y)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={opacity}
                />
              );
            }
            case 'rect': {
              const w = toPx(obj.width ?? 0);
              const h = toPx(obj.height ?? 0);
              return (
                <rect
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={opacity}
                />
              );
            }
            case 'circle': {
              const r = toPx(obj.radius ?? 0);
              return (
                <circle
                  cx={0}
                  cy={0}
                  r={r}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={opacity}
                />
              );
            }
            case 'ellipse': {
              const rx = toPx((obj.width ?? 0) / 2);
              const ry = toPx((obj.height ?? 0) / 2);
              return (
                <ellipse
                  cx={0}
                  cy={0}
                  rx={rx}
                  ry={ry}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={opacity}
                />
              );
            }
            case 'polyline': {
              const pointsStr = (obj.points || [])
                .map((p) => `${toPx(p.x)},${toPx(p.y)}`)
                .join(' ');
              return (
                <polyline
                  points={pointsStr}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={opacity}
                />
              );
            }
            case 'polygon': {
              const pointsStr = (obj.points || [])
                .map((p) => `${toPx(p.x)},${toPx(p.y)}`)
                .join(' ');
              return (
                <polygon
                  points={pointsStr}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={opacity}
                />
              );
            }
            default:
              return null;
          }
        };

        const hasCenter = obj.x !== undefined && obj.y !== undefined;
        const transformStr = hasCenter
          ? `translate(${toPx(obj.x!)}, ${toPx(obj.y!)}) rotate(${rotation})`
          : undefined;

        const renderSelectionHighlight = () => {
          if (!isSelected) return null;
          if (hasCenter) {
            const w = toPx(obj.width ?? (obj.radius ? obj.radius * 2 : 100));
            const h = toPx(obj.height ?? (obj.radius ? obj.radius * 2 : 100));
            return (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-h / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={h + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            );
          } else {
            return null;
          }
        };

        return (
          <g
            key={obj.id}
            transform={transformStr}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            {renderShapeInner()}
            {renderSelectionHighlight()}
          </g>
        );
      }

      case 'door': {
        const w = toPx(obj.width);
        const angleDeg = obj.openingAngle ?? 90;
        const alpha = (angleDeg * Math.PI) / 180;
        const isLeft = obj.hingeSide === 'left';
        const isInward = obj.swingDirection === 'inward';

        let hingeX = 0;
        let leafX = 0;
        let leafY = 0;
        let startArcX = 0;
        let sweepFlag = 0;

        if (isLeft) {
          hingeX = 0;
          startArcX = w;
          leafX = w * Math.cos(alpha);
          if (isInward) {
            leafY = -w * Math.sin(alpha);
            sweepFlag = 0;
          } else {
            leafY = w * Math.sin(alpha);
            sweepFlag = 1;
          }
        } else {
          hingeX = w;
          startArcX = 0;
          leafX = w - w * Math.cos(alpha);
          if (isInward) {
            leafY = -w * Math.sin(alpha);
            sweepFlag = 1;
          } else {
            leafY = w * Math.sin(alpha);
            sweepFlag = 0;
          }
        }

        const minX = Math.min(0, leafX);
        const maxX = Math.max(w, leafX);
        const minY = Math.min(0, leafY);
        const maxY = Math.max(0, leafY);

        return (
          <g 
            key={obj.id} 
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            {/* Selection highlight bounding box (drawn under) */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={minX - 4 / zoom}
                y={minY - 4 / zoom}
                width={(maxX - minX) + 8 / zoom}
                height={(maxY - minY) + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}

            <line x1={0} y1={0} x2={w} y2={0} stroke={s.furnitureDetailStroke} strokeWidth={1} strokeDasharray="2 2" />
            <line x1={hingeX} y1={0} x2={leafX} y2={leafY} stroke={obj.stroke || s.doorStroke} strokeWidth={2.5} />
            <path
              d={`M ${startArcX} 0 A ${w} ${w} 0 0 ${sweepFlag} ${leafX} ${leafY}`}
              fill="none"
              stroke={obj.stroke || s.doorSwingStroke}
              strokeWidth={1.2}
              strokeDasharray={isRef ? undefined : "3 3"}
            />
          </g>
        );
      }

      case 'window': {
        const w = toPx(obj.width);
        const thick = toPx(obj.thickness || 200);
        const isOpening = obj.style === 'opening';
        
        return (
          <g 
            key={obj.id} 
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            <rect x={-w / 2} y={-thick / 2} width={w} height={thick} fill={s.windowGlassFill} stroke={s.windowStroke} strokeWidth={1} />
            <line x1={-w / 2} y1={-thick * 0.25} x2={w / 2} y2={-thick * 0.25} stroke={s.windowGlassStroke} strokeWidth={1.5} />
            <line x1={-w / 2} y1={thick * 0.25} x2={w / 2} y2={thick * 0.25} stroke={s.windowGlassStroke} strokeWidth={1.5} />
            <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={isRef ? s.windowGlassStroke : '#93c5fd'} strokeWidth={1} />

            {isOpening && (() => {
              const angleDegSwing = 45;
              const alpha = (angleDegSwing * Math.PI) / 180;
              const hingeX = -w / 2;
              const leafX = -w / 2 + w * Math.cos(alpha);
              const leafY = -w * Math.sin(alpha);
              const sweepFlag = 0; // outward swing
              const startArcX = w / 2;

              return (
                <>
                  <line x1={hingeX} y1={0} x2={leafX} y2={leafY} stroke={(obj as any).stroke || s.windowStroke} strokeWidth={2.5} />
                  <path
                    d={`M ${startArcX} 0 A ${w} ${w} 0 0 ${sweepFlag} ${leafX} ${leafY}`}
                    fill="none"
                    stroke={(obj as any).stroke || s.doorSwingStroke}
                    strokeWidth={1.2}
                    strokeDasharray={isRef ? undefined : "3 3"}
                  />
                </>
              );
            })()}
            
            {/* Selection outline */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-thick / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={thick + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}
          </g>
        );
      }

      case 'dimension': {
        const dx = obj.x2 - obj.x1;
        const dy = obj.y2 - obj.y1;
        const len = getDimensionLengthMm(obj);
        if (len === 0) return null;

        const nx = -dy / len;
        const ny = dx / len;

        const rx1 = obj.x1 + nx * obj.offset;
        const ry1 = obj.y1 + ny * obj.offset;
        const rx2 = obj.x2 + nx * obj.offset;
        const ry2 = obj.y2 + ny * obj.offset;

        const px1 = toPx(rx1);
        const py1 = toPx(ry1);
        const px2 = toPx(rx2);
        const py2 = toPx(ry2);

        const extX1Start = toPx(obj.x1 + nx * (obj.offset > 0 ? 100 : -100));
        const extY1Start = toPx(obj.y1 + ny * (obj.offset > 0 ? 100 : -100));
        const extX2Start = toPx(obj.x2 + nx * (obj.offset > 0 ? 100 : -100));
        const extY2Start = toPx(obj.y2 + ny * (obj.offset > 0 ? 100 : -100));

        const midX = (px1 + px2) / 2;
        const midY = (py1 + py2) / 2;

        const labelMode = obj.labelMode || (obj.textOverride || obj.displayText ? 'manual' : 'auto');
        const textVal = labelMode === 'manual'
          ? (obj.displayText || formatDimensionLabel(len, 'auto'))
          : formatDimensionLabel(len, labelMode);

        const fontSize = getDimensionLabelFinalFontSizePx(obj, scale.pixelsPerUnit);
        const rectW = textVal.length * fontSize * 0.65 + 6;
        const rectH = fontSize * 1.3 + 2;

        const angleRad = Math.atan2(dy, dx);
        let angleDeg = angleRad * (180 / Math.PI);
        if (angleDeg > 90 || angleDeg < -90) {
          angleDeg += 180;
        }

        const tickSize = 6;
        const ux = dx / len;
        const uy = dy / len;
        const tx = (ux - nx) * tickSize;
        const ty = (uy - ny) * tickSize;

        return (
          <g key={obj.id} onPointerDown={(e) => handlePointerDown(e, obj)} style={{ cursor: obj.locked ? 'pointer' : 'move' }}>
            {/* Selection highlight line */}
            {isSelected && (
              <line className="selection-highlight" x1={px1} y1={py1} x2={px2} y2={py2} stroke="#3b82f6" strokeWidth={6} strokeOpacity={0.4} />
            )}

            <line x1={extX1Start} y1={extY1Start} x2={px1 + nx * toPx(150)} y2={py1 + ny * toPx(150)} stroke={s.dimensionExtensionStroke} strokeWidth={1} strokeDasharray="3 3" />
            <line x1={extX2Start} y1={extY2Start} x2={px2 + nx * toPx(150)} y2={py2 + ny * toPx(150)} stroke={s.dimensionExtensionStroke} strokeWidth={1} strokeDasharray="3 3" />
            <line x1={px1} y1={py1} x2={px2} y2={py2} stroke={s.dimensionStroke} strokeWidth={1} strokeDasharray={isRef ? "3 3" : undefined} />
            {isRef ? (
              <>
                <line x1={px1 - nx * 8} y1={py1 - ny * 8} x2={px1 + nx * 8} y2={py1 + ny * 8} stroke={s.dimensionStroke} strokeWidth={1.5} />
                <line x1={px2 - nx * 8} y1={py2 - ny * 8} x2={px2 + nx * 8} y2={py2 + ny * 8} stroke={s.dimensionStroke} strokeWidth={1.5} />
              </>
            ) : (
              <>
                <line x1={px1 - tx} y1={py1 - ty} x2={px1 + tx} y2={py1 + ty} stroke={s.dimensionStroke} strokeWidth={1.5} />
                <line x1={px2 - tx} y1={py2 - ty} x2={px2 + tx} y2={py2 + ty} stroke={s.dimensionStroke} strokeWidth={1.5} />
              </>
            )}

            <g transform={`translate(${midX}, ${midY})`}>
              <rect x={-rectW / 2} y={-rectH / 2} width={rectW} height={rectH} fill="#ffffff" opacity={0.9} />
              <text
                fontSize={`${fontSize}px`}
                fontFamily={DEFAULT_FONT_STACK}
                fontWeight="500"
                fill={s.labelFill}
                textAnchor="middle"
                dominantBaseline="middle"
                y={-0.5}
              >
                {textVal}
              </text>
            </g>
          </g>
        );
      }

      case 'room': {
        const w = toPx(obj.width);
        const h = toPx(obj.height);
        const walls = obj.walls || {
          top: { visible: true, thickness: 180, style: 'exterior' },
          right: { visible: true, thickness: 180, style: 'exterior' },
          bottom: { visible: true, thickness: 180, style: 'exterior' },
          left: { visible: true, thickness: 180, style: 'exterior' },
        };
        const openings = obj.openings || [];

        const getWallStyle = (wallConfig: any) => {
          const thickness = toPx(wallConfig.thickness);
          let strokeColor = s.outerWallStroke;
          let isGuide = false;

          if (wallConfig.style === 'interior') {
            strokeColor = s.innerWallStroke;
          } else if (wallConfig.style === 'guide') {
            strokeColor = s.hiddenStroke;
            isGuide = true;
          }
          if (wallConfig.stroke) {
            strokeColor = wallConfig.stroke;
          }
          return { thickness, strokeColor, isGuide };
        };

        const drawWall = (
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          config?: typeof obj.walls.top
        ) => {
          if (!config || config.visible === false) return null;
          const { thickness, strokeColor, isGuide } = getWallStyle(config);
          return (
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeWidth={thickness}
              strokeLinecap="square"
              strokeDasharray={isGuide ? '4 4' : undefined}
            />
          );
        };

        // Local clockwise wall segment coordinates relative to center (0,0)
        // Values in real mm
        const wallCoords = {
          top: { x1: -obj.width / 2, y1: -obj.height / 2, x2: obj.width / 2, y2: -obj.height / 2, dx: 1, dy: 0, length: obj.width },
          right: { x1: obj.width / 2, y1: -obj.height / 2, x2: obj.width / 2, y2: obj.height / 2, dx: 0, dy: 1, length: obj.height },
          bottom: { x1: obj.width / 2, y1: obj.height / 2, x2: -obj.width / 2, y2: obj.height / 2, dx: -1, dy: 0, length: obj.width },
          left: { x1: -obj.width / 2, y1: obj.height / 2, x2: -obj.width / 2, y2: -obj.height / 2, dx: 0, dy: -1, length: obj.height },
        };

        const drawOpeningGaps = () => {
          return openings.map((op) => {
            const wallKey = op.wall;
            const wallConf = walls[wallKey];
            if (!wallConf || wallConf.visible === false) return null;

            const wCoord = wallCoords[wallKey];
            const opX1 = wCoord.x1 + wCoord.dx * op.offset;
            const opY1 = wCoord.y1 + wCoord.dy * op.offset;
            const opX2 = wCoord.x1 + wCoord.dx * (op.offset + op.width);
            const opY2 = wCoord.y1 + wCoord.dy * (op.offset + op.width);

            // Draw slightly thicker white masking line to block out wall line
            const thickness = toPx(wallConf.thickness) + 2;

            return (
              <line
                key={`gap_${op.id}`}
                x1={toPx(opX1)}
                y1={toPx(opY1)}
                x2={toPx(opX2)}
                y2={toPx(opY2)}
                stroke="#ffffff"
                strokeWidth={thickness}
                strokeLinecap="square"
              />
            );
          });
        };

        const renderOpenings = () => {
          return openings.map((op) => {
            const wallKey = op.wall;
            const wallConf = walls[wallKey];
            if (!wallConf || wallConf.visible === false) return null;

            const wCoord = wallCoords[wallKey];
            const opX1 = wCoord.x1 + wCoord.dx * op.offset;
            const opY1 = wCoord.y1 + wCoord.dy * op.offset;

            const opW = toPx(op.width);
            const angleRad = Math.atan2(wCoord.dy, wCoord.dx);
            const angleDeg = angleRad * (180 / Math.PI);
            const thick = toPx(wallConf.thickness);

            return (
              <g
                key={`op_${op.id}`}
                transform={`translate(${toPx(opX1)}, ${toPx(opY1)}) rotate(${angleDeg})`}
              >
                {op.type === 'door' && (() => {
                  const angleDegSwing = op.openingAngle ?? 90;
                  const alpha = (angleDegSwing * Math.PI) / 180;
                  const isLeft = op.hingeSide !== 'right';
                  const isInward = op.swingDirection !== 'outward';

                  let hingeX = 0;
                  let leafX = 0;
                  let leafY = 0;
                  let startArcX = 0;
                  let sweepFlag = 0;

                  if (isLeft) {
                    hingeX = 0;
                    startArcX = opW;
                    leafX = opW * Math.cos(alpha);
                    if (isInward) {
                      leafY = opW * Math.sin(alpha);
                      sweepFlag = 1;
                    } else {
                      leafY = -opW * Math.sin(alpha);
                      sweepFlag = 0;
                    }
                  } else {
                    hingeX = opW;
                    startArcX = 0;
                    leafX = opW - opW * Math.cos(alpha);
                    if (isInward) {
                      leafY = opW * Math.sin(alpha);
                      sweepFlag = 0;
                    } else {
                      leafY = -opW * Math.sin(alpha);
                      sweepFlag = 1;
                    }
                  }

                  return (
                    <g>
                      <line x1={0} y1={0} x2={opW} y2={0} stroke={s.furnitureDetailStroke} strokeWidth={1} strokeDasharray="2 2" />
                      <line x1={hingeX} y1={0} x2={leafX} y2={leafY} stroke={s.doorStroke} strokeWidth={2.5} />
                      <path
                        d={`M ${startArcX} 0 A ${opW} ${opW} 0 0 ${sweepFlag} ${leafX} ${leafY}`}
                        fill="none"
                        stroke={s.doorSwingStroke}
                        strokeWidth={1.2}
                        strokeDasharray={isRef ? undefined : "3 3"}
                      />
                    </g>
                  );
                })()}

                {op.type === 'window' && (
                  <g>
                    <rect x={0} y={-thick / 2} width={opW} height={thick} fill={s.windowGlassFill} stroke={s.windowStroke} strokeWidth={1} />
                    <line x1={0} y1={-thick * 0.25} x2={opW} y2={-thick * 0.25} stroke={s.windowGlassStroke} strokeWidth={1.5} />
                    <line x1={0} y1={thick * 0.25} x2={opW} y2={thick * 0.25} stroke={s.windowGlassStroke} strokeWidth={1.5} />
                    <line x1={0} y1={0} x2={opW} y2={0} stroke={isRef ? s.windowGlassStroke : '#93c5fd'} strokeWidth={1} />
                  </g>
                )}

                {op.type === 'opening_window' && (() => {
                  const isLeft = op.hingeSide !== 'right';
                  const isInward = op.swingDirection !== 'outward';
                  const angleDegSwing = op.openingAngle ?? 45;
                  const alpha = (angleDegSwing * Math.PI) / 180;
                  
                  let hingeX = 0;
                  let leafX = 0;
                  let leafY = 0;
                  let startArcX = 0;
                  let sweepFlag = 0;

                  if (isLeft) {
                    hingeX = 0;
                    startArcX = opW;
                    leafX = opW * Math.cos(alpha);
                    if (isInward) {
                      leafY = opW * Math.sin(alpha);
                      sweepFlag = 1;
                    } else {
                      leafY = -opW * Math.sin(alpha);
                      sweepFlag = 0;
                    }
                  } else {
                    hingeX = opW;
                    startArcX = 0;
                    leafX = opW - opW * Math.cos(alpha);
                    if (isInward) {
                      leafY = opW * Math.sin(alpha);
                      sweepFlag = 0;
                    } else {
                      leafY = -opW * Math.sin(alpha);
                      sweepFlag = 1;
                    }
                  }

                  return (
                    <g>
                      <rect x={0} y={-thick / 2} width={opW} height={thick} fill={s.windowGlassFill} stroke={s.windowStroke} strokeWidth={1} />
                      <line x1={0} y1={-thick * 0.25} x2={opW} y2={-thick * 0.25} stroke={s.windowGlassStroke} strokeWidth={1.5} />
                      <line x1={0} y1={thick * 0.25} x2={opW} y2={thick * 0.25} stroke={s.windowGlassStroke} strokeWidth={1.5} />
                      <line x1={0} y1={0} x2={opW} y2={0} stroke={isRef ? s.windowGlassStroke : '#93c5fd'} strokeWidth={1} />
                      <line x1={hingeX} y1={0} x2={leafX} y2={leafY} stroke={s.windowStroke} strokeWidth={2.5} />
                      <path
                        d={`M ${startArcX} 0 A ${opW} ${opW} 0 0 ${sweepFlag} ${leafX} ${leafY}`}
                        fill="none"
                        stroke={s.doorSwingStroke}
                        strokeWidth={1.2}
                        strokeDasharray={isRef ? undefined : "3 3"}
                      />
                    </g>
                  );
                })()}

                {op.type === 'opening' && (
                  <g>
                    <line x1={0} y1={0} x2={opW} y2={0} stroke={s.furnitureDetailStroke} strokeWidth={1.2} strokeDasharray="3 3" />
                    <line x1={0} y1={-thick / 2} x2={0} y2={thick / 2} stroke={s.outerWallStroke} strokeWidth={1.2} />
                    <line x1={opW} y1={-thick / 2} x2={opW} y2={thick / 2} stroke={s.outerWallStroke} strokeWidth={1.2} />
                  </g>
                )}
              </g>
            );
          });
        };

        const renderInteractiveEdges = () => {
          if (!isSelected) return null;

          return ((['top', 'right', 'bottom', 'left'] as const)).map((side) => {
            const wCoord = wallCoords[side];
            const px1 = toPx(wCoord.x1);
            const py1 = toPx(wCoord.y1);
            const px2 = toPx(wCoord.x2);
            const py2 = toPx(wCoord.y2);

            const isSideSelected = selectedRoomSide?.roomId === obj.id && selectedRoomSide?.side === side;

            return (
              <g key={`edge_${side}`}>
                {/* Visual Highlight on Hover/Select: drawn with thick stroke */}
                <line
                  x1={px1}
                  y1={py1}
                  x2={px2}
                  y2={py2}
                  stroke="#3b82f6"
                  strokeWidth={14}
                  strokeOpacity={isSideSelected ? 0.35 : 0}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSideSelected) {
                      e.currentTarget.setAttribute('stroke-opacity', '0.15');
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSideSelected) {
                      e.currentTarget.setAttribute('stroke-opacity', '0');
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRoomSide({ roomId: obj.id, side });
                  }}
                />

                {/* Thin dashed blue centerline showing the select state */}
                {isSideSelected && (
                  <line
                    x1={px1}
                    y1={py1}
                    x2={px2}
                    y2={py2}
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          });
        };

        const renderFloatingToolbar = () => {
          if (!isSelected || selectedRoomSide?.roomId !== obj.id) return null;

          const side = selectedRoomSide.side;
          let mx = 0;
          let my = 0;
          let nx = 0;
          let ny = 0;

          if (side === 'top') {
            mx = 0;
            my = -h / 2;
            nx = 0;
            ny = -1;
          } else if (side === 'right') {
            mx = w / 2;
            my = 0;
            nx = 1;
            ny = 0;
          } else if (side === 'bottom') {
            mx = 0;
            my = h / 2;
            nx = 0;
            ny = 1;
          } else if (side === 'left') {
            mx = -w / 2;
            my = 0;
            nx = -1;
            ny = 0;
          }

          const offsetDist = 45;
          const tx = mx + nx * offsetDist;
          const ty = my + ny * offsetDist;

          const tbWidth = 160;
          const tbHeight = 36;

          return (
            <g className="room-wall-controls-overlay" transform={`translate(${tx}, ${ty}) rotate(${-obj.rotation})`}>
              <foreignObject
                x={-tbWidth / 2}
                y={-tbHeight / 2}
                width={tbWidth}
                height={tbHeight}
                style={{ overflow: 'visible', pointerEvents: 'auto' }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    padding: '3px',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title={t('canvas.addDoor')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      const wallLen = side === 'top' || side === 'bottom' ? obj.width : obj.height;
                      const newOp: any = {
                        id: `op_${Date.now()}`,
                        type: 'door',
                        wall: side,
                        offset: Math.round(wallLen / 2 - 450),
                        width: 900,
                        hingeSide: 'left',
                        swingDirection: 'inward',
                        openingAngle: 90,
                      };
                      updateObject(obj.id, { openings: [...openings, newOp] });
                    }}
                  >
                    <Icons.DoorIcon size={14} />
                  </button>

                  <button
                    title={t('canvas.addWindow')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      const wallLen = side === 'top' || side === 'bottom' ? obj.width : obj.height;
                      const newOp: any = {
                        id: `op_${Date.now()}`,
                        type: 'window',
                        wall: side,
                        offset: Math.round(wallLen / 2 - 600),
                        width: 1200,
                      };
                      updateObject(obj.id, { openings: [...openings, newOp] });
                    }}
                  >
                    <Icons.WindowIcon size={14} />
                  </button>

                  <button
                    title={walls[side]?.visible !== false ? t('canvas.hideWall') : t('canvas.showWall')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      const updatedWalls = {
                        ...walls,
                        [side]: {
                          ...walls[side],
                          visible: walls[side]?.visible === false,
                        },
                      };
                      updateObject(obj.id, { walls: updatedWalls });
                    }}
                  >
                    {walls[side]?.visible !== false ? <Icons.EyeClosedIcon size={14} /> : <Icons.EyeIcon size={14} />}
                  </button>

                  <button
                    title={t('canvas.toggleWallStyle')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      color: '#475569',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      const nextStyle = walls[side]?.style === 'exterior' ? 'interior' : 'exterior';
                      const updatedWalls = {
                        ...walls,
                        [side]: {
                          ...walls[side],
                          style: nextStyle,
                        },
                      };
                      updateObject(obj.id, { walls: updatedWalls });
                    }}
                  >
                    <Icons.WallIcon size={14} />
                  </button>
                </div>
              </foreignObject>
            </g>
          );
        };

        const lx = obj.labelX !== undefined ? toPx(obj.labelX) : 0;
        const ly = obj.labelY !== undefined ? toPx(obj.labelY) : 0;

        return (
          <g
            key={obj.id}
            className="room-element"
            transform={`translate(${toPx(obj.x)}, ${toPx(obj.y)}) rotate(${obj.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, obj)}
            style={{ cursor: obj.locked ? 'pointer' : 'move' }}
          >
            {/* Clickable Area and Optional Fill */}
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill={obj.fill && obj.fill !== 'none' && obj.fill !== 'transparent'
                ? obj.fill
                : (isRef ? '#ffffff' : (obj.fill || 'rgba(255, 255, 255, 0.001)'))}
              stroke="none"
            />

            {/* Selection highlight (drawn under) */}
            {isSelected && (
              <rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                fill="rgba(59, 130, 246, 0.04)"
                stroke="none"
              />
            )}

            {/* Draw visible wall sides */}
            {drawWall(-w / 2, -h / 2, w / 2, -h / 2, walls.top)}
            {drawWall(w / 2, -h / 2, w / 2, h / 2, walls.right)}
            {drawWall(w / 2, h / 2, -w / 2, h / 2, walls.bottom)}
            {drawWall(-w / 2, h / 2, -w / 2, -h / 2, walls.left)}

            {/* Masking Gaps for openings */}
            {drawOpeningGaps()}

            {/* Render openings (doors, windows, etc.) */}
            {renderOpenings()}

            {obj.showLabel && (() => {
              const fontSize = getRoomLabelFinalFontSizePx(obj, scale.pixelsPerUnit);
              const line1 = obj.name;
              const mode = obj.areaLabelMode || (obj.areaLabel !== undefined ? 'manual' : 'auto');
              const renderedAreaLabel = mode === 'auto'
                ? getRoomAutoAreaLabel(obj)
                : (obj.areaLabel ?? '');
              const line2 = renderedAreaLabel && renderedAreaLabel.trim() !== '' ? renderedAreaLabel : null;

              const counterTransform = `translate(${lx}, ${ly}) rotate(${-obj.rotation}) translate(${-lx}, ${-ly})`;

              if (line2) {
                return (
                  <g transform={counterTransform}>
                    <text
                      x={lx}
                      y={ly}
                      fontSize={`${fontSize}px`}
                      fontFamily={DEFAULT_FONT_STACK}
                      fontWeight="500"
                      fill={s.labelFill}
                      textAnchor="middle"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      <tspan x={lx} dy="-0.35em">{line1}</tspan>
                      <tspan x={lx} dy="1.2em">{line2}</tspan>
                    </text>
                  </g>
                );
              } else {
                return (
                  <g transform={counterTransform}>
                    <text
                      x={lx}
                      y={ly}
                      fontSize={`${fontSize}px`}
                      fontFamily={DEFAULT_FONT_STACK}
                      fontWeight="500"
                      fill={s.labelFill}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {line1}
                    </text>
                  </g>
                );
              }
            })()}

            {/* Selection outline */}
            {isSelected && (
              <rect
                className="selection-outline"
                x={-w / 2 - 4 / zoom}
                y={-h / 2 - 4 / zoom}
                width={w + 8 / zoom}
                height={h + 8 / zoom}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              />
            )}

            {/* Interactive Edges (hover & click) */}
            {renderInteractiveEdges()}

            {/* Floating Toolbar */}
            {renderFloatingToolbar()}
          </g>
        );
      }

      case 'background': {
        const bg = obj;
        const w = toPx(bg.width);
        const h = toPx(bg.height);
        const isSelected = selectedIds.includes(bg.id);

        return (
          <g 
            key={bg.id} 
            className="background-element"
            transform={`translate(${toPx(bg.x)}, ${toPx(bg.y)}) rotate(${bg.rotation})`}
            onPointerDown={(e) => handlePointerDown(e, bg)}
            style={{ cursor: bg.locked ? 'default' : 'move' }}
          >
            <image
              href={bg.imageUrl}
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              preserveAspectRatio={bg.lockAspectRatio === false ? 'none' : 'xMidYMid meet'}
              opacity={bg.opacity ?? 0.5}
              style={{ 
                pointerEvents: bg.locked ? 'none' : 'auto',
                userSelect: 'none'
              }}
            />
            
            {/* Show dotted border when selected or when not locked (editable) */}
            {(!bg.locked || isSelected) && (
              <rect
                className="background-border"
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                fill="none"
                stroke={isSelected ? "#3b82f6" : "#64748b"}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}
          </g>
        );
      }

      default:
        return null;
    }
  };

  const renderObject = (obj: MapObject) => {
    // Skip if the layer is hidden or object is invisible
    if (obj.layerId && layerVisibility[obj.layerId] === false) return null;
    if (obj.visible === false) return null;

    const isSelected = selectedIds.includes(obj.id);
    const isLayerLocked = !!(obj.layerId && layerLocked[obj.layerId]);

    const element = renderObjectInner(obj, isSelected);
    if (!element) return null;

    const isPanToolActive = activeTool === 'pan';

    return (
      <g key={obj.id} style={{ pointerEvents: (isLayerLocked || isPanToolActive) ? 'none' : 'auto' }}>
        {element}
      </g>
    );
  };

  const backgroundObjects = objects.filter((obj) => obj.type === 'background');
  const otherObjects = objects.filter((obj) => obj.type !== 'background');

  const pixelSize = getPaperPixelSize(canvasConfig, scale);
  const widthPx = pixelSize.width;
  const heightPx = pixelSize.height;

  return (
    <>
      {/* Page Border / Frame — single outer page edge only (no inner margin
          guide rectangle). */}
      {isRef && (
        <g className="page-border" style={{ pointerEvents: 'none' }}>
          <rect
            x={0}
            y={0}
            width={widthPx}
            height={heightPx}
            fill="none"
            stroke={s.pageBorder}
            strokeWidth={1}
          />
        </g>
      )}
      {backgroundObjects.map(renderObject)}
      {otherObjects.map(renderObject)}
      <SelectionOverlay />

      {/* Snap Guides */}
      {snapGuides.map((guide, idx) => {
        if (guide.type === 'point') {
          return (
            <circle
              key={`snap-guide-${idx}`}
              className="snap-guide"
              cx={toPx(guide.x1)}
              cy={toPx(guide.y1)}
              r={6 / zoom}
              fill="none"
              stroke={guide.color || "#10b981"}
              strokeWidth={1.5 / zoom}
              style={{ pointerEvents: 'none' }}
            />
          );
        }
        return (
          <line
            key={`snap-guide-${idx}`}
            className="snap-guide"
            x1={toPx(guide.x1)}
            y1={toPx(guide.y1)}
            x2={toPx(guide.x2)}
            y2={toPx(guide.y2)}
            stroke={guide.color || "#10b981"}
            strokeWidth={1.5 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}
    </>
  );
};
export default SvgCanvas;
