import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AccountWorkspace, AccountState, CustomerShopHeader } from '@/components/account/AccountShell';
import { CustomerOrdersView } from '@/components/account/CustomerOrdersView';
import { CustomerOverviewView } from '@/components/account/CustomerOverviewView';
import { CustomerDesignsView } from '@/components/account/CustomerDesignsView';
import type { CustomerOrder, CustomerOrderDetails } from '@/lib/account/orders';
import '@/index.css';

const initialOrders: CustomerOrder[] = [
  { id:'sample-1048',order_number:'WP-1048',product_name:'Brochurer A4',quantity:250,total_price:1295,status:'pending',requires_file_reupload:true,created_at:'2026-09-07T12:36:00Z',product:{image_url:'/design-presets/category-print.webp',slug:'brochurer',is_published:false} },
  { id:'sample-1042',order_number:'WP-1042',product_name:'Visitkort',quantity:500,total_price:495,status:'production',created_at:'2026-09-05T10:00:00Z',product:{image_url:'/platform/slider/Visitkort.png',slug:'visitkort',is_published:false} },
  { id:'sample-1021',order_number:'WP-1021',product_name:'Plakater A3',quantity:100,total_price:895,status:'delivered',created_at:'2026-09-01T09:00:00Z',delivered_at:'2026-09-04T13:00:00Z',product:{image_url:'/design-presets/category-posters.webp',slug:'plakater',is_published:false} },
];
const baseDetails: CustomerOrderDetails = {
  messages:{status:'ready',data:[{id:'message-1',sender_type:'admin',content:'Kan du sende filen med 3 mm beskæring?',created_at:'2026-09-08T07:12:00Z',is_read:true}]},
  files:{status:'ready',data:[{id:'file-1',file_name:'brochure-v1.pdf',file_url:'',is_current:true,uploaded_at:'2026-09-07T12:36:00Z',file_size:1234567}]},
  invoices:{status:'ready',data:[]},tracking:{status:'ready',data:[]},history:{status:'ready',data:[]},
};
const emptyDetails: CustomerOrderDetails = {messages:{status:'ready',data:[]},files:{status:'ready',data:[]},tracking:{status:'ready',data:[]},invoices:{status:'ready',data:[]},history:{status:'ready',data:[]}};
const previewPath = '/output/design-exploration/customer-account-2026-09-08/implemented.html';
const profile = {first_name:'Anna',last_name:'Sørensen',company:'Studio Nord',phone:''};
function Preview() {
  const [params,setParams]=useSearchParams();
  const page=params.get('page') || 'orders';
  const state=params.get('state') || 'ready';
  const selected=params.has('order') ? params.get('order') || null : 'sample-1048';
  const [orders,setOrders]=useState(initialOrders);
  const [details,setDetails]=useState(baseDetails);
  const [notice,setNotice]=useState('');
  const [shopColour,setShopColour]=useState('#087fc5');
  const link=(href:string) => {
    const target=new URL(href,'https://preview.invalid');
    if(!target.pathname.startsWith('/min-konto')) return href;
    const pages:Record<string,string>={'/min-konto':'overview','/min-konto/ordrer':'orders','/min-konto/designs':'designs','/min-konto/adresser':'addresses','/min-konto/indstillinger':'settings'};
    const query=new URLSearchParams({page:pages[target.pathname] || 'overview'});
    if(target.searchParams.has('order')) query.set('order',target.searchParams.get('order')!);
    return `${previewPath}?${query}`;
  };
  const title=page==='overview'?'Goddag, Anna':page==='designs'?'Mine designs':page==='addresses'?'Dine adresser':page==='settings'?'Dine oplysninger':'Dine ordrer';
  const description=page==='orders'?'Se og følg dine ordrer, upload nye filer og hold dialogen med trykkeriet.':page==='overview'?'Her er dine bestillinger og det næste skridt.':page==='designs'?'Find et gemt design, og fortsæt i designeren.':undefined;
  const currentPath=page==='overview'?'/min-konto':page==='orders'?'/min-konto/ordrer':page==='designs'?'/min-konto/designs':page==='addresses'?'/min-konto/adresser':'/min-konto/indstillinger';
  const retry=()=>{const next=new URLSearchParams(params);next.delete('state');setParams(next);};
  return <>
    <AccountWorkspace title={title} description={description} currentPath={currentPath} link={link} onLogout={()=>setNotice('Dette er en lokal forhåndsvisning. Der er ingen kunde logget ind.')} actions={<Link className="customer-button" to="/produkter?tenantId=00000000-0000-0000-0000-000000000000">Ny bestilling <ArrowRight size={18}/></Link>}
      style={{'--customer-blue':shopColour} as React.CSSProperties}
      header={<CustomerShopHeader shop={{tenant_name:'webprinter',branding:{header:{logoType:'text',logoText:'webprinter',logoTextColor:'#fff',bgColor:shopColour,textColor:'#fff'}}}} profile={profile} email="anna@example.test" link={link}/>}>
      {page==='orders' ? state==='error' ? <AccountState kind="error" title="Vi kunne ikke hente dine ordrer" description="Prøv igen om et øjeblik." onRetry={retry}/> : state==='loading' ? <AccountState kind="loading" title="Henter dine ordrer"/> : state==='empty' ? <AccountState kind="empty" title="Du har ingen ordrer endnu"><Link to={link('/min-konto')}>Til oversigten</Link></AccountState> : <CustomerOrdersView orders={orders} selectedOrderId={selected} onSelectOrder={id=>{const next=new URLSearchParams(params);next.set('order',id || '');setParams(next);}} details={selected==='sample-1048'?details:emptyDetails} onRetryDetails={retry} link={link}
        onSendMessage={async(orderId,message)=>{ if(orderId==='sample-1048')setDetails(current=>({...current,messages:{status:'ready',data:[...(current.messages.status==='ready'?current.messages.data:[]),{id:crypto.randomUUID(),sender_type:'customer',content:message,created_at:'2026-09-08T08:00:00Z',is_read:false}]}}));setNotice('Eksempelbesked tilføjet lokalt. Intet er sendt til trykkeriet.');return true;}}
        onUploadFile={async(orderId,file)=>{setNotice(`Eksempel: ${file.name} er valgt lokalt. Ingen fil er uploadet.`);if(orderId==='sample-1048'){setDetails(current=>({...current,files:{status:'ready',data:[...(current.files.status==='ready'?current.files.data.map(f=>({...f,is_current:false})):[]),{id:crypto.randomUUID(),file_name:file.name,file_url:'',is_current:true,uploaded_at:'2026-09-08T08:00:00Z'}]}}));setOrders(current=>current.map(order=>order.id===orderId?{...order,requires_file_reupload:false}:order));}return true;}}/>
      : page==='overview' ? <CustomerOverviewView orders={state==='empty'?[]:orders} ordersState={state==='error'?'error':state==='loading'?'loading':'ready'} onRetryOrders={retry} link={link} contact={{name:'Anna Sørensen',email:'anna@example.test',company:'Studio Nord'}} defaultAddress={{first_name:'Anna',last_name:'Sørensen',street_address:'Eksempelvej 12',postal_code:'5000',city:'Odense'}}/>
      : page==='designs' ? <CustomerDesignsView state={state==='error'?'error':state==='loading'?'loading':'ready'} onRetry={retry} link={href=>href.startsWith('/designer')?`${previewPath}?page=design-preview`:link(href)} designs={state==='empty'?[]:[{id:'sample-design',name:'Efterårskatalog',width_mm:210,height_mm:297,preview_thumbnail_url:'/design-presets/category-print.webp',updated_at:'2026-09-07T12:00:00Z'}]}/>
      : <AccountState kind="empty" title={page==='design-preview'?'Designet åbnes i den eksisterende designer':'Denne side bruger din rigtige konto'} description="Forhåndsvisningen viser eksempeldata. Log ind i webshoppen for at se dine gemte oplysninger og adresser."><a className="customer-button" href="/auth?tenantId=00000000-0000-0000-0000-000000000000&redirect=/min-konto">Åbn kundelogin</a></AccountState>}
    </AccountWorkspace>
    <details className="customer-preview-tools"><summary>Lokal designvisning · eksempeldata</summary><p>Samme visningskomponenter som kundekontoen. Ingen kunde er logget ind; beskeder og filvalg bliver kun i denne visning.</p><div><label>Tilstand <select aria-label="Eksempeltilstand" value={state} onChange={event=>{const next=new URLSearchParams(params);next.set('state',event.target.value);setParams(next);}}><option value="ready">Med indhold</option><option value="empty">Ny kunde</option><option value="loading">Indlæser</option><option value="error">Kunne ikke hente</option></select></label><button onClick={()=>setShopColour(current=>current==='#087fc5'?'#a4440b':'#087fc5')}>Prøv anden butiksfarve</button><a href="/auth?tenantId=00000000-0000-0000-0000-000000000000">Rigtigt kundelogin</a></div>{notice&&<p role="status">{notice}</p>}</details>
  </>;
}
if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<BrowserRouter><Preview/></BrowserRouter>);
}
