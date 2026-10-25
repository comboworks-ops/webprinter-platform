import { useSignalBranding } from './signalBrandingContext';
import { useState } from 'react';
import { ArrowRight, Search} from 'lucide-react';
import { products, groups, asset } from '../../../prototypes/pvcbanner-signal/src/catalogue.mjs';
import { Button, Breadcrumb, go } from './PvcbannerShell.jsx';

export function ProductCard({product}) {
  const b=useSignalBranding();
  return <a className="product-card" href={product.href || `#/produkt/${product.id}`} target={product.href ? "_top" : undefined}><div className="product-image"><img src={product.imageUrl || asset(product.image)} alt={product.title} loading="lazy"/><span className="product-arrow"><ArrowRight size={22}/></span></div><div className="product-copy"><h3>{product.title}<ArrowRight size={21}/></h3><p>{product.tag}</p>{b.designId === 'fieldwork' && <span className="product-spec-group">{product.group}</span>}{['format-express','fieldwork'].includes(b.designId) && <span className="product-configure">Vælg produkt <ArrowRight size={17}/></span>}</div></a>;
}
export function Home({catalogue=products, overrides={}, sectionOrder=["hero","banner2","products","content","usp","seo"]}) {
  const b = useSignalBranding();
  const nodes = {
hero: (b.showHero && <section className="hero" data-signal-section="banner" data-layout={b.heroLayout} style={{minHeight:b.heroHeight,background:b.heroBackground,color:b.heroTextColor,'--hero-size':`${b.heroSize}px`,'--hero-mobile-size':`${b.heroMobileSize}px`,'--hero-copy-size':`${b.heroTextSize}px`}}>
      <div className="hero-copy"><p className="eyebrow">{b.heroEyebrow}</p><h1 style={{whiteSpace:"pre-line"}}>{b.heroTitle}</h1><p className="hero-description" style={{whiteSpace:"pre-line"}}>{b.heroDescription}</p><div className="hero-actions"><Button buttonKey="hero" data-signal-section="main-buttons" onClick={()=>(b.navigate || go)(b.heroLink)}>{b.heroButton}</Button>{b.showSecondaryButton && <Button buttonKey="hero" data-signal-section="main-buttons" secondary arrow={false} onClick={()=>(b.navigate || go)(b.secondaryLink)}>{b.secondaryButton}</Button>}</div>{b.designId === 'format-express' && <div className="express-product-start" aria-label="Vælg dit produkt">{catalogue.slice(0,3).map(p=><a key={p.id} href={p.href || `#/produkt/${p.id}`}><img src={p.imageUrl || asset(p.image)} alt=""/><span>{p.title}</span><ArrowRight size={16}/></a>)}</div>}</div>
      <div className="hero-art"><img src={b.heroImage} alt={b.heroImageAlt} style={{objectPosition:`${b.heroImagePosition}% center`}} fetchpriority="high"/></div>
    </section>),
banner2: (b.showRibbon && <section data-signal-section="showcase" className={`category-ribbon ${b.ribbonMode === 'image' ? 'ribbon-image' : ''}`} style={{backgroundColor:b.ribbonBackground,color:b.ribbonColor,minHeight:b.ribbonHeight,fontSize:b.ribbonSize}} aria-label="Mellembanner">
      {b.ribbonMode === 'image' && <img src={b.ribbonImage} alt={b.ribbonImageAlt} loading="lazy"/>}
      {[1,2,3].map(n=><a key={n} href={`${b.nativeLinks ? '' : '#'}${b[`ribbonLink${n}`]}`}>{b[`ribbonText${n}`]}<ArrowRight size={18}/></a>)}
    </section>),
products: (b.showProducts && <section data-signal-section="products" className="featured section-wrap" aria-label="Populære formater">{b.featuredTitle && <h2>{b.featuredTitle}</h2>}<div className="product-grid">{catalogue.slice(0,4).map(p=><ProductCard key={p.id} product={p}/>)}</div></section>),
content: (b.showStory && <section className="wide-story section-wrap" data-signal-section="content" data-layout={b.storyLayout} style={{background:b.storyBackground,color:b.storyTextColor,'--story-size':`${b.storySize}px`,'--story-copy-size':`${b.storyTextSize}px`}}><div className="story-image"><img src={b.storyImage} alt={b.storyImageAlt} loading="lazy"/></div><div className="story-copy"><p className="eyebrow">{b.storyEyebrow}</p><h2 style={{whiteSpace:'pre-line'}}>{b.storyTitle}</h2><p>{b.storyText}</p><Button buttonKey="story" data-signal-section="main-buttons" onClick={()=>(b.navigate || go)(b.storyLink)}>{b.storyButton}</Button></div></section>),
usp: (b.showSteps && <section className="steps-strip section-wrap" data-signal-section="usp-strip" style={{background:b.stepsBackground,color:b.stepsTextColor}}><h2>{b.stepsTitle}</h2><div>{[1,2,3].map(n=><article key={n}><span>0{n}</span><h3>{b[`step${n}Title`]}</h3><p>{b[`step${n}Text`]}</p></article>)}</div></section>),
seo: null,
};
  return <main className="signal-home">{sectionOrder.map(key => <div key={key} data-wide-section={key}>{Object.hasOwn(overrides,key) ? overrides[key] : nodes[key]}</div>)}
  </main>;
}
export function Catalogue({route,catalogue=products}) {
  const b = useSignalBranding();
  const category=new URLSearchParams(route.split('?')[1]).get('gruppe')||'Alle produkter';
  const [search,setSearch]=useState('');
  const visible=catalogue.filter(p=>(category==='Alle produkter'||p.group===category)&&`${p.title} ${p.tag}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="section-wrap catalogue" style={{'--catalogue-size':`${b.catalogueSize}px`}}><Breadcrumb current="Produkter"/><div className="catalogue-title" data-signal-section="products"><div><p className="eyebrow">{b.catalogueEyebrow}</p><h1>{b.catalogueTitle}</h1><p>{b.catalogueDescription}</p></div><label className="search-field"><Search size={20}/><input aria-label="Søg i produkter" placeholder="Hvad vil du skabe?" value={search} onChange={e=>setSearch(e.target.value)}/></label></div><div className="filter-tabs" aria-label="Filtrér produkter">{groups.map(group=><button aria-pressed={category===group} className={category===group?'selected':''} key={group} onClick={()=>(b.navigate || go)(`/produkter?gruppe=${encodeURIComponent(group)}`)}>{group}</button>)}</div><p className="result-count" role="status">{visible.length} produkter</p>{b.designId==='fieldwork' && <div className="catalogue-column-headings" aria-hidden="true"><span>Produkt</span><span>Beskrivelse</span><span>Kategori</span><span>Bestilling</span></div>}<div className="product-grid catalogue-grid">{visible.map(p=><ProductCard key={p.id} product={p}/>)}</div>{!visible.length&&<div className="empty-state"><Search size={34}/><h2>Vi fandt ikke det format.</h2><p>Prøv et andet søgeord, eller se hele udvalget.</p><Button onClick={()=>{setSearch('');(b.navigate || go)('/produkter');}}>Se alle produkter</Button></div>}</main>;
}
