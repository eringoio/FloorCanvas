export function normalizeDegrees(angle: number): number {
  return (angle % 360 + 360) % 360;
}

export function snapRotation(angle: number, step = 10): number {
  return normalizeDegrees(Math.round(angle / step) * step);
}

export function getDragRotation(angle: number, snapEnabled: boolean, shiftKey: boolean): number {
  if (snapEnabled) return snapRotation(angle, 10);
  if (shiftKey) return snapRotation(angle, 15);
  return normalizeDegrees(Math.round(angle));
}

export function rotationForFrontVector(frontDeg: number): number {
  return normalizeDegrees(frontDeg + 90);
}
