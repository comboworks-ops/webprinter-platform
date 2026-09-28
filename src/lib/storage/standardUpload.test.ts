import {test} from 'node:test';
import assert from 'node:assert/strict';
import {standardUpload} from './standardUpload.ts';

class UploadRequest {
  static last: UploadRequest;
  constructor() { UploadRequest.last = this; }
  status = 201; timeout = 0; method = ''; url = '';
  headers: Record<string,string> = {}; body?: FormData;
  upload = {onprogress: (_event: {loaded:number;total:number;lengthComputable:boolean}) => {}};
  onload = () => {}; onerror = () => {}; ontimeout = () => {}; onabort = () => {};
  open(method:string,url:string) { this.method=method; this.url=url; }
  setRequestHeader(name:string,value:string) { this.headers[name]=value; }
  send(body:FormData) { this.body=body; }
}

test('signed uploads use the standard capability endpoint and expose progress', async () => {
  const original=globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest=UploadRequest as never;
  try {
    const progress:number[]=[];
    const pending=standardUpload({supabaseUrl:'https://project.supabase.co',bucket:'order-files',path:'checkout-uploads/test.pdf',token:'private-token',file:new Blob(['1234']),headers:{apikey:'public-key'},onProgress:p=>progress.push(p.loaded)});
    const request=UploadRequest.last;
    assert.equal(request.method,'PUT');
    assert.equal(new URL(request.url).pathname,'/storage/v1/object/upload/sign/order-files/checkout-uploads/test.pdf');
    assert.equal(new URL(request.url).searchParams.get('token'),'private-token');
    assert.equal(request.headers['x-upsert'],'false');
    request.upload.onprogress({lengthComputable:true,loaded:50,total:100});
    request.onload(); await pending;
    assert.deepEqual(progress,[0,2]);
  } finally {globalThis.XMLHttpRequest=original;}
});

for (const failure of ['ontimeout','onerror','onabort'] as const) {
  test(`${failure} rejects instead of leaving the upload busy`,async()=>{
    const original=globalThis.XMLHttpRequest; globalThis.XMLHttpRequest=UploadRequest as never;
    try {
      const pending=standardUpload({supabaseUrl:'https://project.supabase.co',bucket:'product-images',path:'image.png',file:new Blob(['image']),headers:{authorization:'Bearer test'}});
      assert.equal(UploadRequest.last.method,'POST');
      assert.equal(UploadRequest.last.timeout,120000);
      UploadRequest.last[failure]();
      await assert.rejects(pending,/kunne ikke uploades/);
    } finally {globalThis.XMLHttpRequest=original;}
  });
}
