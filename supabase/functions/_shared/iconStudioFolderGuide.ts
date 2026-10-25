import { isGraphicStudioStyle, type StudioRecipe, type StudioView } from './iconStudioRecipe.ts';

/** A trusted pose reference, never a finished product image. One A4 sheet, two retaining flaps. */
export const FOLDER_GUIDE_VERSION = 2;
export function supportsFolderGuide(sourceIndex?: number) {
  // Other die cuts keep their own construction references; do not substitute A4 geometry.
  return sourceIndex === undefined || sourceIndex === 162;
}
type Point3 = [number, number, number];
type Point2 = [number, number];
const CAMERAS: Record<StudioView, {yaw:number;elevation:number}> = {
  front:{yaw:0,elevation:45}, left:{yaw:-35,elevation:45}, right:{yaw:35,elevation:45},
  top:{yaw:0,elevation:90}, isometric:{yaw:45,elevation:35.264389682754654},
};
export function folderGuideScene(view:StudioView,palette:[string,string]) {
  const camera=CAMERAS[view];
  if (!camera || !palette.every(c=>/^#[0-9a-f]{6}$/i.test(c))) throw new Error('Invalid folder guide.');
  const rad=Math.PI/180, yaw=camera.yaw*rad, elevation=camera.elevation*rad;
  const cover=(x:number,z:number):Point3=>[x*Math.cos(25*rad),-x*Math.sin(25*rad),z];
  const shapes:{id:string;vertices:Point3[];colour:string}[]=[
    {id:'cover',vertices:[cover(-1.05,-1.485),cover(0,-1.485),cover(0,1.485),cover(-1.05,1.485)],colour:palette[1]},
    {id:'back',vertices:[[0,0,-1.485],[1.05,0,-1.485],[1.05,0,1.485],[0,0,1.485]],colour:palette[1]},
    {id:'side-flap',vertices:[[1.05,.012,-1.485],[1.05,.012,1.485],[.74,.012,1.28],[.74,.012,-1.28]],colour:palette[0]},
    {id:'bottom-flap',vertices:[[0,.025,1.485],[1.05,.025,1.485],[.94,.025,1.07],[.12,.025,1.07]],colour:palette[0]},
  ];
  const projected=shapes.map(s=>({...s,points:s.vertices.map(([x,y,z]):Point2=>[
    x*Math.cos(yaw)-z*Math.sin(yaw),
    x*Math.sin(yaw)*Math.sin(elevation)-y*Math.cos(elevation)+z*Math.cos(yaw)*Math.sin(elevation),
  ])}));
  const points=projected.flatMap(s=>s.points);
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const scale=400/Math.max(maxX-minX,maxY-minY);
  return {version:FOLDER_GUIDE_VERSION,camera,panels:projected.map(s=>({id:s.id,colour:s.colour,
    points:s.points.map(([x,y]):Point2=>[256+(x-(minX+maxX)/2)*scale,256+(y-(minY+maxY)/2)*scale]),
  }))};
}

function crc32(bytes:Uint8Array) {
  let crc=0xffffffff;
  for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(name:string,data:Uint8Array) {
  const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);
  view.setUint32(0,data.length);out.set(new TextEncoder().encode(name),4);out.set(data,8);
  view.setUint32(data.length+8,crc32(out.subarray(4,data.length+8)));return out;
}
/** Small dependency-free PNG encoder works in both the Edge runtime and local regression tests. */
export async function renderFolderGuide(view:StudioView,palette:[string,string], backdrop?:string, styleId?:string):Promise<Uint8Array> {
  const scene=folderGuideScene(view,palette), size=512, rgba=new Uint8Array(size*size*4);
  const graphic=isGraphicStudioStyle(styleId), outline=styleId==='outline', silhouette=styleId==='silhouette';
  const empty=backdrop ? [...[1,3,5].map(i=>parseInt(backdrop.slice(i,i+2),16)),255] : [0,0,0,0];
  if(backdrop){const colour=[1,3,5].map(i=>parseInt(backdrop.slice(i,i+2),16));for(let i=0;i<rgba.length;i+=4)rgba.set([...colour,255],i);}
  const pixel=(x:number,y:number,rgb:number[],alpha=255)=>{if(x<0||x>=size||y<0||y>=size)return;const n=(y*size+x)*4;rgba.set([...rgb,alpha],n);};
  for(const panel of scene.panels){
    const rgb=[1,3,5].map(i=>parseInt((outline||silhouette?palette[0]:panel.colour).slice(i,i+2),16));
    const shade=graphic?1:panel.id==='cover'?.97:panel.id==='side-flap'?.9:1;
    const fill=rgb.map(c=>Math.round(c*shade));
    const points=panel.points;
    for(let y=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1]))));y<=Math.min(size-1,Math.ceil(Math.max(...points.map(p=>p[1]))));y++){
      const hits:number[]=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],row=y+.5;
        if((a[1]<=row&&b[1]>row)||(b[1]<=row&&a[1]>row))hits.push(a[0]+(row-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      hits.sort((a,b)=>a-b);
      for(let i=0;i+1<hits.length;i+=2)for(let x=Math.ceil(hits[i]);x<=Math.floor(hits[i+1]);x++)pixel(x,y,outline?empty.slice(0,3):fill,outline?empty[3]:255);
    }
    // Even flat fills need crease boundaries in the pose guide; otherwise adjacent
    // panels merge and the provider can reinterpret the object as a plain bifold.
    const edge=silhouette?empty.slice(0,3):graphic?[1,3,5].map(i=>parseInt(palette[0].slice(i,i+2),16)):fill.map(c=>Math.round(c*.72));
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);
      for(let t=0;t<=steps;t++)pixel(Math.round(a[0]+(b[0]-a[0])*t/steps),Math.round(a[1]+(b[1]-a[1])*t/steps),edge,silhouette?empty[3]:255);
    }
  }
  const raw=new Uint8Array(size*(size*4+1));
  for(let y=0;y<size;y++)raw.set(rgba.subarray(y*size*4,(y+1)*size*4),y*(size*4+1)+1);
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
  const compressed=new Uint8Array(await new Response(stream).arrayBuffer());
  const header=new Uint8Array(13),h=new DataView(header.buffer);h.setUint32(0,size);h.setUint32(4,size);header.set([8,6,0,0,0],8);
  const chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())];
  const png=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const c of chunks){png.set(c,offset);offset+=c.length;}return png;
}
export function folderGuidePrompt(view:StudioView,styleId?:string) {
  const finish=isGraphicStudioStyle(styleId) ? 'Redraw this SAME geometry as the selected flat graphic style. Respect its solid-fill, single-ink or unfilled-line rules. Do not turn the drawing into a shaded physical object.' : 'Render this SAME object with realistic thin opaque cardstock, gentle lighting and the selected surface style.';
  return `The only attached image is a precise pose guide of ONE A4 presentation folder, opened with two covers joined at the centre crease, one right-side retaining flap and one bottom retaining flap. This is the whole object; preserve exactly its silhouette, panel layout, fold angle, orientation and camera projection. ${finish} Do not rearrange, unfold, close, mirror, duplicate or stand up any panel. Exactly TWO retaining flaps, both on the RIGHT panel: one right-side flap and one bottom flap. The LEFT cover is completely plain and has NO flap, pocket, strip or insert. Do not add a separate folder, sheet or insert. Selected view: ${view}. The guide already determines the camera; do not choose another camera. The original multi-product library image and the collection anchor are deliberately NOT attached. Their recipe supplies style and colours only. No text, logos or invented artwork.`;
}

/** Graphic OpenAI outputs preserve native alpha, including enclosed negative space. */
export function studioFolderBackdrop(recipe:StudioRecipe,providerKey:string) {
  if(recipe.compositionVersion!==2 || (providerKey==='openai-image-v1' && isGraphicStudioStyle(recipe.styleId))) return null;
  return folderBackdrop(recipe.palette);
}

/** Pick a chroma channel absent from the locked palette; logos are added after cutout. */
export function folderBackdrop(palette:[string,string]) {
  const colours=palette.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  const scores=[0,1,2].map(channel=>Math.max(...colours.map(rgb=>Math.max(0,rgb[channel]-Math.max(...rgb.filter((_,i)=>i!==channel))))));
  return ['#ff0000','#00ff00','#0000ff'][scores.indexOf(Math.min(...scores))];
}
