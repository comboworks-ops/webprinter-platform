import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const { build } = createRequire(import.meta.resolve('vite'))('esbuild');
const root = fileURLToPath(new URL('../../', import.meta.url));
let browser, page, script;
const errors = [];

// Actual login pages and account shell, isolated from the hosted authentication
// service. No test credentials, users, roles or sessions reach the real backend.
const mocks = {
  '@/integrations/supabase/client': `
    let user = null;
    const listeners = new Set();
    export const supabase = {
      auth: {
        getSession: async () => ({data:{session:user ? {user} : null}}),
        getUser: async () => ({data:{user}, error:null}),
        onAuthStateChange(callback) { listeners.add(callback); return {data:{subscription:{unsubscribe(){listeners.delete(callback)}}}} },
        async signInWithPassword({email}) {
          user = {id:email.split('@')[0], email};
          listeners.forEach(callback => callback('SIGNED_IN', {user}));
          return {data:{user,session:{user}},error:null};
        },
        async signOut() { user=null; listeners.forEach(callback=>callback('SIGNED_OUT',null)); return {error:null} },
        updateUser: async () => ({data:{user},error:null})
      },
      functions:{async invoke(){
        const current = user;
        await new Promise(resolve=>setTimeout(resolve,100));
        return {data:{isAdmin:['admin','master'].includes(current?.id), isMasterAdmin:current?.id==='master'}};
      }},
      from(table) { return {select:()=>({eq:asyncQuery})}; function asyncQuery(){
        if(table==='user_roles') return Promise.resolve({data:user?.id==='customer' ? [{role:'user'}] : [],error:null});
        return {maybeSingle:async()=>({data:user?.id==='owner' ? {id:'shop-a'} : null,error:null})};
      }}
    };
  `,
  '@/lib/adminTenant': `export const MASTER_TENANT_ID='master'; export const resolveAdminTenant=async()=>({tenantId:'shop-a'});`,
  '@/hooks/useShopSettings': `export const useShopSettings=()=>({data:{tenant_name:'Salgsmapper.dk'},isLoading:false});`,
  '@/hooks/useHeaderFit': `export const useHeaderFit=()=>({compact:false,rowRef:null,logoRef:null,navigationRef:null,actionsRef:null});`,
  '@/components/Header': `export default function Header(){return null}`,
  '@/components/Footer': `export default function Footer(){return null}`,
  './CustomerAccountContext': `
    import {useLocation} from 'react-router-dom';
    import {customerLink} from '@/lib/account/navigation';
    export function useCustomerAccount(){const location=useLocation();return {user:{id:'fixture',email:'fixture@example.test'},shop:{tenant_name:'Salgsmapper.dk'},profile:null,link:href=>customerLink(href,location.search)}}
  `,
};
const fixture = `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
  import {LanguageProvider,useLanguage} from './src/contexts/LanguageContext.tsx';
  import Auth from './src/pages/Auth.tsx';
  import AdminLogin from './src/pages/AdminLogin.tsx';
  import {AccountShell} from './src/components/account/AccountShell.tsx';
  function Content(){const {setLanguage}=useLanguage();const location=useLocation();return <>
    <button onClick={()=>setLanguage('en')}>English</button>
    <output id="route">{location.pathname+location.search+location.hash}</output>
    <Routes>
      <Route path="/auth" element={<Auth/>}/>
      <Route path="/admin/login" element={<AdminLogin/>}/>
      <Route path="/admin/*" element={<div>Backend fixture</div>}/>
      <Route path="/min-konto/*" element={<AccountShell title="Min konto"><p>Customer fixture</p></AccountShell>}/>
      <Route path="/checkout/*" element={<div>Checkout fixture</div>}/>
    </Routes>
  </>}
  createRoot(document.getElementById('root')).render(<BrowserRouter><LanguageProvider><Content/></LanguageProvider></BrowserRouter>);
`;

before(async () => {
  const bundle = await build({
    absWorkingDir: root, stdin: {contents:fixture,resolveDir:root,loader:'jsx'},
    alias:{'@':path.join(root,'src')}, bundle:true, write:false, platform:'browser', format:'iife', jsx:'automatic',
    plugins:[{name:'isolated-auth',setup(build){
      build.onResolve({filter:/.*/},args=>mocks[args.path] ? {path:args.path,namespace:'auth-mock'} : undefined);
      build.onLoad({filter:/.*/,namespace:'auth-mock'},args=>({contents:mocks[args.path],loader:'jsx',resolveDir:root}));
      build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
    }}],
  });
  script = bundle.outputFiles[0].text;
  browser = await chromium.launch({headless:true,executablePath:process.env.AUTH_TEST_BROWSER_PATH || undefined});
  page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://login.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}));
});
after(async()=>{await browser?.close();});

async function open(route) { await page.goto(`http://login.test${route}`); await page.addScriptTag({content:script}); await page.locator('#route').waitFor(); }
async function login(identity, admin = false) {
  await page.getByLabel('Email',{exact:true}).fill(`${identity}@example.test`);
  await page.getByLabel('Adgangskode',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:admin ? 'Log ind som administrator' : 'Log ind',exact:true}).click();
}
async function destination(path) { await page.waitForFunction(expected=>document.querySelector('#route')?.textContent===expected,path); }

test('customer login leads to the tenant customer account without administration',async()=>{
  await open('/auth?force_domain=salgsmapper.dk');
  await login('customer');
  await destination('/min-konto?force_domain=salgsmapper.dk');
  assert.equal(await page.getByRole('link',{name:'Administration',exact:true}).count(),0);
});
for(const identity of ['admin','master','owner']) {
  test(`${identity} using the customer login goes directly to the tenant backend`,async()=>{
    await open('/auth?force_domain=salgsmapper.dk'); await login(identity);
    await destination('/admin?force_domain=salgsmapper.dk');
  });
  test(`${identity} using administrator login goes directly to the tenant backend`,async()=>{
    await open('/admin/login?force_domain=salgsmapper.dk'); await login(identity,true);
    await destination('/admin?force_domain=salgsmapper.dk');
  });
}
test('admin login waits for verification and denies a customer without signing them out',async()=>{
  await open('/admin/login?force_domain=salgsmapper.dk'); await login('customer',true);
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').textContent(),/administrator/);
  assert.equal(await page.locator('#route').textContent(),'/admin/login?force_domain=salgsmapper.dk');
  await page.getByRole('link',{name:'Kundelogin',exact:true}).filter({hasText:'Kundelogin'}).first().click();
  await destination('/min-konto?force_domain=salgsmapper.dk');
});
test('explicit order return is kept and verified admin has an Administration link in My Account',async()=>{
  await open('/auth?force_domain=salgsmapper.dk&redirect=%2Fmin-konto%2Fordrer%3Forder%3D7');
  await login('admin'); await destination('/min-konto/ordrer?order=7&force_domain=salgsmapper.dk');
  const link=page.getByRole('link',{name:'Administration',exact:true});
  await link.waitFor();
  assert.equal(await link.getAttribute('href'),'/admin?force_domain=salgsmapper.dk');
  await link.click(); await destination('/admin?force_domain=salgsmapper.dk');
});
test('explicit checkout return is kept for administrators',async()=>{
  await open('/auth?force_domain=salgsmapper.dk&redirect=%2Fcheckout%2Fkonfigurer%3Fstep%3D2');
  await login('owner'); await destination('/checkout/konfigurer?step=2&force_domain=salgsmapper.dk');
});
test('password recovery stays on the password form after an admin session arrives',async()=>{
  await open('/admin/login?force_domain=salgsmapper.dk'); await login('admin',true);
  await destination('/admin?force_domain=salgsmapper.dk');
  // Navigation keeps the fixture session; a recovery page must not auto-redirect.
  await page.evaluate(()=>{history.pushState(null,'','/auth?force_domain=salgsmapper.dk&mode=reset');window.dispatchEvent(new PopStateEvent('popstate'));});
  await page.getByRole('heading',{name:'Vælg ny adgangskode'}).waitFor();
  assert.equal(await page.getByLabel('Ny adgangskode',{exact:true}).count(),1);
});
test('the two login links retain the tenant and admin page switches to English',async()=>{
  await open('/auth?force_domain=salgsmapper.dk');
  await page.getByRole('link',{name:'Administratorlogin',exact:true}).click();
  await destination('/admin/login?force_domain=salgsmapper.dk');
  assert.match(await page.getByRole('link',{name:'Kundelogin',exact:true}).getAttribute('href'),/force_domain=salgsmapper.dk/);
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByRole('heading',{name:'Administrator Login'}).waitFor();
  assert.match(await page.locator('body').textContent(),/For owners and administrators/);
  assert.deepEqual(errors,[]);
});
