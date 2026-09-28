import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CLOSED_FOLDS, OPEN_FOLDS, sheetUv, toggleFold, type FoldId, type FoldState, type FolderDefinition } from '@/lib/mockup/folderDefinition';
import { loadArtworkImage } from '@/lib/mockup/artwork';
import type { FolderPrintMode } from '@/lib/mockup/productFolderPreview';

interface Props { definition: FolderDefinition; artwork?: string; compactControls?: boolean; productPreview?: { color: string; print: FolderPrintMode } }
type Controls = { reset: (outside?: boolean) => void; zoom: (factor: number) => void; rotate: (x: number, y: number) => void };

// Keep the shop hue, but distinguish adjacent panels even when they are coplanar.
// These illustrative shades are never applied to customer artwork.
function panelColour(base: string, panel: 'back' | FoldId) {
  const colour = new THREE.Color(base);
  const hsl = colour.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  const lightness = { cover: 0.48, back: 0.64, side: 0.34, bottom: 0.23 }[panel];
  return colour.setHSL(hsl.h, Math.min(hsl.s, 0.8), lightness, THREE.SRGBColorSpace);
}

export default function FolderViewer({ definition, artwork, productPreview, compactControls }: Props) {
  const productColor = productPreview?.color;
  const printInside = productPreview?.print === '4+4';
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Controls | null>(null);
  const [folds, setFolds] = useState<FoldState>({ ...CLOSED_FOLDS });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const target = useRef(folds);
  target.current = folds;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | undefined;
    let cleanup = () => {};
    setError(''); setReady(false);
    async function start() {
      const image = artwork ? await loadArtworkImage(artwork) : null;
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;
      renderer.shadowMap.enabled = !!productColor;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0xf1f3f4, 0);
      element!.append(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 10, 4000);
      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true; orbit.enablePan = false;
      orbit.minDistance = 350; orbit.maxDistance = 1700;
      // Transparent artwork represents unprinted paper, including transparent designer exports.
      let texture: THREE.CanvasTexture | null = null;
      if (image) {
        const paperCanvas = document.createElement('canvas');
        paperCanvas.width = image.naturalWidth; paperCanvas.height = image.naturalHeight;
        const paperContext = paperCanvas.getContext('2d');
        if (!paperContext) throw new Error('Artwork canvas unavailable');
        paperContext.fillStyle = '#ffffff'; paperContext.fillRect(0, 0, paperCanvas.width, paperCanvas.height);
        paperContext.drawImage(image, 0, 0);
        texture = new THREE.CanvasTexture(paperCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
      const ink = new THREE.MeshStandardMaterial({ map: texture, color: productColor || 0xffffff, roughness: 0.78, side: THREE.FrontSide });
      const paper = new THREE.MeshStandardMaterial({ color: printInside && productColor ? productColor : 0xfdfcf9, roughness: 0.9, side: THREE.BackSide });
      const edge = new THREE.MeshStandardMaterial({ color: 0xc6c4bf, roughness: 1, side: THREE.DoubleSide });
      const cutMaterial = new THREE.LineBasicMaterial({ color: 0x777b7e, transparent: true, opacity: 0.65 });
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x18374a, transparent: true, opacity: 0.28 });
      const panelMaterials: THREE.Material[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const hinges = new Map<FoldId, THREE.Group>();
      const hitTargets: THREE.Mesh[] = [];
      for (const panel of definition.panels) {
        const [hx, hy] = panel.hinge;
        const shape = new THREE.Shape(panel.outline.map(([x, y]) => new THREE.Vector2(x - hx, hy - y)));
        const geometry = new THREE.ShapeGeometry(shape);
        const positions = geometry.getAttribute('position');
        const uv = geometry.getAttribute('uv');
        for (let i = 0; i < positions.count; i++) {
          const [u, v] = sheetUv([positions.getX(i) + hx, hy - positions.getY(i)], definition);
          uv.setXY(i, u, v);
        }
        const group = new THREE.Group();
        group.position.set(hx - definition.origin[0], definition.origin[1] - hy, panel.layer);
        const outsideMaterial = productColor ? new THREE.MeshStandardMaterial({
          color: panelColour(productColor, panel.id), roughness: 0.72,
          side: THREE.FrontSide, shadowSide: THREE.DoubleSide,
        }) : ink;
        const insideMaterial = productColor ? new THREE.MeshStandardMaterial({
          color: printInside ? panelColour(productColor, panel.id) : (panel.id === 'back' ? 0xe4e9ed : 0xfaf9f5),
          roughness: 0.85, side: THREE.BackSide, shadowSide: THREE.DoubleSide,
        }) : paper;
        if (productColor) panelMaterials.push(outsideMaterial, insideMaterial);
        const outside = new THREE.Mesh(geometry, outsideMaterial);
        outside.position.z = 0.19;
        const inside = new THREE.Mesh(geometry, insideMaterial);
        inside.position.z = -0.19;
        for (const mesh of [outside, inside]) {
          mesh.userData.fold = panel.id === 'back' ? undefined : panel.id;
          mesh.castShadow = !!productColor;
          mesh.receiveShadow = !!productColor;
          hitTargets.push(mesh);
          group.add(mesh);
        }
        const edgePositions: number[] = [];
        panel.outline.forEach(([x, y], i) => {
          const [nx, ny] = panel.outline[(i + 1) % panel.outline.length];
          const a = [x - hx, hy - y], b = [nx - hx, hy - ny];
          edgePositions.push(...a, -0.19, ...b, -0.19, ...b, 0.19, ...a, -0.19, ...b, 0.19, ...a, 0.19);
        });
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
        edgeGeometry.computeVertexNormals();
        group.add(new THREE.Mesh(edgeGeometry, edge));
        if (productColor) {
          // Both faces get a fine contour; depth testing hides concealed edges.
          for (const z of [-0.22, 0.22]) {
            const contour = new THREE.BufferGeometry().setFromPoints(panel.outline.map(([x, y]) => new THREE.Vector3(x - hx, hy - y, z)));
            group.add(new THREE.LineLoop(contour, outlineMaterial));
            geometries.push(contour);
          }
        }
        for (const cut of panel.cuts ?? []) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(cut.map(([x, y]) => new THREE.Vector3(x - hx, hy - y, 0.23)));
          group.add(new THREE.Line(lineGeometry, cutMaterial));
          geometries.push(lineGeometry);
        }
        geometries.push(geometry, edgeGeometry);
        if (panel.id !== 'back') {
          group.rotation[panel.axis] = panel.closedAngle;
          hinges.set(panel.id, group);
        }
        scene.add(group);
      }
      scene.add(new THREE.HemisphereLight(0xffffff, 0xe7e5df, productColor ? 1.7 : 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-300, 600, -700); scene.add(key);
      if (productColor) {
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        Object.assign(key.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 100, far: 1800 });
        key.shadow.bias = -0.0003;
        key.shadow.normalBias = 0.4;
      }
      const fill = new THREE.DirectionalLight(0xffffff, 1); fill.position.set(400, 100, 600); scene.add(fill);
      const fittedDistance = () => Math.max(620, (target.current.cover ? 600 : 340) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      let fitDistance: number | null = null;
      const reset = (outside = false) => {
        const distance = fittedDistance();
        fitDistance = null;
        orbit.maxDistance = Math.max(1700, distance * 1.4);
        orbit.target.set(35, -10, 0);
        camera.position.set((outside ? 1 : -1) * distance * 0.32 + 35, distance * 0.20, (outside ? 1 : -1) * distance);
        orbit.update();
      };
      const resize = () => {
        const { width, height } = element!.getBoundingClientRect();
        renderer!.setSize(width, height);
        camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
      };
      resize(); reset();
      const observer = new ResizeObserver(() => { resize(); fitDistance = fittedDistance(); }); observer.observe(element!);
      const rotate = (x: number, y: number) => {
        const offset = camera.position.clone().sub(orbit.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += x; spherical.phi = THREE.MathUtils.clamp(spherical.phi + y, 0.1, Math.PI - 0.1);
        camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical)); orbit.update();
      };
      const zoom = (factor: number) => {
        fitDistance = null;
        const offset = camera.position.clone().sub(orbit.target);
        offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, orbit.minDistance, orbit.maxDistance));
        camera.position.copy(orbit.target).add(offset); orbit.update();
      };
      api.current = { reset, zoom, rotate };
      const raycaster = new THREE.Raycaster();
      let down: { x: number; y: number; id: number } | null = null;
      const pointDown = (event: PointerEvent) => { down = event.isPrimary ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null; };
      const pointUp = (event: PointerEvent) => {
        const previous = down; down = null;
        if (!previous || previous.id !== event.pointerId || Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 5) return;
        const bounds = renderer!.domElement.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
        const fold = raycaster.intersectObjects(hitTargets)[0]?.object.userData.fold as FoldId | undefined;
        if (fold) setFolds(current => toggleFold(current, fold));
      };
      const cancel = () => { down = null; };
      const contextLost = (event: Event) => { event.preventDefault(); setError('3D-visningen er ikke tilgængelig på denne enhed. Dit design vises fladt nedenfor.'); };
      renderer.domElement.addEventListener('pointerdown', pointDown);
      renderer.domElement.addEventListener('pointerup', pointUp);
      renderer.domElement.addEventListener('pointercancel', cancel);
      renderer.domElement.addEventListener('webglcontextlost', contextLost);
      let frame = 0;
      let lastCoverOpen = target.current.cover;
      let lastTime = performance.now();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const animate = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
        if (target.current.cover !== lastCoverOpen) {
          lastCoverOpen = target.current.cover;
          fitDistance = fittedDistance();
        }
        if (fitDistance !== null) {
          orbit.maxDistance = Math.max(1700, fitDistance * 1.4);
          const offset = camera.position.clone().sub(orbit.target);
          const next = reducedMotion.matches ? fitDistance : THREE.MathUtils.damp(offset.length(), fitDistance, 6, dt);
          camera.position.copy(orbit.target).add(offset.setLength(next));
          if (Math.abs(next - fitDistance) < 0.5) fitDistance = null;
        }
        const cover = hinges.get('cover')!;
        const pocketsClosed = ['side', 'bottom'].every(id => Math.abs(Math.abs(hinges.get(id as FoldId)!.rotation[id === 'bottom' ? 'x' : 'y']) - Math.PI) < 0.015);
        for (const panel of definition.panels) {
          if (panel.id === 'back') continue;
          const hinge = hinges.get(panel.id)!;
          let desired = target.current[panel.id] ? 0 : panel.closedAngle;
          // Fold in pockets before closing the cover; lift the cover before opening pockets.
          if (panel.id === 'cover' && !target.current.cover && !pocketsClosed) desired = 0;
          if (panel.id !== 'cover' && target.current[panel.id] && Math.abs(cover.rotation.y) > 0.2) desired = panel.closedAngle;
          const current = hinge.rotation[panel.axis];
          hinge.rotation[panel.axis] = reducedMotion.matches ? desired : THREE.MathUtils.damp(current, desired, 7, dt);
          if (Math.abs(hinge.rotation[panel.axis] - desired) < 0.001) hinge.rotation[panel.axis] = desired;
        }
        orbit.update(); renderer!.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect(); orbit.dispose();
        renderer!.domElement.removeEventListener('pointerdown', pointDown);
        renderer!.domElement.removeEventListener('pointerup', pointUp);
        renderer!.domElement.removeEventListener('pointercancel', cancel);
        renderer!.domElement.removeEventListener('webglcontextlost', contextLost);
        geometries.forEach(geometry => geometry.dispose());
        texture?.dispose(); ink.dispose(); paper.dispose(); edge.dispose(); cutMaterial.dispose(); outlineMaterial.dispose();
        panelMaterials.forEach(material => material.dispose()); key.shadow.dispose();
      };
      setReady(true); frame = requestAnimationFrame(animate);
    }
    void start().catch(() => { if (!disposed) setError('3D-visningen er ikke tilgængelig på denne enhed. Dit design vises fladt nedenfor.'); });
    return () => {
      disposed = true; api.current = null; cleanup();
      renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
    };
  }, [definition, artwork, productColor, printInside]);

  return <div className={`folder-mockup-body${compactControls ? ' folder-mockup-compact' : ''}`} data-mockup-ready={ready} data-preview-mode={productColor ? 'product' : 'artwork'} data-print-mode={printInside ? '4+4' : '4+0'}>
    <div className="folder-mockup-stage-wrap">
      <div ref={host} className="folder-mockup-stage" tabIndex={error ? -1 : 0} role="group"
        aria-label="3D-map­pe. Brug piletasterne til at dreje og plus eller minus til at zoome."
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
          event.preventDefault();
          if (event.key.startsWith('Arrow')) api.current?.rotate(event.key === 'ArrowLeft' ? -0.15 : event.key === 'ArrowRight' ? 0.15 : 0, event.key === 'ArrowUp' ? -0.15 : event.key === 'ArrowDown' ? 0.15 : 0);
          else api.current?.zoom(event.key === '-' ? 1.12 : 0.89);
        }} />
      {error && <div className="folder-mockup-fallback"><p role="status">{artwork ? error : '3D-visningen er ikke tilgængelig på denne enhed.'}</p>{artwork && <img src={artwork} alt="Dit design på den udfoldede trykflade" />}</div>}
      {!ready && !error && <p className="folder-mockup-stage-loading" role="status">Åbner 3D-visningen…</p>}
      {!error && <div className="folder-mockup-camera">
        <Button type="button" variant="outline" size="icon" aria-label="Zoom ind" onClick={() => api.current?.zoom(0.85)}><ZoomIn size={18} /></Button>
        <Button type="button" variant="outline" size="icon" aria-label="Zoom ud" onClick={() => api.current?.zoom(1.18)}><ZoomOut size={18} /></Button>
        <Button type="button" variant="outline" size="icon" aria-label="Nulstil vinkel" onClick={() => api.current?.reset()}><RotateCcw size={17} /></Button>
      </div>}
    </div>
    {!error && <div className="folder-mockup-controls">
      {!compactControls && <p>Træk for at dreje. Tryk på en fold for at åbne den.</p>}
      <div className="folder-mockup-folds" aria-label="Mappens folder">
        {definition.panels.filter(panel => panel.id !== 'back').map(panel => <Button key={panel.id} type="button"
          variant={folds[panel.id as FoldId] ? 'default' : 'outline'} aria-pressed={folds[panel.id as FoldId]} disabled={!ready}
          onClick={() => setFolds(current => toggleFold(current, panel.id as FoldId))}>
          {panel.label}<span className={compactControls ? 'sr-only' : 'folder-mockup-fold-status'}>{folds[panel.id as FoldId] ? ' Åben' : ' Lukket'}</span>
        </Button>)}
      </div>
      <div className="folder-mockup-all"><Button type="button" variant="ghost" disabled={!ready} onClick={() => setFolds({ ...OPEN_FOLDS })}>Fold helt ud</Button>
        <Button type="button" variant="ghost" disabled={!ready} onClick={() => setFolds({ ...CLOSED_FOLDS })}>Luk mappen</Button>
        <Button type="button" variant="ghost" disabled={!ready} onClick={() => api.current?.reset(true)}>Se bagsiden</Button></div>
    </div>}
  </div>;
}
