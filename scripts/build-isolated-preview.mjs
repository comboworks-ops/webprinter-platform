import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// This creates a preview-only static Vercel artifact. It never deploys or promotes.
const configPath = process.argv[2];
assert.ok(configPath, 'Provide a local JSON file containing the test backend public configuration.');
const config = JSON.parse(fs.readFileSync(configPath));
const checkoutTest = process.argv[3] === '--checkout-test';
assert.ok(!process.argv[3] || checkoutTest, 'Only --checkout-test is supported.');
assert.equal(new URL(config.SUPABASE_URL).hostname, 'cyurochbkxggcobnxaxq.supabase.co');
const key = config.SUPABASE_ANON_KEY;
if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '')) {
  const check = await fetch(`${config.SUPABASE_URL}/rest/v1/tenants?select=id&limit=0`, {
    headers:{apikey:key},signal:AbortSignal.timeout(15000),redirect:'error',
  });
  await check.body?.cancel();
  assert.equal(check.status,200,'Public key must belong to the isolated backend');
} else {
assert.equal(JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role, 'anon');
assert.equal(JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).ref, 'cyurochbkxggcobnxaxq');
}
if (checkoutTest) assert.match(config.STRIPE_PUBLISHABLE_KEY || '', /^pk_test_[A-Za-z0-9]+$/, 'A Stripe TEST public key is required.');
const destination = path.resolve(checkoutTest ? 'output/isolated-checkout-preview' : 'output/isolated-launch-preview');
const staticPath = path.join(destination, '.vercel/output/static');
fs.mkdirSync('output',{recursive:true});
const snapshot = fs.mkdtempSync(path.resolve('output/isolated-preview-source-'));
const keep = file => !/ [23]\.[^/]+$/.test(file) && !file.split(path.sep).some(part=>part.startsWith('backup-'));
for(const name of ['src','public','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','tailwind.config.ts','postcss.config.js','package.json']) {
  fs.cpSync(name,path.join(snapshot,name),{recursive:true,filter:keep});
}
fs.mkdirSync(path.join(snapshot,'scripts'));
fs.mkdirSync(path.join(snapshot,'supabase/functions/_shared'), {recursive:true});
for (const name of ['storefrontTax.ts', 'storefrontCheckout.ts', 'orderFileLocator.ts']) fs.copyFileSync(`supabase/functions/_shared/${name}`,path.join(snapshot,'supabase/functions/_shared',name));
fs.copyFileSync('scripts/local-color-profile-plugin.ts',path.join(snapshot,'scripts/local-color-profile-plugin.ts'));
fs.symlinkSync(path.resolve('node_modules'),path.join(snapshot,'node_modules'),'dir');
fs.rmSync(staticPath,{recursive:true,force:true});
const env = {...process.env,
  VITE_SUPABASE_URL: config.SUPABASE_URL,
  VITE_SUPABASE_PROJECT_ID: 'cyurochbkxggcobnxaxq',
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
  VITE_STRIPE_PUBLISHABLE_KEY: checkoutTest ? config.STRIPE_PUBLISHABLE_KEY : '',
  VITE_ISOLATED_PREVIEW: 'true',
  VITE_ISOLATED_CHECKOUT_TEST: String(checkoutTest),
  VITE_STOREFRONT_PRIVATE_FILES: String(checkoutTest && config.PRIVATE_FILES === true),
  VITE_USE_API_TENANT_CONTEXT: 'false',
};
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js','build','--outDir',staticPath],{cwd:snapshot,env,stdio:'inherit'});
if (result.status !== 0) process.exit(result.status || 1);
fs.writeFileSync(path.join(staticPath,'robots.txt'),'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(destination,'.vercel/output/config.json'),JSON.stringify({version:3,routes:[
  {src:'/(.*)',headers:{'X-Robots-Tag':'noindex, nofollow, noarchive'},continue:true},
  {handle:'filesystem'}, {src:'/(.*)',dest:'/index.html'},
]}));
fs.copyFileSync('.vercel/project.json',path.join(destination,'.vercel/project.json'));
for (const name of fs.readdirSync(path.join(staticPath,'assets'))) {
  if (!name.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(staticPath,'assets',name),'utf8');
  assert.ok(!/pk_live_[A-Za-z0-9]{12}/.test(content),'Live Stripe key in preview');
  assert.ok(!/sb_secret_[A-Za-z0-9_-]+/.test(content),'Private Supabase key in preview');
  assert.ok(!content.includes(config.SUPABASE_SERVICE_ROLE_KEY || 'no-secret-present-in-input'),'Service key in preview');
}
console.log(`Isolated preview prepared: ${destination}`);
