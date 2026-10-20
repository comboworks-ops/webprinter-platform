import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const checker=fileURLToPath(new URL('../check-supabase-migration-grants.js',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'grant-checker-'));
try {
 mkdirSync(join(root,'supabase/migrations'),{recursive:true});
 const cases=[
  ['create table public.target(id int); grant select on public.target to authenticated;',0],
  ['create table public.target(id int); grant select on public.other to authenticated; create policy p on public.target using (true);',1],
  ['create table public.target(id int); revoke select on public.other from anon; create policy p on public.target using (true);',1],
  ['create table public.target(id int); revoke all on table public.target from anon;',0],
 ];
 for (const [sql,status] of cases) {
  writeFileSync(join(root,'supabase/migrations/20261021000000_fixture.sql'),sql);
  const result=spawnSync(process.execPath,[checker,'--all'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,status,result.stdout+result.stderr);
 }
 console.log(`${cases.length} checker regression cases passed.`);
} finally {rmSync(root,{recursive:true,force:true});}
