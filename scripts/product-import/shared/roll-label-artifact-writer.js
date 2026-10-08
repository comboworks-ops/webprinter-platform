import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');

/** Preserve exact bytes for equal JSON values; validate every staged output
 * before the first write. Semantic changes remain explicit, never source hash
 * substitutions. This is a local catalogue writer, not a remote importer. */
export function createRollLabelArtifactWriter(destination){
  const staged=new Map();
  function stage(name,value,jsonl=false){
    const filename=path.resolve(destination,name),base=path.resolve(destination);
    if(!filename.startsWith(base+path.sep))throw Error('Artifact escaped catalogue destination');
    if(staged.has(filename))throw Error('Duplicate staged artifact');
    const before=fs.existsSync(filename)?fs.readFileSync(filename):null;
    const encode=v=>Buffer.from(jsonl?v.map(row=>JSON.stringify(row)).join('\n')+(v.length?'\n':''):JSON.stringify(v,null,2)+'\n');
    let bytes=encode(value),preserved=false;
    if(before){
      const old=jsonl?before.toString().split('\n').filter(Boolean).map(JSON.parse):JSON.parse(before);
      // JSON round-trip matches the exact serialization contract (undefined
      // object members are absent). Compare values independently of key order.
      const next=jsonl?bytes.toString().split('\n').filter(Boolean).map(JSON.parse):JSON.parse(bytes);
      if(isDeepStrictEqual(old,next)){bytes=before;preserved=true;}
    }
    staged.set(filename,{name,filename,before,bytes,preserved});
    return {path:name,rowCount:Array.isArray(value)?value.length:undefined,sha256:sha(bytes)};
  }
  function commit({dryRun=false}={}){
    for(const item of staged.values()){
      const current=fs.existsSync(item.filename)?fs.readFileSync(item.filename):null;
      if((current===null)!==(item.before===null)||current&& !current.equals(item.before))throw Error('Catalogue changed during preparation: '+item.name);
    }
    const changed=[...staged.values()].filter(item=>!item.before||!item.bytes.equals(item.before));
    if(!dryRun)for(const item of changed){
      fs.mkdirSync(path.dirname(item.filename),{recursive:true});
      const temporary=item.filename+'.'+randomUUID()+'.pending';
      // The staged byte buffer is immutable within this writer. Each replacement
      // is atomic; the whole multi-file commit is not a database transaction.
      fs.writeFileSync(temporary,item.bytes,{flag:'wx'});fs.renameSync(temporary,item.filename);
    }
    return {artifacts:[...staged.values()].map(item=>({path:item.name,sha256:sha(item.bytes),bytes:item.bytes.length,
      preserved:item.preserved,changed:!item.before||!item.bytes.equals(item.before)})),
      artifactsCount:staged.size,changedCount:changed.length,dryRun};
  }
  return {stageJson:(name,value)=>stage(name,value),stageJsonl:(name,rows)=>stage(name,rows,true),commit};
}
