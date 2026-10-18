import React from 'react';
import { Grid } from './Grid';
import { useProjectStore } from '../store/projectStore';

interface PaperBoundaryProps {
  width?: number; // width in pixels
  height?: number; // height in pixels
  children?: React.ReactNode;
}

export const PaperBoundary: React.FC<PaperBoundaryProps> = ({
  width = 841,
  height = 594,
  children,
}) => {
  const grid = useProjectStore((state) => state.project.grid);
  const scale = useProjectStore((state) => state.project.scale);

  // Convert real grid size (in mm, e.g. 500) to pixels using scale factor
  // 500 mm * 0.1 px/mm = 50 pixels
  const gridSizeInPx = grid.size * scale.pixelsPerUnit;

  return (
    <div 
      className="paper-boundary" 
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        position: 'relative'
      }}
    >
      {/* Grid Overlay */}
      {grid.visible && (
        <Grid 
          width={width} 
          height={height} 
          gridSize={gridSizeInPx} 
          majorGridPeriod={5} 
        />
      )}
      
      {/* SVG Canvas for drawing objects */}
      <svg 
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto'
        }}
      >
        {children}
      </svg>
    </div>
  );
};
