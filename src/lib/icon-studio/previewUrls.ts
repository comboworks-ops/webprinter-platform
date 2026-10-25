type SignedBatch = {data:{path?:string|null;signedUrl?:string|null;error?:string|null}[]|null;error:unknown};

/** One authenticated signing request per batch instead of one connection per image. */
export async function attachStudioPreviewUrls<T extends {storage_path:string}>(rows:T[],sign:(paths:string[])=>Promise<SignedBatch>) {
  const paths=[...new Set(rows.map(row=>row.storage_path))],urls=new Map<string,string>();
  for(let offset=0;offset<paths.length;offset+=100){
    const batch=paths.slice(offset,offset+100);
    const result=await sign(batch);
    if(result.error)continue;
    for(const item of result.data || [])if(item.path && batch.includes(item.path) && item.signedUrl && !item.error)urls.set(item.path,item.signedUrl);
  }
  return rows.map(row=>({...row,preview_url:urls.get(row.storage_path) || null}));
}
