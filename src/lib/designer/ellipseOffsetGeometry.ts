/** Mathematical review geometry only. This does not accept a supplier shape,
 * create a source contract, or enable a product/Designer/order gate. Coordinates
 * and the error budget are physical mm; no source example is scaled. */
export type EllipsePoint = readonly [number, number];
export type EllipseOffsetPath = {
  points: EllipsePoint[];
  offsetMm: number;
  /** Bound on Hausdorff distance between the closed polyline and exact offset. */
  maxErrorMm: number;
  segmentCount: number;
};
export type EllipseOffsetGeometry = {
  widthMm: number; heightMm: number; bleedMm: number; safeMm: number;
  minCurvatureRadiusMm: number;
  cut: EllipseOffsetPath; bleed: EllipseOffsetPath; safe: EllipseOffsetPath;
};
const finitePositive = (n: number) => Number.isFinite(n) && n > 0;
const TAU = 2*Math.PI;
const MAX_SEGMENTS = 8192;

/** E(t)=(a cos(t),b sin(t)); outward unit normal is
 * N(t)=(b cos(t),a sin(t))/hypot(b cos(t),a sin(t)). E+dN is the
 * true normal-distance offset; subtracting d from both axes is different.
 * For a>=b, min radius of curvature is b²/a. Its regular inward offsets
 * are convex/simple for d<b²/a. Near-singular offsets are refused. */
export function buildEllipseOffsetGeometry(widthMm: number, heightMm: number,
  bleedMm: number, safeMm: number, errorMm = 0.001): EllipseOffsetGeometry {
  if (![widthMm,heightMm,bleedMm,safeMm,errorMm].every(finitePositive)
    || Math.max(widthMm,heightMm) > 10000 || errorMm > 0.01 || errorMm < 1e-6
    || bleedMm > 100 || safeMm > 100) throw new Error('Ugyldige mål eller fejlgrænse for ovalgeometri.');
  const ax=widthMm/2, by=heightMm/2, major=Math.max(ax,by), minor=Math.min(ax,by);
  const radius=minor*minor/major;
  // The margin also keeps the approximation budget away from a cusp. It is
  // a conservative review constraint, not a supplier size limit.
  if (radius-safeMm <= 4*errorMm || minor-safeMm <= 4*errorMm) {
    throw new Error('Ovalens indvendige afstandskurve er singulær eller for tæt på en spids.');
  }
  const ratio=major/minor;
  const path = (offsetMm: number): EllipseOffsetPath => {
    // |E''|<=major. With q=|v|>=minor, v=(by cos,ax sin),
    // the normal angle derivative satisfies |theta'|<=ratio and
    // |theta''|<=ratio³. Thus |N''|<=ratio²+ratio³ and
    // |(E+dN)''|<=M below. Linear interpolation error is <=M*h²/8
    // on EVERY interval (both directions via the same parameter). This is
    // an analytic bound; a sampled residual is not an error certificate.
    const secondDerivativeBound=major+Math.abs(offsetMm)*(ratio*ratio+ratio*ratio*ratio);
    // Reserve half the requested budget for floating point/serialization.
    const count=4*Math.ceil((TAU*Math.sqrt(secondDerivativeBound/(4*errorMm)))/4);
    if (!Number.isFinite(count) || count > MAX_SEGMENTS) throw new Error('Ovalgeometrien overstiger det begrænsede vektorbudget.');
    const points: EllipsePoint[]=[];
    for(let i=0;i<count;i++) {
      // Exact cardinal points avoid a floating-point seam/extrema drift.
      const t=TAU*i/count, quarter=i/(count/4);
      const c=Number.isInteger(quarter) ? [1,0,-1,0][quarter] : Math.cos(t);
      const s=Number.isInteger(quarter) ? [0,1,0,-1][quarter] : Math.sin(t);
      const q=Math.hypot(by*c,ax*s);
      points.push([ax+bleedMm+ax*c+offsetMm*by*c/q,by+bleedMm+by*s+offsetMm*ax*s/q]);
    }
    return {points,offsetMm,maxErrorMm:secondDerivativeBound*(TAU/count)**2/8+errorMm/2,segmentCount:count};
  };
  return {widthMm,heightMm,bleedMm,safeMm,minCurvatureRadiusMm:radius,
    cut:path(0),bleed:path(bleedMm),safe:path(-safeMm)};
}

/** Closed vector path with explicit units, suitable for the existing guide
 * and Fabric path contracts. The source/product gate belongs to the caller. */
export function ellipseOffsetSvgPath(path: EllipseOffsetPath, unitsPerMm = 1): string {
  if (!finitePositive(unitsPerMm) || path.points.some(p=>p.some(v=>!Number.isFinite(v*unitsPerMm)))) {
    throw new Error('Ugyldig vektorenhed.');
  }
  return path.points.map(([x,y],i)=>`${i ? 'L' : 'M'} ${x*unitsPerMm} ${y*unitsPerMm}`).join(' ')+' Z';
}
