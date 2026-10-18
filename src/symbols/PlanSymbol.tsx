import React from 'react';
import { isPlanSymbolId, resolveSymbolId, type PlanSymbolId } from './symbolMetadata';

export interface PlanSymbolProps {
  symbolId: string;
  width: number;
  height: number;
  stroke?: string;
  fill?: string;
  detailStroke?: string;
  className?: string;
}

/**
 * Symbol geometry is authored inside a fixed 96x96 box (-48..48 on each axis). PlanSymbolRenderer
 * then scales that box independently on x/y by the object's real width/height, so the rendered
 * aspect ratio stays true to the object's actual footprint. Strokes use non-scaling-stroke so line
 * weights stay constant regardless of that scale.
 *
 * These are the original (pre-"floating controls") furniture glyphs: filled backrests/cushions,
 * a five-star office chair, tucked chairs around tables, etc.
 */

const ns = { vectorEffect: 'non-scaling-stroke' as const };

export const PlanSymbolRenderer: React.FC<PlanSymbolProps> = ({
  symbolId,
  width,
  height,
  stroke = '#1e293b',
  fill = 'none',
  detailStroke = '#94a3b8',
  className,
}) => {
  const resolvedSymbolId = resolveSymbolId(symbolId);
  const id: PlanSymbolId | 'fallback' = isPlanSymbolId(resolvedSymbolId) ? (resolvedSymbolId as PlanSymbolId) : 'fallback';
  const sx = width / 100;
  const sy = height / 100;

  // Author every glyph in a fixed 96x96 box so the outer scale transform controls real size.
  const w = 96;
  const h = 96;
  const detail = detailStroke;
  // Very light gray used to fill "solid" detail parts (backrests, cushions, pillows, panels)
  // so they read as filled without the heavy dark look.
  const softFill = '#eceef2';

  const body = (() => {
    switch (id) {
      case 'whiteboard':
        return (
          <g className="symbol-whiteboard">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} {...ns} />
            <line x1={-w / 2} y1={-h / 2 - 4} x2={-w / 2} y2={h / 2 + 4} stroke={stroke} strokeWidth={2.5} {...ns} />
            <line x1={w / 2} y1={-h / 2 - 4} x2={w / 2} y2={h / 2 + 4} stroke={stroke} strokeWidth={2.5} {...ns} />
            <line x1={-w * 0.45} y1={h * 0.3} x2={w * 0.45} y2={h * 0.3} stroke={detail} strokeWidth={1} {...ns} />
          </g>
        );

      case 'table':
        return (
          <g className="symbol-table">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            <line x1={-w * 0.4} y1={-h * 0.3} x2={-w * 0.4} y2={h * 0.3} stroke={detail} strokeWidth={1} {...ns} />
            <line x1={w * 0.4} y1={-h * 0.3} x2={w * 0.4} y2={h * 0.3} stroke={detail} strokeWidth={1} {...ns} />
          </g>
        );

      case 'vehicle_outline':
        return (
          <g className="symbol-vehicle-outline">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" rx={4} {...ns} />
            <circle cx={-w * 0.25} cy={-h * 0.25} r={w * 0.1} fill="none" stroke="#94a3b8" strokeWidth={1.2} {...ns} />
            <circle cx={w * 0.25} cy={-h * 0.25} r={w * 0.1} fill="none" stroke="#94a3b8" strokeWidth={1.2} {...ns} />
            <circle cx={-w * 0.25} cy={h * 0.25} r={w * 0.1} fill="none" stroke="#94a3b8" strokeWidth={1.2} {...ns} />
            <circle cx={w * 0.25} cy={h * 0.25} r={w * 0.1} fill="none" stroke="#94a3b8" strokeWidth={1.2} {...ns} />
          </g>
        );

      case 'chair':
        return (
          <g className="symbol-chair">
            {/* Backrest */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.25} fill={softFill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            {/* Seat */}
            <rect x={-w * 0.45} y={-h * 0.2} width={w * 0.9} height={h * 0.7} fill={fill} stroke={stroke} strokeWidth={1.5} rx={4} {...ns} />
          </g>
        );

      case 'office_chair':
        return (
          <g className="symbol-office-chair">
            {/* Armrests */}
            <rect x={-w * 0.48} y={-h * 0.15} width={w * 0.12} height={h * 0.55} fill={softFill} stroke={stroke} strokeWidth={1.2} rx={2} {...ns} />
            <rect x={w * 0.36} y={-h * 0.15} width={w * 0.12} height={h * 0.55} fill={softFill} stroke={stroke} strokeWidth={1.2} rx={2} {...ns} />
            {/* Seat Cushion */}
            <rect x={-w * 0.36} y={-h * 0.3} width={w * 0.72} height={h * 0.7} fill={fill} stroke={stroke} strokeWidth={1.5} rx={5} {...ns} />
            {/* Backrest */}
            <rect x={-w * 0.3} y={-h * 0.46} width={w * 0.6} height={h * 0.18} fill={softFill} stroke={stroke} strokeWidth={1.5} rx={3} {...ns} />
          </g>
        );

      case 'student_desk':
        return (
          <g className="symbol-student-desk">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            {/* Draw a subtle pencil tray line */}
            <line x1={-w * 0.3} y1={-h * 0.3} x2={w * 0.3} y2={-h * 0.3} stroke={detail} strokeWidth={1.2} {...ns} />
          </g>
        );

      case 'teacher_desk':
        return (
          <g className="symbol-teacher-desk">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            {/* Draw modesty panel on top side and drawers inside */}
            <rect x={-w * 0.4} y={-h * 0.4} width={w * 0.8} height={h * 0.12} fill={softFill} stroke={stroke} strokeWidth={1} {...ns} />
            <rect x={-w * 0.45} y={-h * 0.2} width={w * 0.2} height={h * 0.6} fill="none" stroke={detail} strokeWidth={1} {...ns} />
            <rect x={w * 0.25} y={-h * 0.2} width={w * 0.2} height={h * 0.6} fill="none" stroke={detail} strokeWidth={1} {...ns} />
          </g>
        );

      case 'desk_with_chair': {
        const deskH = h * 0.65;
        const chairW = w * 0.65;
        const chairH = h * 0.45;
        const chairY = h / 2 - chairH / 2; // tucked chair
        return (
          <g className="symbol-desk-with-chair">
            {/* Desk Outline */}
            <rect x={-w / 2} y={-h / 2} width={w} height={deskH} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            <line x1={-w * 0.3} y1={-h / 2 + deskH * 0.2} x2={w * 0.3} y2={-h / 2 + deskH * 0.2} stroke={detail} strokeWidth={1.2} {...ns} />
            {/* Tucked Chair — occupant faces the desk, so the backrest is on the far side
                (bottom, away from the desk) and the seat sits toward the desk. */}
            <g transform={`translate(0, ${chairY - 15})`}>
              {/* Chair Seat (toward the desk) */}
              <rect x={-chairW * 0.45} y={-chairH / 2} width={chairW * 0.9} height={chairH * 0.75} fill={fill} stroke={stroke} strokeWidth={1.2} rx={3} {...ns} />
              {/* Chair Back (far side, away from the desk) */}
              <rect x={-chairW / 2} y={chairH * 0.25} width={chairW} height={chairH * 0.25} fill={softFill} stroke={stroke} strokeWidth={1.2} rx={1} {...ns} />
            </g>
          </g>
        );
      }

      case 'sofa':
        return (
          <g className="symbol-sofa">
            {/* Sofa frame */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={6} {...ns} />
            {/* Back cushion */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.22} fill={softFill} stroke={stroke} strokeWidth={1} rx={2} {...ns} />
            {/* Left Armrest */}
            <rect x={-w / 2} y={-h / 2} width={w * 0.12} height={h} fill={softFill} stroke={stroke} strokeWidth={1} rx={2} {...ns} />
            {/* Right Armrest */}
            <rect x={w / 2 - w * 0.12} y={-h / 2} width={w * 0.12} height={h} fill={softFill} stroke={stroke} strokeWidth={1} rx={2} {...ns} />
            {/* Cushion splits */}
            <line x1={-w * 0.12} y1={-h * 0.25} x2={-w * 0.12} y2={h / 2} stroke={stroke} strokeWidth={1} {...ns} />
            <line x1={w * 0.12} y1={-h * 0.25} x2={w * 0.12} y2={h / 2} stroke={stroke} strokeWidth={1} {...ns} />
          </g>
        );

      case 'armchair':
        return (
          <g className="symbol-armchair">
            {/* Plush single chair frame */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={6} {...ns} />
            {/* Backrest */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.24} fill={softFill} stroke={stroke} strokeWidth={1} rx={2} {...ns} />
            {/* Left Armrest */}
            <rect x={-w / 2} y={-h / 2} width={w * 0.22} height={h} fill={softFill} stroke={stroke} strokeWidth={1} rx={2} {...ns} />
            {/* Right Armrest */}
            <rect x={w / 2 - w * 0.22} y={-h / 2} width={w * 0.22} height={h} fill={softFill} stroke={stroke} strokeWidth={1} rx={2} {...ns} />
            {/* Seat Cushion */}
            <rect x={-w * 0.24} y={-h * 0.22} width={w * 0.48} height={h * 0.68} fill={fill} stroke={stroke} strokeWidth={1} rx={3} {...ns} />
          </g>
        );

      case 'cabinet':
        return (
          <g className="symbol-cabinet">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            {/* Cabinet diagonal indicator */}
            <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} stroke={detail} strokeWidth={1.2} {...ns} />
            <line x1={-w / 2} y1={h / 2} x2={w / 2} y2={-h / 2} stroke={detail} strokeWidth={1.2} {...ns} />
          </g>
        );

      case 'closet':
        return (
          <g className="symbol-closet">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            {/* Two doors split down the middle */}
            <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke={stroke} strokeWidth={1.2} {...ns} />
            {/* Door handles */}
            <circle cx={-w * 0.06} cy={0} r={2.5} fill={softFill} stroke={stroke} strokeWidth={1} {...ns} />
            <circle cx={w * 0.06} cy={0} r={2.5} fill={softFill} stroke={stroke} strokeWidth={1} {...ns} />
          </g>
        );

      case 'shelf':
        return (
          <g className="symbol-shelf">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} {...ns} />
            {/* Parallel shelf rows */}
            <line x1={-w / 2} y1={-h * 0.18} x2={w / 2} y2={-h * 0.18} stroke={stroke} strokeWidth={1} {...ns} />
            <line x1={-w / 2} y1={h * 0.18} x2={w / 2} y2={h * 0.18} stroke={stroke} strokeWidth={1} {...ns} />
          </g>
        );

      case 'locker':
        return (
          <g className="symbol-locker">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} {...ns} />
            {/* Vertical locker columns */}
            {[-w * 0.25, 0, w * 0.25].map((cx) => (
              <line key={cx} x1={cx} y1={-h / 2} x2={cx} y2={h / 2} stroke={stroke} strokeWidth={1} {...ns} />
            ))}
            {/* Handles */}
            {[-w * 0.375, -w * 0.125, w * 0.125, w * 0.375].map((cx) => (
              <circle key={cx} cx={cx} cy={h * 0.05} r={2} fill={softFill} stroke={stroke} strokeWidth={0.8} {...ns} />
            ))}
          </g>
        );

      case 'bed':
        return (
          <g className="symbol-bed">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={4} {...ns} />
            {/* Pillow */}
            <rect x={-w * 0.35} y={-h * 0.44} width={w * 0.7} height={h * 0.28} fill={softFill} stroke={stroke} strokeWidth={1} rx={4} {...ns} />
            {/* Folded duvet line */}
            <line x1={-w / 2} y1={-h * 0.1} x2={w / 2} y2={-h * 0.1} stroke={stroke} strokeWidth={1.2} {...ns} />
          </g>
        );

      case 'toilet': {
        const tankH = h * 0.22;
        const bowlW = w * 0.72;
        const bowlH = (h - tankH) * 0.85;
        const innerW = bowlW * 0.75;
        const innerH = bowlH * 0.75;
        const waterW = innerW * 0.6;
        const waterH = innerH * 0.6;
        const bowlCy = -h / 2 + tankH + (h - tankH) / 2;
        return (
          <g className="symbol-toilet">
            {/* Tank */}
            <rect x={-w * 0.42} y={-h / 2} width={w * 0.84} height={tankH} fill={fill} stroke={stroke} strokeWidth={1.5} rx={4} {...ns} />
            {/* Flush button/lever */}
            <circle cx={-w * 0.22} cy={-h / 2 + tankH / 2} r={2} fill={softFill} stroke={stroke} strokeWidth={1} {...ns} />
            <line x1={-w * 0.22 - 3} y1={-h / 2 + tankH / 2} x2={-w * 0.22 + 3} y2={-h / 2 + tankH / 2} stroke={stroke} strokeWidth={1} {...ns} />
            {/* Bowl body */}
            <ellipse cx={0} cy={bowlCy} rx={bowlW / 2} ry={bowlH / 2} fill={fill} stroke={stroke} strokeWidth={1.5} {...ns} />
            {/* Seat outer rim */}
            <ellipse cx={0} cy={bowlCy} rx={innerW / 2} ry={innerH / 2} fill="none" stroke={detail} strokeWidth={1.2} {...ns} />
            {/* Inner water rim */}
            <ellipse cx={0} cy={bowlCy + bowlH * 0.05} rx={waterW / 2} ry={waterH / 2} fill="none" stroke={detail} strokeWidth={1} strokeDasharray="2 2" {...ns} />
            {/* Seat hinge line */}
            <line x1={-w * 0.25} y1={-h / 2 + tankH + 2} x2={w * 0.25} y2={-h / 2 + tankH + 2} stroke={stroke} strokeWidth={1.5} {...ns} />
          </g>
        );
      }

      case 'urinal':
        return (
          <g className="symbol-urinal">
            {/* Urinal body backing against top wall */}
            <path
              d={`M ${-w * 0.42} ${-h / 2} C ${-w * 0.42} ${-h * 0.12}, ${-w * 0.3} ${h / 2}, 0 ${h / 2} C ${w * 0.3} ${h / 2}, ${w * 0.42} ${-h * 0.12}, ${w * 0.42} ${-h / 2} Z`}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
              {...ns}
            />
            {/* Inner rim */}
            <path
              d={`M ${-w * 0.28} ${-h / 2 + 6} C ${-w * 0.28} ${-h * 0.12}, ${-w * 0.2} ${h / 2 - 6}, 0 ${h / 2 - 6} C ${w * 0.2} ${h / 2 - 6}, ${w * 0.28} ${-h * 0.12}, ${w * 0.28} ${-h / 2 + 6}`}
              fill="none"
              stroke={detail}
              strokeWidth={1.2}
              {...ns}
            />
            {/* Drain hole */}
            <circle cx={0} cy={h * 0.08} r={3} fill="none" stroke={detail} strokeWidth={1} {...ns} />
            <line x1={-2.5} y1={h * 0.08} x2={2.5} y2={h * 0.08} stroke={detail} strokeWidth={0.8} {...ns} />
            <line x1={0} y1={h * 0.08 - 2.5} x2={0} y2={h * 0.08 + 2.5} stroke={detail} strokeWidth={0.8} {...ns} />
            {/* Wall mounting plate */}
            <rect x={-w * 0.22} y={-h / 2} width={w * 0.44} height={4} fill={softFill} stroke={stroke} strokeWidth={1} {...ns} />
          </g>
        );

      case 'sink': {
        const basinW = w * 0.76;
        const basinH = h * 0.68;
        return (
          <g className="symbol-sink">
            {/* Countertop */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={4} {...ns} />
            {/* Basin */}
            <rect x={-basinW / 2} y={-basinH / 2} width={basinW} height={basinH} fill={fill} stroke={stroke} strokeWidth={1.2} rx={8} {...ns} />
            {/* Drain hole */}
            <circle cx={0} cy={0} r={4} fill="none" stroke={detail} strokeWidth={1} {...ns} />
            <line x1={-3} y1={0} x2={3} y2={0} stroke={detail} strokeWidth={0.8} {...ns} />
            <line x1={0} y1={-3} x2={0} y2={3} stroke={detail} strokeWidth={0.8} {...ns} />
            {/* Spout / Faucet */}
            <path d={`M 0,${-h * 0.44} C 0,${-h * 0.28} 0,${-h * 0.22} 0,${-h * 0.14}`} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" {...ns} />
            {/* Hot/Cold Handles */}
            <circle cx={-w * 0.15} cy={-h * 0.38} r={3.5} fill="#ef4444" stroke={stroke} strokeWidth={1} {...ns} />
            <circle cx={w * 0.15} cy={-h * 0.38} r={3.5} fill="#3b82f6" stroke={stroke} strokeWidth={1} {...ns} />
          </g>
        );
      }

      case 'kitchen_sink': {
        const r = Math.min(w, h) * 0.35;
        return (
          <g className="symbol-kitchen-sink">
            {/* Outer countertop */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            {/* Basin (simple circle) */}
            <circle cx={0} cy={0} r={r} fill={fill} stroke={stroke} strokeWidth={1.2} {...ns} />
            {/* Drain hole */}
            <circle cx={0} cy={0} r={3} fill="none" stroke={detail} strokeWidth={1} {...ns} />
            {/* Faucet spout */}
            <line x1={0} y1={-h / 2} x2={0} y2={-r + 4} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" {...ns} />
          </g>
        );
      }

      case 'portable_sink': {
        const basinW = w * 0.8;
        const basinH = h * 0.7;
        return (
          <g className="symbol-portable-sink">
            {/* Wall-mount back bar */}
            <rect x={-w * 0.4} y={-h / 2} width={w * 0.8} height={4} fill={softFill} stroke={stroke} strokeWidth={1} {...ns} />
            {/* Main sink body: half-rect, half-circle front */}
            <path
              d={`M ${-basinW / 2} ${-h / 2 + 4} L ${-basinW / 2} ${-h / 10} A ${basinW / 2} ${basinH / 2} 0 0 0 ${basinW / 2} ${-h / 10} L ${basinW / 2} ${-h / 2 + 4} Z`}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
              {...ns}
            />
            {/* Inner basin rim */}
            <path
              d={`M ${-basinW / 2 + 10} ${-h / 2 + 12} L ${-basinW / 2 + 10} ${-h / 10} A ${basinW / 2 - 10} ${basinH / 2 - 10} 0 0 0 ${basinW / 2 - 10} ${-h / 10} L ${basinW / 2 - 10} ${-h / 2 + 12} Z`}
              fill="none"
              stroke={detail}
              strokeWidth={1}
              {...ns}
            />
            {/* Drain hole */}
            <circle cx={0} cy={-h / 10} r={4} fill="none" stroke={detail} strokeWidth={1} {...ns} />
            {/* Spout */}
            <line x1={0} y1={-h / 2 + 4} x2={0} y2={-h / 3} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" {...ns} />
            {/* Faucet Handles */}
            <circle cx={-w * 0.2} cy={-h * 0.35} r={3.5} fill="#ef4444" stroke={stroke} strokeWidth={1} {...ns} />
            <circle cx={w * 0.2} cy={-h * 0.35} r={3.5} fill="#3b82f6" stroke={stroke} strokeWidth={1} {...ns} />
          </g>
        );
      }

      case 'conference_table': {
        // Smaller table so the surrounding chairs sit clearly separated from it, with a gap.
        const tableW = w * 0.6;
        const tableH = h * 0.6;
        const seat = (cx: number, cy: number, sw: number, sh: number) => (
          <rect
            x={cx - sw / 2}
            y={cy - sh / 2}
            width={sw}
            height={sh}
            rx={Math.min(sw, sh) * 0.35}
            fill={softFill}
            stroke={stroke}
            strokeWidth={1.2}
            {...ns}
          />
        );
        const hw = w * 0.16; // top/bottom seats
        const hh = h * 0.11;
        const vw = w * 0.11; // left/right seats
        const vh = h * 0.16;
        return (
          <g className="symbol-conference-table">
            {/* Chairs, standing off from the table on every side */}
            {seat(-w * 0.18, -h * 0.42, hw, hh)}
            {seat(w * 0.18, -h * 0.42, hw, hh)}
            {seat(-w * 0.18, h * 0.42, hw, hh)}
            {seat(w * 0.18, h * 0.42, hw, hh)}
            {seat(-w * 0.42, 0, vw, vh)}
            {seat(w * 0.42, 0, vw, vh)}
            {/* Conference Table */}
            <rect x={-tableW / 2} y={-tableH / 2} width={tableW} height={tableH} fill={fill} stroke={stroke} strokeWidth={1.5} rx={12} {...ns} />
            {/* Center divider line */}
            <line x1={0} y1={-tableH * 0.4} x2={0} y2={tableH * 0.4} stroke={detail} strokeWidth={1.2} {...ns} />
          </g>
        );
      }

      case 'double_door':
        return (
          <g className="symbol-double-door">
            {/* Threshold */}
            <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={detail} strokeWidth={1} strokeDasharray="2 2" {...ns} />
            {/* Left door panel (length w/2) */}
            <line x1={-w / 2} y1={0} x2={-w / 2} y2={-w / 2} stroke={stroke} strokeWidth={2.5} {...ns} />
            {/* Right door panel (length w/2) */}
            <line x1={w / 2} y1={0} x2={w / 2} y2={-w / 2} stroke={stroke} strokeWidth={2.5} {...ns} />
            {/* Left swing arc */}
            <path d={`M 0,0 A ${w / 2} ${w / 2} 0 0 1 ${-w / 2},${-w / 2}`} fill="none" stroke={detail} strokeWidth={1.2} strokeDasharray="3 3" {...ns} />
            {/* Right swing arc */}
            <path d={`M 0,0 A ${w / 2} ${w / 2} 0 0 0 ${w / 2},${-w / 2}`} fill="none" stroke={detail} strokeWidth={1.2} strokeDasharray="3 3" {...ns} />
          </g>
        );

      case 'door_opening':
        return (
          <g className="symbol-door-opening">
            <line x1={-w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} stroke={stroke} strokeWidth={1.5} {...ns} />
            <line x1={w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} stroke={stroke} strokeWidth={1.5} {...ns} />
            <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={detail} strokeWidth={1} strokeDasharray="3 3" {...ns} />
          </g>
        );

      case 'ramp':
        return (
          <g className="symbol-ramp">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} {...ns} />
            <line x1={0} y1={h * 0.35} x2={0} y2={-h * 0.35} stroke={stroke} strokeWidth={1.5} {...ns} />
            <polygon points={`0,${-h * 0.38} -5,${-h * 0.28} 5,${-h * 0.28}`} fill={stroke} />
            <text fontSize="8px" fill={stroke} textAnchor="middle" y={h * 0.1} style={{ userSelect: 'none', pointerEvents: 'none' }}>UP</text>
          </g>
        );

      default:
        return (
          <g className="symbol-fallback">
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} {...ns} />
            <line x1={-w * 0.4} y1={-h * 0.3} x2={-w * 0.4} y2={h * 0.3} stroke="#94a3b8" strokeWidth={1} {...ns} />
            <line x1={w * 0.4} y1={-h * 0.3} x2={w * 0.4} y2={h * 0.3} stroke="#94a3b8" strokeWidth={1} {...ns} />
          </g>
        );
    }
  })();

  return (
    <g className={className || `plan-symbol plan-symbol-${resolvedSymbolId}`} transform={`scale(${sx} ${sy})`}>
      {body}
    </g>
  );
};

export const PlanSymbolIcon: React.FC<{ symbolId: string; size?: number }> = ({ symbolId, size = 26 }) => (
  <svg width={size} height={size} viewBox="-54 -54 108 108" fill="none" aria-hidden="true">
    <PlanSymbolRenderer
      symbolId={symbolId}
      width={96}
      height={96}
      stroke="currentColor"
      fill="none"
      detailStroke="currentColor"
    />
  </svg>
);

/** Toolbar-only icon for the classroom layout array tool: several desk+chair pairs arranged in
 * rows, so it reads as "place a grid of desks" rather than a single generic desk. */
export const ClassroomArrayIcon: React.FC<{ size?: number }> = ({ size = 26 }) => {
  const cols = [-32, 0, 32];
  const rows = [-20, 20];
  return (
    <svg width={size} height={size} viewBox="-52 -46 104 92" fill="none" aria-hidden="true" className="classroom-array-icon">
      {rows.map((ry) =>
        cols.map((rx) => (
          <g key={`${rx}-${ry}`} transform={`translate(${rx} ${ry})`}>
            <rect x="-13" y="-15" width="26" height="11" rx="1.5" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
            <line x1="-10" y1="-11" x2="10" y2="-11" stroke="currentColor" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <rect x="-7" y="-1" width="14" height="10" rx="2" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
            <line x1="-8" y1="12" x2="8" y2="12" stroke="currentColor" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        )),
      )}
    </svg>
  );
};
