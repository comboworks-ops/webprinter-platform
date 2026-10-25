import type { IconStudioJobWithOutputs } from './types';

export function groupStudioCollections(jobs: IconStudioJobWithOutputs[]) {
  const groups = new Map<string, { id:string; name:string; total:number; items:IconStudioJobWithOutputs[] }>();
  for (const job of jobs) {
    const c = job.payload?.collection;
    if (!c) continue;
    const group = groups.get(c.id) || {id:c.id,name:c.name,total:c.total,items:[]};
    const prior = group.items.findIndex(item => item.payload.collection?.index === c.index);
    if (prior < 0) group.items.push(job);
    else if (job.created_at > group.items[prior].created_at) group.items[prior] = job;
    groups.set(c.id,group);
  }
  return [...groups.values()].map(group => ({...group,items:group.items.sort((a,b) => a.payload.collection!.index-b.payload.collection!.index)}));
}

/** Stop between items; never replay completed or uncertain in-flight work. */
export async function runStudioQueue<T extends { id:string; status:string }>(items:T[], run:(item:T) => Promise<unknown>, shouldStop:() => boolean, onItem:(item:T) => Promise<void>) {
  let failed = 0;
  let errorMessage:string|undefined;
  for (const item of items) {
    if (shouldStop()) break;
    if (item.status !== 'draft') continue;
    try { await run(item); } catch (error) { failed++; errorMessage=error instanceof Error?error.message:"Billedopgaven kunne ikke afsluttes."; }
    await onItem(item);
    // Failures need attention before the rest of the collection incurs cost.
    if (failed) break;
  }
  return {failed,errorMessage};
}
