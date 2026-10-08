const GEOMETRY_KEYS=['left','top','width','height','scaleX','scaleY','angle','skewX','skewY','strokeWidth','cropX','cropY'] as const;
export type BrochureSerializableGeometry = Partial<Record<typeof GEOMETRY_KEYS[number],number>> & {
  toObject: (properties?: string[]) => Record<string, unknown>;
  getObjects?: () => BrochureSerializableGeometry[];
};
const preciseSerializers=new WeakSet<BrochureSerializableGeometry['toObject']>();

/** Brochure-owned objects only; never changes Fabric's global rounding setting. */
export function preserveBrochureSerializationGeometry(object: BrochureSerializableGeometry): void {
  for(const child of object.getObjects?.()||[])preserveBrochureSerializationGeometry(child);
  if(preciseSerializers.has(object.toObject))return;
  const original=object.toObject;
  const precise=function(this:BrochureSerializableGeometry,properties?:string[]){
    const snapshot=original.call(this,properties);
    for(const key of GEOMETRY_KEYS){const value=this[key];if(typeof value==='number'&&Number.isFinite(value))snapshot[key]=value;}
    return snapshot;
  };
  preciseSerializers.add(precise);object.toObject=precise;
}
