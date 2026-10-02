export const SINGLE_CUT_CONTOUR_MESSAGE = 'Konturskæring kræver præcis én sammenhængende, lukket skærelinje. Åbne eller flere adskilte stier kan ikke bruges.';
type VectorObject = { type?: string; path?: unknown[][]; points?: { x: number; y: number }[]; width?: number; height?: number; radius?: number; rx?: number; ry?: number; scaleX?: number; scaleY?: number; visible?: boolean; __isCutContour?: boolean; __isGuide?: boolean; getObjects?: () => VectorObject[] };
const positive = (value: number) => Number.isFinite(value) && value > 0;
function hasOutlineExtent(points: { x: number; y: number }[]): boolean {
  if (points.length < 3 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  const first = points[0], second = points.find(point => point.x !== first.x || point.y !== first.y);
  if (!second) return false;
  return points.some(point => (second.x - first.x) * (point.y - first.y) !== (second.y - first.y) * (point.x - first.x));
}
/** Count geometry, not layers: a group or one SVG path can contain several outlines. */
export function isSingleClosedContour(object: VectorObject): boolean {
  if (object.visible === false || [object.scaleX, object.scaleY].some(value => value != null && (!Number.isFinite(value) || value === 0))) return false;
  if (object.type === 'group' || object.type === 'activeSelection') {
    const children = object.getObjects?.() || [];
    return children.length === 1 && isSingleClosedContour(children[0]);
  }
  if (object.type === 'path') {
    const path = object.path || [];
    // Fabric normalises SVG paths to absolute M/L/C/Q/Z commands. Saved JSON
    // must obey that same grammar before it reaches the production exporter.
    const arities: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };
    if (path.length < 3 || path[0][0] !== 'M' || path.filter(command => command[0] === 'M').length !== 1) return false;
    if (path.some(command => arities[String(command[0])] == null || command.length !== arities[String(command[0])] + 1 || command.slice(1).some(value => typeof value !== 'number' || !Number.isFinite(value)))) return false;
    if (path.slice(0, -1).some(command => command[0] === 'Z')) return false;
    const first = path[0], last = path[path.length - 1];
    const closed = last[0] === 'Z' || (last[last.length - 2] === first[1] && last[last.length - 1] === first[2]);
    const points = path.flatMap(command => {
      const coordinates = command.slice(1) as number[];
      return coordinates.filter((_, index) => index % 2 === 0).map((x, index) => ({ x, y: coordinates[index * 2 + 1] }));
    });
    return closed && positive(object.width ?? 1) && positive(object.height ?? 1) && hasOutlineExtent(points);
  }
  if (object.type === 'polygon') return positive(object.width ?? 1) && positive(object.height ?? 1) && hasOutlineExtent(object.points || []);
  if (object.type === 'polyline') {
    const p = object.points || [];
    return p.length >= 4 && p[0].x === p[p.length - 1].x && p[0].y === p[p.length - 1].y && positive(object.width ?? 1) && positive(object.height ?? 1) && hasOutlineExtent(p);
  }
  return ['rect', 'circle', 'ellipse', 'triangle'].includes(object.type || '') && positive(object.width ?? 0) && positive(object.height ?? 0);
}
export function contourObjects(objects: VectorObject[]) {
  return objects.filter(object => object.__isCutContour && !object.__isGuide && object.visible !== false);
}
export function assertSingleCanvasContour(objects: VectorObject[]) {
  const contours = contourObjects(objects);
  if (contours.length !== 1 || !isSingleClosedContour(contours[0])) throw new Error(SINGLE_CUT_CONTOUR_MESSAGE);
}

export function cutContourGeometrySignature(object: object) {
  const values = object as Record<string, unknown>;
  const keys = ['type', 'path', 'points', 'width', 'height', 'scaleX', 'scaleY', 'left', 'top', 'originX', 'originY', 'angle', 'skewX', 'skewY', 'flipX', 'flipY'];
  return JSON.stringify(keys.map(key => values[key] ?? null));
}
