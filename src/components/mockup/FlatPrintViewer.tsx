import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { flatPrintUv, type FlatPrintDefinition } from '@/lib/mockup/flatPrintDefinition';
import { loadArtworkImage } from '@/lib/mockup/artwork';
import './flatPrintViewer.css';

interface Props { definition: FlatPrintDefinition; artwork: string }
type Api = { view: (side: 'front' | 'back' | 'angle') => void; zoom: (factor: number) => void; rotate: (x: number, y: number) => void };

export default function FlatPrintViewer({ definition, artwork }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [ready,setReady] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let orbit: OrbitControls | undefined;
    let observer: ResizeObserver | undefined;
    const resources: { dispose: () => void }[] = [];
    const onContextLost = (event: Event) => { event.preventDefault(); if (!disposed) { setReady(false); setError('3D er ikke tilgængelig her. Trykfladen vises nedenfor.'); } };
    setReady(false); setError('');
    async function start() {
      const image = await loadArtworkImage(artwork);
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio,2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.domElement.addEventListener('webglcontextlost',onContextLost);
      element!.append(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34,1,.1,2000);
      orbit = new OrbitControls(camera,renderer.domElement);
      orbit.enableDamping = true; orbit.enablePan = false;
      const paperCanvas = document.createElement('canvas');
      paperCanvas.width = image.naturalWidth; paperCanvas.height = image.naturalHeight;
      const context = paperCanvas.getContext('2d');
      if (!context) throw new Error('No image canvas');
      context.fillStyle='#fff'; context.fillRect(0,0,paperCanvas.width,paperCanvas.height); context.drawImage(image,0,0);
      const texture = new THREE.CanvasTexture(paperCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());resources.push(texture);
      const {width:w,height:h} = definition.trim;
      const frontGeometry = new THREE.PlaneGeometry(w,h);
      const positions=frontGeometry.getAttribute('position');const uv=frontGeometry.getAttribute('uv');
      for(let i=0;i<positions.count;i++) {
        const [u,v]=flatPrintUv(positions.getX(i)+w/2,h/2-positions.getY(i),definition);uv.setXY(i,u,v);
      }
      resources.push(frontGeometry);
      // Artwork uses its original display colours. This is not a colour contract proof.
      const frontMaterial = new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide});resources.push(frontMaterial);
      const front = new THREE.Mesh(frontGeometry,frontMaterial);front.position.z=definition.displayThicknessMm/2+.002;scene.add(front);
      // Closed solid edge plus independent, unprinted reverse. Outside art never appears on the back.
      const bodyGeometry = new THREE.BoxGeometry(w,h,definition.displayThicknessMm);resources.push(bodyGeometry);
      const bodyMaterial = new THREE.MeshStandardMaterial({color:0xfffefa,roughness:.9});resources.push(bodyMaterial);
      // BoxGeometry order: +X,-X,+Y,-Y,+Z,-Z. The artwork owns +Z;
      // do not draw another near-coplanar paper face underneath it.
      const hiddenFront = new THREE.MeshBasicMaterial({visible:false});resources.push(hiddenFront);
      const unprintedBack = new THREE.MeshBasicMaterial({color:0xfffefa});resources.push(unprintedBack);
      scene.add(new THREE.Mesh(bodyGeometry,[bodyMaterial,bodyMaterial,bodyMaterial,bodyMaterial,hiddenFront,unprintedBack]));
      const outlineGeometry = new THREE.EdgesGeometry(bodyGeometry);resources.push(outlineGeometry);
      const outlineMaterial = new THREE.LineBasicMaterial({color:0x8f9997,transparent:true,opacity:.3});resources.push(outlineMaterial);
      scene.add(new THREE.LineSegments(outlineGeometry,outlineMaterial));
      scene.add(new THREE.HemisphereLight(0xffffff,0xe5e8e2,2));
      const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(-80,150,250);scene.add(light);
      const fit=()=>Math.max(h,w/Math.max(.1,camera.aspect))/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.3;
      let selectedView: 'front'|'back'|'angle'='angle';
      const view=(side:typeof selectedView)=>{
        selectedView=side; const d=fit();orbit!.target.set(0,0,0);orbit!.minDistance=d*.5;orbit!.maxDistance=d*3;
        camera.position.copy(new THREE.Vector3(side==='angle'?.42:0,side==='angle'?.18:0,side==='back'?-1:1).normalize().multiplyScalar(d));orbit!.update();
      };
      const resize=()=>{const b=element!.getBoundingClientRect();renderer!.setSize(Math.max(1,b.width),Math.max(1,b.height));camera.aspect=Math.max(1,b.width)/Math.max(1,b.height);camera.updateProjectionMatrix();view(selectedView);};
      api.current={view,zoom:factor=>{const offset=camera.position.clone().sub(orbit!.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,orbit!.minDistance,orbit!.maxDistance));camera.position.copy(orbit!.target).add(offset);orbit!.update();},rotate:(x,y)=>{const offset=camera.position.clone().sub(orbit!.target);const s=new THREE.Spherical().setFromVector3(offset);s.theta+=x;s.phi=THREE.MathUtils.clamp(s.phi+y,.05,Math.PI-.05);camera.position.copy(orbit!.target).add(offset.setFromSpherical(s));orbit!.update();}};
      resize();observer=new ResizeObserver(resize);observer.observe(element!);
      const animate=()=>{if(disposed)return;orbit!.update();renderer!.render(scene,camera);frame=requestAnimationFrame(animate);};
      setReady(true);animate();
    }
    void start().catch(()=>{if(!disposed){setReady(false);setError('3D er ikke tilgængelig her. Trykfladen vises nedenfor.');}});
    return()=>{disposed=true;cancelAnimationFrame(frame);api.current=null;observer?.disconnect();orbit?.dispose();resources.forEach(r=>r.dispose());renderer?.domElement.removeEventListener('webglcontextlost',onContextLost);renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
  },[artwork,definition]);
  return <div className="flat-print-viewer" data-flat-ready={ready} data-model-revision={definition.id}>
    <div className="flat-print-stage" ref={host} tabIndex={error?-1:0} role="group" aria-label="3D-flyer. Piletaster drejer. Plus og minus zoomer."
      onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();if(e.key.startsWith('Arrow'))api.current?.rotate(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0,e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0);else api.current?.zoom(e.key==='-'?1.12:.89);}} />
    {!ready&&!error&&<p role="status">Åbner 3D…</p>}
    {error?<div className="flat-print-fallback"><p role="alert">{error}</p><img src={artwork} alt="Din fulde trykflade inklusive udfald" /></div>:<div className="flat-print-controls" aria-label="3D-visning">
      <button type="button" disabled={!ready} onClick={()=>api.current?.view('front')}>Forside</button>
      <button type="button" disabled={!ready} onClick={()=>api.current?.view('back')}>Bagside · uden tryk</button>
      <button type="button" disabled={!ready} onClick={()=>api.current?.view('angle')}>3D-vinkel</button>
      <button type="button" disabled={!ready} aria-label="Zoom ind" onClick={()=>api.current?.zoom(.85)}>+</button>
      <button type="button" disabled={!ready} aria-label="Zoom ud" onClick={()=>api.current?.zoom(1.18)}>−</button>
    </div>}
  </div>;
}
