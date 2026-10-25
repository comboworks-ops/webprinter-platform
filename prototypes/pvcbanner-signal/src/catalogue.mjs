export const groups = ['Alle produkter', 'Bannere', 'Skilte & folie', 'Messe & display', 'Tryksager'];
export const products = [
  { id: 'pvc-banner', title: 'PVC-banner', group: 'Bannere', image: 'signal-banner-detail.png', tag: 'Din størrelse. Dit budskab.', text: 'Et alsidigt banner til store budskaber. Vælg dine mål, tilpas ophænget, og se dit design tage form.', type: 'banner', sizes: [[200,100],[300,100],[400,150]], material: 'PVC' },
  { id: 'beachflag', title: 'Beachflag', group: 'Messe & display', image: 'signal-flag.png', tag: 'Fang opmærksomheden.', text: 'En let genkendelig silhuet til indgangen, eventet og din næste messe.', type: 'fixed', sizes: [[60,200],[70,300],[80,400]], material: 'Flagstof' },
  { id: 'roll-up', title: 'Roll-up', group: 'Messe & display', image: 'signal-rollup.png', tag: 'Professionel præsentation.', text: 'Et enkelt display til receptionen, præsentationen eller messen.', type: 'fixed', sizes: [[85,200],[100,200],[120,200]], material: 'Displayfilm' },
  { id: 'flyers', title: 'Flyers', group: 'Tryksager', image: 'signal-flyers.png', tag: 'Små formater. Stor effekt.', text: 'Tag dit budskab med videre. Vælg format og antal til din næste kampagne.', type: 'print', sizes: [[14.8,21],[21,29.7],[10.5,14.8]], material: 'Papir' },
  { id: 'mesh-banner', title: 'Mesh-banner', group: 'Bannere', image: 'signal-mesh-swatch.png', tag: 'Lad dit budskab fylde.', text: 'Et banner med åben struktur. Tilpas mål og ophæng til din opgave.', type: 'banner', sizes: [[200,100],[300,100],[400,150]], material: 'Mesh' },
  { id: 'skilte', title: 'Skilte', group: 'Skilte & folie', image: 'signal-sign.png', tag: 'Giv dit brand en plads.', text: 'Skilte til din butik, udstilling og hverdag. Se dit udtryk i et nyt format.', type: 'fixed', sizes: [[50,70],[70,100],[100,150]], material: 'Plademateriale' },
  { id: 'messestand', title: 'Messestand', group: 'Messe & display', image: 'signal-stand.png', tag: 'Mød dit publikum.', text: 'Saml dit udtryk på messen med en bagvæg og en matchende disk.', type: 'fixed', sizes: [[200,230],[300,230],[400,230]], material: 'Tekstil' },
];
export const asset = name => `${import.meta.env?.BASE_URL || "/"}assets/${name}`;
export function initialConfiguration(product) {
  const [width,height] = product.id === 'pvc-banner' ? [300,100] : product.sizes[0];
  return { width:String(width), height:String(height), material:product.material, eyelets:'50', reinforced:true, quantity:product.type === 'print' ? 250 : 1 };
}
export const parseCm = value => /^\d+(?:[.,]\d+)?$/.test(String(value).trim()) ? Number(String(value).replace(',','.')) : NaN;
export function validateConfiguration(config, product) {
  const width=parseCm(config.width), height=parseCm(config.height);
  const min=product.type === 'print' ? 5 : product.type === 'banner' ? 50 : 10;
  if (!Number.isFinite(width) || width < min || width > 500) return `Vælg en bredde mellem ${min} og 500 cm.`;
  if (!Number.isFinite(height) || height < min || height > 5000) return `Vælg en højde mellem ${min} og 5000 cm.`;
  if (!Number.isInteger(config.quantity) || config.quantity < 1 || config.quantity > 10000) return 'Vælg et antal mellem 1 og 10.000.';
  return '';
}
export function bannerGeometry(width,height,spacing) {
  if (![width,height].every(n=>Number.isFinite(n)&&n>0)) return null;
  const holes=[];
  if(Number(spacing)>0) {
    const nx=Math.min(80,Math.ceil(width/Number(spacing))), ny=Math.min(80,Math.ceil(height/Number(spacing)));
    for(let x=0;x<=nx;x++) { holes.push([x/nx,0],[x/nx,1]); }
    for(let y=1;y<ny;y++) { holes.push([0,y/ny],[1,y/ny]); }
  }
  return { ratio:width/height, area:width*height/10000, holes };
}
// One labelled, non-commercial comparison fixture. No invented pricing formula.
// Every other selection must await an authoritative Webprinter quote.
export function exampleQuote(product,config) {
  return product.id==='pvc-banner' && parseCm(config.width)===300 && parseCm(config.height)===100 && config.material==='PVC' && config.eyelets==='50' && config.reinforced && config.quantity===1 ? 495 : null;
}
export function snapshotItem(product,config,artwork) {
  const error=validateConfiguration(config,product); if(error)throw new Error(error);
  return { id:crypto.randomUUID(), productId:product.id, title:product.title, image:product.image, config:{...config}, artwork:artwork?{...artwork}:null, exampleAmount:exampleQuote(product,config) };
}
