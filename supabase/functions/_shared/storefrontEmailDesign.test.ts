import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPublishedBranding } from '../../../src/lib/branding/settings-persistence.ts';
import { brandedEmailFrom, emailContrast, publishedEmailBranding, renderEmailLetter, resolveEmailBrand, type EmailTenant } from './storefrontEmailDesign.ts';
import { buildStorefrontEmail, dispatchStorefrontOrderEmails, resolveStorefrontEmailApiKey, type EmailRepository, type StorefrontEmailRow } from './storefrontOrderEmail.ts';
import { buildStatusEmail } from './storefrontStatusEmail.ts';

const tenantId = '22222222-2222-4222-8222-222222222222';
const orderId = '11111111-1111-4111-8111-111111111111';
const tenant = (settings: Record<string, unknown> = {}): EmailTenant => ({ id: tenantId, name: 'Salgsmapper', settings });
const origin = 'https://staging.example.test';
const config = {mode: 'test' as const,apiKey:'synthetic',from:'Webprinter <ordre@example.test>',siteUrl:origin,allowlist:['customer@example.test']};
test('test order mail requires the dedicated secret; legacy global credential is only a live compatibility fallback', () => {
  const names:string[]=[];
  const globalOnly=(name:string)=>{names.push(name);return name==='RESEND_API_KEY'?'legacy-live-fixture':undefined};
  assert.equal(resolveStorefrontEmailApiKey('test',globalOnly),'');assert.deepEqual(names,['STOREFRONT_ORDER_EMAIL_RESEND_API_KEY']);
  assert.equal(resolveStorefrontEmailApiKey('live',globalOnly),'legacy-live-fixture');
  assert.equal(resolveStorefrontEmailApiKey('test',()=> 'dedicated-fixture'),'dedicated-fixture');
  assert.equal(resolveStorefrontEmailApiKey('disabled',()=>{throw new Error('must not read credentials')}),'');
});
function row(): StorefrontEmailRow {
  return {id:'33333333-3333-4333-8333-333333333333',attempt_id:'44444444-4444-4444-8444-444444444444',order_id:orderId,tenant_id:tenantId,
    notification_type:'customer_confirmation',recipient_email:'customer@example.test',livemode:false,provider_payload:null,claim_token:'fixture',attempts:1,first_attempt_at:new Date().toISOString(),
    message_snapshot:{version:1,tenant_id:tenantId,order_id:orderId,order_number:'TEST-123',quantity:100,total_price:149,currency:'DKK',product_name:'Salgsmapper',shop_name:'Printmaker ApS',support_email:'support@example.test',has_customer_account:true}};
}
test('email publication precedence stays aligned with the actual storefront, including explicit unpublished null', () => {
  for (const settings of [ {}, {branding:{colors:{primary:'#123456'}}}, {branding:{draft:{logo_url:'hidden'}}},
    {branding_published:{logo_url:'old'},branding:{published:null,draft:{logo_url:'hidden'}}},
    {branding_published:{logo_url:'old'},branding:{published:{logo_url:'new'},draft:{logo_url:'hidden'}}},
    {branding_published:{logo_url:'legacy'},branding:{logo_url:'flat'}}, {branding:{history:[],savedDesigns:[],draft:{}}},
    {branding_template_draft:{logo_url:'template draft'}} ]) {
    assert.deepEqual(publishedEmailBranding(settings),extractPublishedBranding(settings) || {});
  }
});
test('published primary and image logo follow the shop while another tenant and unpublished draft stay separate', () => {
  const settings={branding:{published:{colors:{primary:'#A61F36'},logo_url:'/tenant-logo.png',header:{logoType:'image'},fonts:{heading:'Georgia'}},draft:{colors:{primary:'#0000FF'},logo_url:'/private-draft.png'}}};
  const before=structuredClone(settings), red=resolveEmailBrand(tenant(settings),'Fallback',origin);
  assert.equal(red.name,'Salgsmapper'); assert.equal(red.primary,'#A61F36'); assert.equal(red.logoUrl,origin+'/tenant-logo.png');
  assert.match(red.headingFont,/Georgia/); assert.deepEqual(settings,before);
  const blue=resolveEmailBrand({...tenant(),name:'Other shop'},'Fallback',origin);
  assert.equal(blue.primary,'#087FC5'); assert.equal(blue.logoUrl,null);
});
test('unconfigured legacy primary inherits the storefront default while deliberate orange stays orange', () => {
  assert.equal(resolveEmailBrand(tenant({branding:{themeId:'classic',colors:{primary:'#0EA5E9'}}}),'',origin).primary,'#087FC5');
  assert.equal(resolveEmailBrand(tenant({branding:{themeId:'classic',colors:{primary:'#fb923c'}}}),'',origin).primary,'#FB923C');
  assert.equal(resolveEmailBrand(tenant({branding:{themeId:'custom',colors:{primary:'#0EA5E9'}}}),'',origin).primary,'#0EA5E9');
});
test('light, gray and dark brand buttons remain readable and low-contrast body text falls back', () => {
  for(const color of ['#FB923C','#FFFF00','#777777','#FEFEFE','#090909','#A61F36']) {
    const b=resolveEmailBrand(tenant({branding:{published:{colors:{primary:color,bodyText:'#C5CDD8',headingText:'#FFFFFF'}}}}),'',origin);
    assert.ok(emailContrast(b.primary,b.buttonText)>=4.5);
    assert.ok(emailContrast(b.body,'#FFFFFF')>=4.5);assert.ok(emailContrast(b.heading,'#FFFFFF')>=4.5);
  }
});
test('CSS, HTML, image URLs and sender display names cannot inject markup, headers or unverified mailboxes', () => {
  const b=resolveEmailBrand({...tenant({branding:{published:{colors:{primary:'red; background:url(https://evil.test)'},fonts:{heading:'x; color:red'},logo_url:'javascript:alert(1)'}},company:{name:'<img src=x onerror=alert(1)>',cvr:'invalid'}}),name:'Shop <script>\nBcc: bad@example.test'},'',origin);
  assert.equal(b.logoUrl,null);assert.equal(b.primary,'#087FC5');assert.equal(b.headingFont,'Arial,Helvetica,sans-serif');
  for(const url of ['', '//evil.test/logo.png', 'https://user:pass@example.test/logo.png','data:image/svg+xml,evil','http://example.test/logo.png','https://127.0.0.1/logo.png']) {
    assert.equal(resolveEmailBrand(tenant({branding:{logo_url:url}}),'',origin).logoUrl,null);
  }
  const html=renderEmailLetter(b,{label:'Status',headline:'<script>bad</script>',introduction:'Saved & safe',orderNumber:'123',fields:[['Produkt','<img src=x>']],support:null,note:'Behold din ordre'});
  assert.doesNotMatch(html,/<script>|<img src=x|background:url/);assert.match(html,/&lt;script&gt;/);
  const sender=brandedEmailFrom(config.from,b.name);assert.doesNotMatch(sender,/[\r\n]/);assert.equal(sender.match(/<[^<>]+>/g)?.length,1);assert.ok(sender.endsWith('<ordre@example.test>'));
  assert.equal(brandedEmailFrom(config.from,'Print, papir & mere'),'"Print, papir & mere" <ordre@example.test>');
});
test('confirmation uses shop identity, safe sender mailbox and tenant-specific link; other-shop branding is rejected', () => {
  const r=row(),shop=tenant({branding:{published:{colors:{primary:'#A61F36'}}}});
  const p=buildStorefrontEmail(r,config.from,origin,shop);
  assert.equal(p.from,'Salgsmapper <ordre@example.test>');assert.match(String(p.html),/#A61F36/);assert.match(String(p.html),/tenantId=22222222/);assert.equal(p.reply_to,'support@example.test');
  assert.throws(()=>buildStorefrontEmail(r,config.from,origin,{...shop,id:'foreign'}),/email_snapshot_invalid/);
  r.message_snapshot.has_customer_account=false;assert.doesNotMatch(String(buildStorefrontEmail(r,config.from,origin,shop).html),/min-konto/);
});
test('status, production, shipping and problem letters use the same published tenant brand', () => {
  const shop={...tenant({branding:{published:{colors:{primary:'#A61F36'}}},company:{email:'support@example.test'}}),owner_id:null};
  const order={id:orderId,tenant_id:tenantId,checkout_attempt_id:null,order_number:'TEST-123',product_name:'Salgsmapper',quantity:100,total_price:149,currency:'DKK',status:'shipped',customer_email:'customer@example.test',customer_name:'Test',tracking_number:'TRACK-123',estimated_delivery:null,has_problem:true,problem_description:'Filen mangler beskæring.',user_id:'fixture'};
  for(const status of ['production','shipped','delivered','cancelled']) {
    const p=buildStatusEmail('status_change',{...order,status},shop,config);assert.match(p.html,/#A61F36/);assert.equal(p.from,'Salgsmapper <ordre@example.test>');
    if(status==='cancelled')assert.match(p.text,/tilbagebetaling håndteres særskilt/);
  }
  const p=buildStatusEmail('problem_notification',order,shop,config);assert.match(p.html,/Filen mangler beskæring/);assert.match(p.html,/Vi har brug for din hjælp/);
});
test('a published branding change cannot alter a prepared retry; temporary tenant read failure sends nothing and stays pending', async () => {
  const r=row(),bodies:string[]=[],statuses:string[]=[];let reads=0;
  const repo:EmailRepository={async claim(){return[r]},async getTenant(id){assert.equal(id,tenantId);reads++;return tenant({branding:{published:{colors:{primary:'#A61F36'}}}})},
    async prepare(_r,p){r.provider_payload??=structuredClone(p);return r.provider_payload},async finish(_r,status){statuses.push(status);return true}};
  await dispatchStorefrontOrderEmails(repo,config,async(_url,init)=>{bodies.push(String(init?.body));throw new Error('timeout')});
  repo.getTenant=async()=>{throw new Error('Must not read changed branding on retry')};
  await dispatchStorefrontOrderEmails(repo,config,async(_url,init)=>{bodies.push(String(init?.body));return Response.json({id:'same-message'})});
  assert.equal(reads,1);assert.equal(bodies[0],bodies[1]);assert.deepEqual(statuses,['pending','sent']);
  r.provider_payload=null;let sends=0;
  const result=await dispatchStorefrontOrderEmails(repo,config,async()=>{sends++;return Response.json({id:'never'})});
  assert.equal(sends,0);assert.equal(result.pending,1);
});
