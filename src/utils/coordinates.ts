export interface Point {
  x: number;
  y: number;
}

export function clientToPaperPoint(
  event: Pick<MouseEvent | PointerEvent | React.MouseEvent | React.PointerEvent, 'clientX' | 'clientY'>,
  paperElement: HTMLElement,
  zoom: number
): Point {
  const rect = paperElement.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom,
  };
}

export function paperToWorldPoint(
  point: Point,
  pixelsPerUnit: number
): Point {
  return {
    x: point.x / pixelsPerUnit,
    y: point.y / pixelsPerUnit,
  };
}

export function worldToPaperPoint(
  point: Point,
  pixelsPerUnit: number
): Point {
  return {
    x: point.x * pixelsPerUnit,
    y: point.y * pixelsPerUnit,
  };
}

export function clientToWorldPoint(
  event: Pick<MouseEvent | PointerEvent | React.MouseEvent | React.PointerEvent, 'clientX' | 'clientY'>,
  paperElement: HTMLElement,
  zoom: number,
  pixelsPerUnit: number
): Point {
  const paperPt = clientToPaperPoint(event, paperElement, zoom);
  return paperToWorldPoint(paperPt, pixelsPerUnit);
}

export function getPointInsidePaper(
  paperPoint: Point,
  widthPx: number,
  heightPx: number
): boolean {
  return (
    paperPoint.x >= 0 &&
    paperPoint.x <= widthPx &&
    paperPoint.y >= 0 &&
    paperPoint.y <= heightPx
  );
}
