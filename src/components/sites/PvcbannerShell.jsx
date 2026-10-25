import { resolveSharedButton, sharedButtonAttributes } from '../../lib/branding/sharedButtons';
import { useSignalBranding } from './signalBrandingContext';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Search, UserRound, ShoppingBag, Menu, X } from 'lucide-react';
import { useHeaderFit } from '../../hooks/useHeaderFit';
import { products, groups, asset } from '../../../prototypes/pvcbanner-signal/src/catalogue.mjs';

export const number = value => Number(value).toLocaleString('da-DK', {maximumFractionDigits:2});
export const money = value => `${number(value)} kr.`;
export function go(route) {
  if (import.meta.env.VITE_WEBPRINTER_CONNECTED === 'true' && !/^\/(?:$|produkter(?:\?|$))/.test(route)) {
    if (new URLSearchParams(location.search).get('editor') === '1' && window.parent !== window) window.parent.postMessage({type:'PVC_NAVIGATE',path:route},location.origin);
    else if(window.parent !== window) window.parent.postMessage({type:'PVC_NAVIGATE',path:route},location.origin);
    else window.top.location.assign(route);
    return;
  }
  location.hash=route;
}
export function Button({children,onClick,secondary=false,arrow=true,className='',buttonKey='hero',...props}) {
  const b = useSignalBranding();
  return <button data-button-style={b.buttonStyle} className={`button ${secondary?'secondary':''} ${className}`} onClick={onClick} {...props} {...sharedButtonAttributes(resolveSharedButton(b.fullBranding, 'cta', buttonKey), 'cta')}><span>{children}</span>{arrow&&<ArrowRight size={19}/>}</button>;
}
export function Brand() {const b=useSignalBranding();return <a className="brand" style={{'--logo-size':`${b.logoSize}px`,'--brand-size':`${b.brandSize}px`}} data-signal-section="logo" href={b.nativeLinks ? "/" : "#/"} aria-label={`${b.brand} — Forside`}><img src={b.logo} alt=""/><span><strong>{b.brand}</strong><small>by Webprinter</small></span></a>;}
export function Dialog({title,children,onClose,className=''}) {
  const ref=useRef(null), titleId=useId();
  useEffect(()=>{const dialog=ref.current;const focus=document.activeElement;dialog.showModal();dialog.querySelector('input')?.focus();return()=>{dialog.close();if(focus instanceof HTMLElement&&focus.isConnected)focus.focus();};},[]);
  return <dialog ref={ref} aria-labelledby={titleId} className={`dialog ${className}`} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="dialog-inner"><div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Luk" onClick={onClose}><X/></button></div>{children}</div></dialog>;
}
export function Header({cartCount=0,onSearch,onAccount,catalogue=products,orderHref,onLanguage,languageLabel}) {
  const b=useSignalBranding(); const label=group=>({Bannere:b.menuBanners,'Skilte & folie':b.menuSigns,'Messe & display':b.menuDisplay,Tryksager:b.menuPrint})[group] || group;
  const [menuQuery,setMenuQuery]=useState('');
  const [menu,setMenu]=useState(false), [active,setActive]=useState(null);
  const headerRef=useRef(null), closeTimer=useRef(null), lastActive=useRef(groups[1]), triggerRef=useRef(null);
  const cancelClose=()=>clearTimeout(closeTimer.current);
  const closeMenu=(restore=false)=>{cancelClose();setActive(null);setMenu(false);if(restore)triggerRef.current?.focus();};
  const openMenu=(group,target)=>{cancelClose();triggerRef.current=target;setActive(group);};
  if(active) lastActive.current=active;
  const displayedGroup=active || lastActive.current;
  const directory=['open-directory','focus-curtain','kinetic-type','paper-fold'].includes(b.dropdownStyle);
  const shownProducts=catalogue.filter(p=>(directory || p.group===displayedGroup) && `${p.title} ${p.tag}`.toLowerCase().includes(menuQuery.toLowerCase()));
  const fit=useHeaderFit({minimumDesktopWidth:850,clearance:24});
  useEffect(()=>{setMenu(false);setActive(null);},[fit.compact]);
  useEffect(()=>{if(b.previewMenu){if(fit.compact)setMenu(true);else setActive(groups[1]);}else {setMenu(false);setActive(null);}},[b.previewMenu,fit.compact]);
  useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
  useEffect(()=>{const changed=()=>closeMenu();window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
  useEffect(()=>{const key=e=>{if(e.key==='Escape'){closeMenu(true);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  const toCategory=group=>{setMenu(false);setActive(null);(b.navigate || go)(`/produkter?gruppe=${encodeURIComponent(group)}`);};
  const links=groups.slice(1).map(group=><button key={group} className={active===group?'nav-active':''} aria-controls="signal-product-menu" aria-expanded={active===group}
    onPointerEnter={event=>{if(b.menuTrigger==='hover' && event.pointerType==='mouse')openMenu(group,event.currentTarget);}}
    onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();openMenu(group,event.currentTarget);requestAnimationFrame(()=>headerRef.current?.querySelector('.mega-menu a, .mega-menu .text-button')?.focus());}}}
    onClick={event=>active===group?closeMenu():openMenu(group,event.currentTarget)}>{label(group)}<ChevronDown size={16}/></button>);
  return <header ref={headerRef} className="site-header" data-header-mode={fit.mode} data-signal-section="header" style={{background:b.headerBackground,color:b.headerTextColor,'--menu-size':`${b.menuSize}px`,'--header-height':`${b.headerHeight}px`,'--dropdown-bg':b.dropdownBackground,'--dropdown-text':b.dropdownTextColor}}
    onPointerEnter={cancelClose} onPointerLeave={()=>{if(b.menuTrigger==='hover')closeTimer.current=setTimeout(()=>setActive(null),180);}}
    onBlur={event=>{if(!b.previewMenu && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))closeMenu();}}>
    <div className="header-inner responsive-header-row" ref={fit.rowRef}>
      <div className="responsive-header-logo" ref={fit.logoRef}><Brand/></div>
      <nav className="responsive-header-desktop responsive-header-navigation" ref={fit.navigationRef} aria-label="Produktkategorier">{links}</nav>
      <div className="responsive-header-desktop responsive-header-actions" ref={fit.actionsRef}>
        <>{onLanguage&&<button className="icon-button labeled" onClick={onLanguage} aria-label={`Sprog: ${languageLabel}`}>{languageLabel}</button>}</><button className="icon-button labeled" onClick={onSearch}><Search/><span>Søg</span></button>
        <button className="icon-button labeled" onClick={onAccount}><UserRound/><span>Konto</span></button>
        <a className="icon-button bag" href={orderHref || "#/kurv"} target={orderHref ? "_top" : undefined} aria-label={orderHref ? "Din bestilling" : `Kurv, ${cartCount} produkter`}><ShoppingBag/>{cartCount>0&&<b>{cartCount}</b>}</a>
      </div>
      <div className="responsive-header-compact"><button className="icon-button" onClick={onSearch} aria-label="Søg produkter"><Search/></button><a className="icon-button bag" href={orderHref || "#/kurv"} target={orderHref ? "_top" : undefined} aria-label={orderHref ? "Din bestilling" : `Kurv, ${cartCount} produkter`}><ShoppingBag/>{cartCount>0&&<b>{cartCount}</b>}</a><button className="icon-button" data-header-toggle aria-label={menu?'Luk menu':'Åbn menu'} aria-expanded={menu} aria-controls="compact-menu" onClick={event=>{triggerRef.current=event.currentTarget;setMenu(!menu);}}>{menu?<X/>:<Menu/>}</button></div>
    </div>
    <nav id="compact-menu" className="compact-menu" aria-label="Mobilmenu" data-open={menu && fit.compact} ref={element=>{if(element)element.inert=!menu || !fit.compact;}} aria-hidden={!menu || !fit.compact}>{onLanguage&&<button onClick={onLanguage}>Sprog: {languageLabel}</button>}{groups.map(group=><button key={group} onClick={()=>toCategory(group)}>{label(group)}<ArrowRight size={18}/></button>)}<button onClick={()=>{closeMenu();onAccount();}}>Konto<UserRound size={18}/></button></nav>
    <div id="signal-product-menu" className={`mega-menu mega-${b.dropdownStyle}`} data-open={Boolean(active) && !fit.compact} ref={element=>{if(element)element.inert=!active || fit.compact;}} aria-hidden={!active || fit.compact}>
      {['tabbed-explorer','search-and-discover'].includes(b.dropdownStyle) && <div className="menu-explorer-controls">{b.dropdownStyle==='search-and-discover' && <label className="search-field"><Search size={18}/><input aria-label="Søg i produktmenu" value={menuQuery} onChange={e=>setMenuQuery(e.target.value)} placeholder="Find dit produkt…"/></label>}<div className="menu-category-tabs">{groups.slice(1).map(group=><button key={group} aria-pressed={group===displayedGroup} onClick={()=>setActive(group)}>{label(group)}</button>)}</div></div>}
      <div className="menu-intro"><p className="eyebrow">FIND DIT FORMAT</p><h2>{label(displayedGroup)}</h2><button className="text-button" onClick={()=>toCategory(displayedGroup)}>Se alle {label(displayedGroup).toLowerCase()} <ArrowRight size={18}/></button></div>
      <div className="mega-products" key={displayedGroup}>{directory ? groups.slice(1).map(group=><section className="menu-directory-column" key={group}><button className="text-button" onClick={()=>toCategory(group)}>{label(group)}<ArrowRight size={16}/></button>{shownProducts.filter(p=>p.group===group).map(p=><a key={p.id} href={p.href || `#/produkt/${p.id}`} onClick={()=>closeMenu()}><img src={p.imageUrl || asset(p.image)} alt="" loading="lazy"/><strong>{p.title}</strong></a>)}</section>) : shownProducts.map(p=><a key={p.id} href={p.href || `#/produkt/${p.id}`} target={p.href ? "_top" : undefined} onClick={()=>closeMenu()}><img src={p.imageUrl || asset(p.image)} alt="" loading="lazy"/><strong>{p.title}</strong><span>{p.tag}</span><ArrowRight className="menu-item-arrow" size={18}/></a>)}
      {!shownProducts.length&&<div className="menu-empty"><p>Vi udvider løbende sortimentet.</p><button className="text-button" onClick={()=>toCategory('Alle produkter')}>Se alle produkter <ArrowRight size={18}/></button></div>}</div>
      <button className="icon-button" onClick={()=>closeMenu(true)} aria-label="Luk produktmenu"><X/></button>
    </div>
    <button className="menu-backdrop" data-open={Boolean(active) && !fit.compact} tabIndex={-1} aria-hidden="true" aria-label="Luk produktmenu" onClick={()=>closeMenu(true)}/>
  </header>;
}
export function Breadcrumb({current}) {
  const b = useSignalBranding();
  return <nav className="breadcrumb" aria-label="Brødkrumme"><a href={b.nativeLinks ? "/" : "#/"}>Forside</a><ChevronRight size={12}/><a href={`${b.nativeLinks ? "" : "#"}/produkter`}>Produkter</a><ChevronRight size={12}/><span>{current}</span></nav>;
}
export function Footer({adminHref,onCookieSettings}){const b=useSignalBranding();return <footer data-signal-section="footer" className="footer section-wrap" style={{background:b.footerBackground,color:b.footerTextColor,'--footer-size':`${b.footerSize}px`}}><div><Brand/><p>{b.footerText}</p></div><div><h3>Find dit format</h3>{groups.slice(1).map(g=><a key={g} href={`${b.nativeLinks ? "" : "#"}/produkter?gruppe=${encodeURIComponent(g)}`}>{g}</a>)}</div><div><h3>Fra idé til print</h3><a href={`${b.nativeLinks ? "" : "#"}${b.heroLink}`}>{b.heroButton}</a><a href={`${b.nativeLinks ? "" : "#"}/produkter`}>Se alle produkter</a><a href={`${b.nativeLinks ? "" : "#"}/grafisk-vejledning`}>Grafisk vejledning</a><a href={`${b.nativeLinks ? "" : "#"}/kontakt`}>Kontakt</a><a href={`${b.nativeLinks ? "" : "#"}/om-os`}>Om os</a><p className="footer-note">{b.footerNote}</p>{adminHref&&<a href={adminHref} target="_top">Shopadministration</a>}</div><div className="footer-bottom"><span>© {new Date().getFullYear()} {b.brand}</span><span>{b.footerSlogan}</span><nav aria-label="Vilkår og privatliv"><a href={`${b.nativeLinks ? "" : "#"}/vilkaar`}>Handelsbetingelser</a><a href={`${b.nativeLinks ? "" : "#"}/privatliv`}>Privatliv</a><a href={`${b.nativeLinks ? "" : "#"}/cookies`}>Cookies</a>{onCookieSettings&&<button onClick={onCookieSettings}>Cookieindstillinger</button>}</nav></div></footer>;}
