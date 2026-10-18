export type StandardPaperSize = 'A4' | 'A3';

export const PAPER_MM = {
  A4: { portrait: { width: 210, height: 297 }, landscape: { width: 297, height: 210 } },
  A3: { portrait: { width: 297, height: 420 }, landscape: { width: 420, height: 297 } },
} as const;

export function getPaperSizeMm(size: 'A4' | 'A3', orientation: 'portrait' | 'landscape') {
  return PAPER_MM[size][orientation];
}
