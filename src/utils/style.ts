export interface StylePreset {
  pageBorder: string;
  outerWallStroke: string;
  innerWallStroke: string;
  thinPartitionStroke: string;
  columnFill: string;
  columnStroke: string;
  furnitureStroke: string;
  furnitureFill: string;
  furnitureDetailStroke: string;
  doorStroke: string;
  doorSwingStroke: string;
  windowStroke: string;
  windowGlassStroke: string;
  windowGlassFill: string;
  dimensionStroke: string;
  dimensionExtensionStroke: string;
  hiddenStroke: string;
  labelFill: string;
  stairStroke: string;
  stairArrowFill: string;
  stairArrowStroke: string;
  elevatorStroke: string;
  elevatorFill: string;
  elevatorInnerStroke: string;
  elevatorDiagonalStroke: string;
  elevatorText: string;
}

export const ARCHITECTURAL_REFERENCE_STYLE: StylePreset = {
  pageBorder: '#999999',
  outerWallStroke: '#111111',
  innerWallStroke: '#222222',
  thinPartitionStroke: '#333333',
  columnFill: '#111111',
  columnStroke: '#111111',
  furnitureStroke: '#111111',
  furnitureFill: '#e5e5e5',
  furnitureDetailStroke: '#333333',
  doorStroke: '#222222',
  doorSwingStroke: '#222222',
  windowStroke: '#555555',
  windowGlassStroke: '#555555',
  windowGlassFill: '#ffffff',
  dimensionStroke: '#555555',
  dimensionExtensionStroke: '#777777',
  hiddenStroke: '#aaaaaa',
  labelFill: '#111111',
  stairStroke: '#333333',
  stairArrowFill: '#111111',
  stairArrowStroke: '#111111',
  elevatorStroke: '#111111',
  elevatorFill: '#ffffff',
  elevatorInnerStroke: '#111111',
  elevatorDiagonalStroke: '#111111',
  elevatorText: '#111111',
};

export const MODERN_EDITOR_STYLE: StylePreset = {
  pageBorder: '#cbd5e1',
  outerWallStroke: '#1e293b',
  innerWallStroke: '#64748b',
  thinPartitionStroke: '#94a3b8',
  columnFill: '#334155',
  columnStroke: '#0f172a',
  furnitureStroke: '#111111',
  furnitureFill: '#f8fafc',
  furnitureDetailStroke: '#333333',
  doorStroke: '#0f172a',
  doorSwingStroke: '#475569',
  windowStroke: '#cbd5e1',
  windowGlassStroke: '#3b82f6',
  windowGlassFill: '#93c5fd',
  dimensionStroke: '#475569',
  dimensionExtensionStroke: '#94a3b8',
  hiddenStroke: '#cbd5e1',
  labelFill: '#000000',
  stairStroke: '#475569',
  stairArrowFill: 'var(--primary)',
  stairArrowStroke: 'var(--primary)',
  elevatorStroke: '#475569',
  elevatorFill: '#f8fafc',
  elevatorInnerStroke: '#94a3b8',
  elevatorDiagonalStroke: '#cbd5e1',
  elevatorText: '#1e293b',
};

export const getStyle = (preset?: 'modern-editor' | 'architectural-reference'): StylePreset => {
  if (preset === 'architectural-reference') {
    return ARCHITECTURAL_REFERENCE_STYLE;
  }
  return MODERN_EDITOR_STYLE;
};
