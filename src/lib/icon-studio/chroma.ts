/** Remove only the edge-connected chroma backdrop. White paper is never a removal colour. */
export function cutoutStudioChroma(rgba:Uint8ClampedArray,width:number,height:number,hex:string) {
  const channel=['#ff0000','#00ff00','#0000ff'].indexOf(hex.toLowerCase());
  if(channel<0 || rgba.length!==width*height*4)throw new Error('Ugyldig billedbaggrund.');
  const seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0;
  const excess=(i:number)=>rgba[i*4+channel]-Math.max(rgba[i*4+(channel+1)%3],rgba[i*4+(channel+2)%3]);
  const add=(i:number)=>{if(!seen[i]){seen[i]=1;if(excess(i)>20)queue[tail++]=i;}};
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=1;y<height-1;y++){add(y*width);add(y*width+width-1);}
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);
    if(x>0)add(i-1);if(x+1<width)add(i+1);if(y>0)add(i-width);if(y+1<height)add(i+width);
  }
  // Unmix edge pixels from the known backdrop instead of leaving a coloured fringe.
  for(let j=0;j<tail;j++){const i=queue[j],n=i*4,a=1-Math.max(0,Math.min(255,excess(i)))/255;
    if(a<.1){rgba[n+3]=0;continue;}
    for(let c=0;c<3;c++)rgba[n+c]=Math.round(Math.max(0,Math.min(255,(rgba[n+c]-(c===channel?255:0)*(1-a))/a)));
    rgba[n+3]=Math.round(rgba[n+3]*a);
  }
  return rgba;
}
