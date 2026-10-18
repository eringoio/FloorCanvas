import React from 'react';

interface GridProps {
  gridSize?: number; // Distance in pixels between minor lines (e.g. 10px)
  majorGridPeriod?: number; // Every N minor grid lines, draw a major line (e.g. 5)
  width: number;
  height: number;
}

export const Grid: React.FC<GridProps> = ({
  gridSize = 10,
  majorGridPeriod = 5,
  width,
  height,
}) => {
  const majorSize = gridSize * majorGridPeriod;

  return (
    <svg className="grid-overlay" width={width} height={height}>
      <defs>
        {/* Minor Grid Pattern */}
        <pattern
          id="minor-grid"
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        </pattern>

        {/* Major Grid Pattern */}
        <pattern
          id="major-grid"
          width={majorSize}
          height={majorSize}
          patternUnits="userSpaceOnUse"
        >
          <rect width={majorSize} height={majorSize} fill="url(#minor-grid)" />
          <path
            d={`M ${majorSize} 0 L 0 0 0 ${majorSize}`}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      {/* Render grid over the canvas dimensions */}
      <rect width={width} height={height} fill="url(#major-grid)" />
    </svg>
  );
};
