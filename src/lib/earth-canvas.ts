/** Small software fallback for browsers without WebGL. Sphere coordinates and
 * lighting are calculated once; frames only sample the two cached maps. */
export function createEarthCanvas(canvas: HTMLCanvasElement, ready: () => void, initialTurn = 0) {
  const context=canvas.getContext("2d",{alpha:true});
  if (!context) return null;
  canvas.dataset.renderer="canvas-loading";
  const side=Math.min(440,canvas.width), width=1024, height=512;
  const land=new Image(), clouds=new Image();
  let disposed=false, pixels:Uint8ClampedArray|null=null;
  let output:ImageData|null=null, longitude:Int32Array, latitude:Int32Array, light:Float32Array, rim:Float32Array;
  let oldSide=0;
  const projected=document.createElement("canvas");
  projected.width=side; projected.height=side;
  const paint=projected.getContext("2d");
  if (!paint) return null;
  function coordinates() {
    oldSide=side;
    output=paint!.createImageData(side,side);
    longitude=new Int32Array(side*side); latitude=new Int32Array(side*side);
    light=new Float32Array(side*side); rim=new Float32Array(side*side);
    for(let y=0;y<side;y++) for(let x=0;x<side;x++) {
      const i=y*side+x, px=(2*(x+.5)/side-1)*1.035, py=(1-2*(y+.5)/side)*1.035;
      const r=px*px+py*py;
      if(r>=1) { latitude[i]=-1; continue; }
      const z=Math.sqrt(1-r), qy=py*Math.cos(.23)+z*Math.sin(.23), qz=z*Math.cos(.23)-py*Math.sin(.23);
      longitude[i]=Math.floor((Math.atan2(px,qz)/(2*Math.PI)+.52)*width);
      latitude[i]=Math.min(height-1,Math.max(0,Math.floor((.5-Math.asin(qy)/Math.PI)*height)))*width;
      const sun=(px*.55+py*.4+z)/Math.sqrt(1+.55*.55+.4*.4);
      const t=Math.max(0,Math.min(1,(sun+.08)/.93));
      light[i]=.18+.93*t*t*(3-2*t);
      rim[i]=Math.pow(1-z,3.3)*.32;
      output.data[i*4+3]=Math.round(255*Math.min(1,(1-r)/.006));
    }
  }
  const draw=(turn:number) => {
    if(disposed || !pixels) return;
    if(!output || oldSide!==side) coordinates();
    const data=output!.data, offset=Math.floor(turn*width);
    for(let i=0;i<side*side;i++) {
      if(latitude[i]<0) continue;
      const j=(latitude[i]+((longitude[i]+offset)%width+width)%width)*4, k=i*4;
      const shade=light[i]*(1-rim[i]);
      data[k]=pixels[j]*shade+rim[i]*45;
      data[k+1]=pixels[j+1]*shade+rim[i]*92;
      data[k+2]=pixels[j+2]*shade+rim[i]*160;
    }
    paint!.putImageData(output!,0,0);
    context!.clearRect(0,0,canvas.width,canvas.height);
    context!.drawImage(projected,0,0,canvas.width,canvas.height);
  };
  let loaded=0;
  const onLoad=() => {
    if(disposed || ++loaded<2) return;
    const texture=document.createElement("canvas"); texture.width=width; texture.height=height;
    const ctx=texture.getContext("2d",{willReadFrequently:true});
    if(!ctx) return;
    ctx.drawImage(land,0,0,width,height);
    ctx.globalCompositeOperation="screen"; ctx.globalAlpha=.84;
    ctx.drawImage(clouds,0,0,width,height);
    pixels=ctx.getImageData(0,0,width,height).data;
    canvas.dataset.renderer="canvas"; draw(initialTurn); ready();
  };
  land.onload=onLoad; clouds.onload=onLoad;
  land.src="/images/orbis-earth-day.jpg"; clouds.src="/images/orbis-earth-clouds.jpg";
  return { draw, dispose() { disposed=true; land.onload=null; clouds.onload=null; pixels=null; output=null; } };
}
