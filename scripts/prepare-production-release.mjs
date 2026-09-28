import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';

// Prepare an immutable source inventory without touching Git or deploying.
// Unlike the isolated visual preview, this includes the real Vercel API routes.
const buildWorkspace = process.argv[2] === '--build-workspace';
const verify = process.argv[2] === '--verify' || buildWorkspace;
const destination = path.resolve(process.argv[verify ? 3 : 2] || 'output/production-release-2026-09-16');
const root = process.cwd();
assert.ok(destination.startsWith(path.join(root, 'output') + path.sep), 'Candidate must be under output/.');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const inventoryPath = path.join(destination, 'source-manifest.json');

if (!verify) {
  assert.ok(!fs.existsSync(destination), 'Use a fresh candidate directory; existing candidates are preserved.');
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const files = [];
  const excluded = [];
  const copy = relative => {
    if (/ [23]\.[^/]+$/.test(relative) || relative.split(path.sep).some(part => part.startsWith('backup-'))) {
      excluded.push(relative);
      return;
    }
    const source = path.join(root, relative);
    const target = path.join(destination, relative);
    const stat = fs.lstatSync(source);
    assert.ok(!stat.isSymbolicLink(), `Unexpected source symlink: ${relative}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      for (const entry of fs.readdirSync(source).sort()) copy(path.join(relative, entry));
    } else {
      const bytes = fs.readFileSync(source);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      files.push({ path: relative, sha256: sha256(bytes), bytes: bytes.length });
    }
  };
  for (const entry of ['src', 'public', 'api', 'index.html', 'vite.config.ts', 'vercel.json',
    'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'tailwind.config.ts',
    'postcss.config.js', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'scripts/local-color-profile-plugin.ts',
    'supabase/functions/_shared/storefrontTax.ts', 'supabase/functions/_shared/storefrontCheckout.ts',
    'supabase/functions/_shared/supabaseKeys.ts',
    'supabase/functions/_shared/orderFileLocator.ts']) copy(entry);
  fs.mkdirSync(path.join(destination, '.vercel'));
  fs.copyFileSync(path.join(root, '.vercel/project.json'), path.join(destination, '.vercel/project.json'));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(destination, 'node_modules'), 'dir');
  fs.writeFileSync(inventoryPath, JSON.stringify({ createdAt: new Date().toISOString(), files, excluded }, null, 2));
  console.log(`Prepared ${files.length} source files in ${destination}. No environment files copied; nothing deployed.`);
} else {
  const manifest = JSON.parse(fs.readFileSync(inventoryPath));
  for (const file of manifest.files) {
    assert.equal(sha256(fs.readFileSync(path.join(destination, file.path))), file.sha256, `Changed candidate: ${file.path}`);
  }
  const project = JSON.parse(fs.readFileSync(path.join(destination, '.vercel/project.json')));
  assert.equal(project.projectId, 'prj_TtU0kZ4gkQ505dpNiNuOdnBBzmCx');
  assert.equal(project.orgId, 'team_nmuMQas8BCWeDkJKfxxMv3Ab');
  if (buildWorkspace) assert.ok(project.settings, 'Pull the production Vercel project settings into the candidate before building.');
  const envPath = path.join(destination, '.vercel/.env.production.local');
  fs.chmodSync(envPath, 0o600);
  const env = parse(fs.readFileSync(envPath));
  assert.equal(new URL(env.VITE_SUPABASE_URL).hostname, 'ziattmsmiirfweiuunfo.supabase.co', 'Production must use the existing live backend.');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '')) {
    // Opaque keys contain no project claims. Prove the configured key belongs
    // to this exact backend with an empty, read-only query; never infer from prefix.
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/tenants?select=id&limit=0`, {
      headers: {apikey: key}, signal: AbortSignal.timeout(15000), redirect:'error',
    });
    await response.body?.cancel();
    assert.equal(response.status,200,'Modern public key must work with the production backend.');
  } else {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
    assert.equal(claims.role, 'anon', 'Browser key must be public.');
    assert.equal(claims.ref, 'ziattmsmiirfweiuunfo');
  }
  assert.ok(/^pk_live_/.test(env.VITE_STRIPE_PUBLISHABLE_KEY || ''), 'Existing live Stripe public key is required.');
  assert.notEqual(env.VITE_ISOLATED_PREVIEW, 'true', 'Never promote the isolated preview as production.');
  assert.equal(env.VITE_STOREFRONT_PRIVATE_FILES, 'true', 'The matched production release must use private uploads; Vercel must not redact this public build flag.');
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_')) continue;
    assert.ok(!/SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY/.test(name), `Private configuration must not use a VITE_ prefix: ${name}`);
    assert.ok(!/^(sb_secret_|sk_|rk_|whsec_|re_)/.test(value), `Private value in browser configuration: ${name}`);
  }
  const routes = JSON.parse(fs.readFileSync(path.join(destination, 'vercel.json'))).routes;
  assert.ok(routes.some(route => route.dest?.startsWith('/api/tenant-shell')), 'Tenant HTML routes must be preserved.');
  console.log(`Verified ${manifest.files.length} source hashes, production project/backend, public Stripe key, and tenant API routes.`);
  if (buildWorkspace) {
    // Vercel 56 can resolve a nested candidate back to the parent repository.
    // Build outside that tree so neither its settings nor its installer are used.
    const workspace = fs.mkdtempSync('/private/tmp/webprinter-production-release-');
    fs.cpSync(destination, workspace, {
      recursive: true,
      verbatimSymlinks: true,
      filter: file => !file.includes(`${path.sep}.vercel${path.sep}output`)
        && !file.includes(`${path.sep}.vite`)
        && file !== path.join(destination, 'node_modules'),
    });
    // Vercel traces dependencies inside the build root. A symlink to the
    // checkout renders in Vite but silently omits server dependencies from
    // prebuilt Edge Function packages. Keep pnpm's internal relative links,
    // while placing its real package store inside this isolated workspace.
    fs.cpSync(path.join(root, 'node_modules'), path.join(workspace, 'node_modules'), {
      recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE,
    });
    const settingsPath = path.join(workspace, '.vercel/project.json');
    const projectSettings = JSON.parse(fs.readFileSync(settingsPath));
    projectSettings.settings.installCommand = '';
    projectSettings.settings.buildCommand = 'node node_modules/vite/bin/vite.js build';
    fs.writeFileSync(settingsPath, JSON.stringify(projectSettings, null, 2));
    console.log(`Build workspace: ${workspace}`);
    console.log('Run Vercel build --prod there with VERCEL_INSTALL_COMPLETED=1 to reuse installed dependencies for both frontend and API builders.');
  }
}
