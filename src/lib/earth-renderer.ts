import { createEarthCanvas } from "@/lib/earth-canvas";

/** One textured sphere, drawn in a single GPU pass. No scene library, geometry,
 * lights, blur filters or React updates in the animation loop. */
export function createEarthRenderer(canvas: HTMLCanvasElement, ready: () => void, initialTurn = 0) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return createEarthCanvas(canvas,ready,initialTurn);
  canvas.dataset.renderer="loading";
  const vertex = `attribute vec2 position; varying vec2 point;
    void main(){ point=position; gl_Position=vec4(position,0.0,1.0); }`;
  // The dive needs fine texture coordinates; highp where the phone offers it.
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 point;
    uniform sampler2D land; uniform sampler2D clouds;
    uniform float turn;
    // 0 is the resting globe; 1 is the inside of the cloud deck, at the end of a dive.
    uniform float dive;
    const float PI=3.14159265;
    const float TILT=0.23;
    float hash(vec2 s){ return fract(sin(dot(s,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 s){
      vec2 i=floor(s), f=fract(s); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
    }
    float fbm(vec2 s){
      float v=0.0, a=0.5;
      for(int k=0;k<4;k++){ v+=a*noise(s); s=s*2.03+vec2(17.0,9.0); a*=0.5; }
      return v;
    }
    // Map a point of the disc to the equirectangular maps, as the globe sees it.
    vec2 mapUV(vec2 pp){
      float rr=min(dot(pp,pp),1.0);
      vec3 nn=vec3(pp,sqrt(1.0-rr));
      vec3 q=vec3(nn.x,nn.y*cos(TILT)+nn.z*sin(TILT),nn.z*cos(TILT)-nn.y*sin(TILT));
      return vec2(fract(atan(q.x,q.z)/(2.0*PI)+0.52+turn),0.5-asin(q.y)/PI);
    }
    // Sunlight from the right, so a real terminator crosses the disc.
    const vec3 SUN=vec3(0.77,0.33,0.55);
    void main(){
      // A dive moves the eye toward the surface; the cloud deck, higher up, rushes past faster.
      float zg=1.0+2.6*dive*dive;
      float zc=1.0+6.0*dive*dive;
      // The eye drifts toward the sunlit side as it falls, so the dive never enters the dark.
      vec2 p=point*1.035/zg+vec2(0.30,0.12)*(1.0-1.0/zg);
      float r=dot(p,p);
      vec3 sky=vec3(0.48,0.67,0.96);
      if(r>1.0){
        // A thin lit limb of air just outside the disc; nothing on the night side.
        float h=sqrt(r)-1.0;
        float lit=smoothstep(-0.05,0.75,dot(normalize(p),SUN.xy));
        float a=exp(-h/0.009)*lit*0.3;
        gl_FragColor=vec4(sky*a,a);return;
      }
      vec3 n=vec3(p,sqrt(1.0-r));
      // Tilt the viewing latitude, while rotation remains on Earth's polar axis.
      vec2 uv=mapUV(p);
      vec3 base=texture2D(land,uv).rgb;
      float ocean=smoothstep(0.02,0.09,base.b-base.r)*(1.0-smoothstep(0.25,0.45,base.g));
      base=pow(base,vec3(1.12))*1.12;
      vec2 cuv=mapUV(point*1.035/zc+vec2(0.30,0.12)*(1.0-1.0/zc));
      float cloud=texture2D(clouds,vec2(fract(cuv.x+turn*0.025),cuv.y)).r;
      vec3 cloudTone=vec3(0.95,0.95,0.94);
      float fill=0.0;
      if(dive>0.001){
        // Close to the deck the map runs out of detail: grow it from noise anchored to the sky.
        float deep=smoothstep(0.1,0.7,dive);
        float fine=fbm(cuv*vec2(330.0,165.0));
        float broad=fbm(cuv*vec2(120.0,60.0)+7.0);
        cloud=clamp(cloud+(fine-0.5)*1.6*deep,0.0,1.0);
        fill=smoothstep(0.45,0.85,dive);
        // Inside the deck: bright tops and grey hollows, not a flat haze.
        float body=smoothstep(0.22,0.82,0.55*fine+0.45*broad+0.25*cloud);
        vec3 inside=mix(vec3(0.58,0.61,0.67),vec3(0.98,0.98,0.97),body);
        cloudTone=mix(cloudTone,inside,smoothstep(0.35,0.95,dive));
      }
      float cover=mix(smoothstep(0.16,0.95,cloud)*0.85,1.0,fill);
      base=mix(base,cloudTone,cover);
      vec3 sun=normalize(SUN);
      float d=dot(n,sun);
      float day=smoothstep(-0.1,0.32,d);
      vec3 color=base*(0.025+1.02*day*(0.55+0.45*max(d,0.0)));
      // Warm light along the terminator, as at dawn and dusk.
      color*=mix(vec3(1.0),vec3(1.12,0.9,0.78),smoothstep(0.32,0.0,d)*day);
      // Sun glint on open water.
      float glint=pow(max(dot(n,normalize(sun+vec3(0.0,0.0,1.0))),0.0),70.0);
      color+=vec3(1.0,0.95,0.86)*glint*ocean*(1.0-cover)*0.45*day;
      // Air thickens toward the edge; it scatters blue only where it is lit.
      float edge=pow(1.0-n.z,2.4);
      color=mix(color,sky*(0.10+0.90*day),edge*0.36*(0.2+0.8*day));
      // Falling through the thick of the air: the blue deepens, then the deck takes over.
      float haze=smoothstep(0.0,0.5,dive)*(1.0-smoothstep(0.55,0.9,dive));
      color=mix(color,sky*0.9+0.1,haze*0.4*(0.25+0.75*day));
      float alpha=1.0-smoothstep(0.994,1.0,r);
      float halo=smoothstep(-0.05,0.75,dot(normalize(p+1e-5),SUN.xy))*0.3;
      gl_FragColor=vec4(mix(sky*halo,color,alpha),mix(halo,1.0,alpha));
    }`;
  const shaders: WebGLShader[] = [];
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind);
    if (!shader) return null;
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { canvas.dataset.renderer=gl.getShaderInfoLog(shader) || "shader-failed"; gl.deleteShader(shader); return null; }
    shaders.push(shader); return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) { shaders.forEach(s => gl.deleteShader(s)); return null; }
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); shaders.forEach(s => gl.deleteShader(s)); return null; }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const rotation = gl.getUniformLocation(program,"turn");
  const diving = gl.getUniformLocation(program,"dive");
  const textures: WebGLTexture[] = [];
  const images: HTMLImageElement[] = [];
  let disposed = false, loaded = 0;
  const draw = (turn: number, dive = 0) => {
    if (disposed || loaded < 2 || gl.isContextLost()) return;
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform1f(rotation,turn);
    gl.uniform1f(diving,dive);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  };
  ["/images/orbis-earth-day.jpg", "/images/orbis-earth-clouds.jpg"].forEach((src,index) => {
    const texture = gl.createTexture();
    if (!texture) return;
    textures.push(texture);
    const img = new Image(); images.push(img);
    img.onload = () => {
      if (disposed || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0+index); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
      gl.uniform1i(gl.getUniformLocation(program,index ? "clouds" : "land"),index);
      if (++loaded === 2) { canvas.dataset.renderer="webgl"; draw(initialTurn); ready(); }
    };
    img.src=src;
  });
  return { draw, dispose() {
    disposed=true;
    images.forEach(img => { img.onload=null; });
    textures.forEach(t => gl.deleteTexture(t)); shaders.forEach(s => gl.deleteShader(s));
    gl.deleteBuffer(buffer); gl.deleteProgram(program);
  }};
}
