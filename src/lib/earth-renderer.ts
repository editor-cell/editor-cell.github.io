import { createEarthCanvas } from "@/lib/earth-canvas";

/** One textured sphere, drawn in a single GPU pass. No scene library, geometry,
 * lights, blur filters or React updates in the animation loop. */
export function createEarthRenderer(canvas: HTMLCanvasElement, ready: () => void, initialTurn = 0) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return createEarthCanvas(canvas,ready,initialTurn);
  canvas.dataset.renderer="loading";
  const vertex = `attribute vec2 position; varying vec2 point;
    void main(){ point=position; gl_Position=vec4(position,0.0,1.0); }`;
  const fragment = `precision mediump float;
    varying vec2 point;
    uniform sampler2D land; uniform sampler2D clouds;
    uniform float turn;
    const float PI=3.14159265;
    void main(){
      vec2 p=point*1.035;
      float r=dot(p,p);
      if(r>1.0){gl_FragColor=vec4(0.0);return;}
      vec3 n=vec3(p,sqrt(1.0-r));
      // Tilt the viewing latitude, while rotation remains on Earth's polar axis.
      float tilt=0.23;
      vec3 q=vec3(n.x,n.y*cos(tilt)+n.z*sin(tilt),n.z*cos(tilt)-n.y*sin(tilt));
      vec2 uv=vec2(fract(atan(q.x,q.z)/(2.0*PI)+0.52+turn),0.5-asin(q.y)/PI);
      vec3 base=texture2D(land,uv).rgb;
      float cloud=texture2D(clouds,vec2(fract(uv.x+turn*0.025),uv.y)).r;
      base=mix(base,vec3(0.94,0.96,0.98),smoothstep(0.14,0.9,cloud)*0.88);
      float sun=dot(n,normalize(vec3(0.55,0.4,1.0)));
      base*=0.18+0.93*smoothstep(-0.08,0.85,sun);
      float rim=pow(1.0-n.z,3.3);
      vec3 air=mix(vec3(0.39,0.12,0.22),vec3(0.13,0.46,0.76),smoothstep(-0.4,0.4,n.x));
      base=mix(base,air,rim*0.48);
      float alpha=1.0-smoothstep(0.994,1.0,r);
      gl_FragColor=vec4(base*alpha,alpha);
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
  const textures: WebGLTexture[] = [];
  const images: HTMLImageElement[] = [];
  let disposed = false, loaded = 0;
  const draw = (turn: number) => {
    if (disposed || loaded < 2 || gl.isContextLost()) return;
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform1f(rotation,turn);
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
