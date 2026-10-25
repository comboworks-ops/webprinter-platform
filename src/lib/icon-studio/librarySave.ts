import { getStudioCapabilities, invokeStudio } from './connection';

export async function saveIconStudioOutputToLibrary(tenantId:string,outputId:string,name:string) {
  if ((await getStudioCapabilities(tenantId)).productLibrarySaveVersion!==1) throw new Error('Billedmotoren skal opdateres, før billeder kan gemmes i biblioteket.');
  return invokeStudio<{success:true;assetId:string;alreadySaved:boolean}>({tenantId,action:'save-library-output',outputId,name});
}
