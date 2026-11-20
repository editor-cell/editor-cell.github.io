import{n as e}from"./rolldown-runtime-CbXtAM7H.js";import{I as t,P as n,Sn as r,Vt as i,Xt as a,rt as o,zt as s}from"./shell-IxyLD-of.js";import{u as c}from"./index-J7yewixu.js";var l=s(`arrow-up-right`,[[`path`,{d:`M7 7h10v10`,key:`1tivn9`}],[`path`,{d:`M7 17 17 7`,key:`1vkiza`}]]),u=null;function d(e){u={id:e,at:Date.now()}}function f(e){let t=u;return u=null,!!t&&t.id===e&&Date.now()-t.at<1e4}var p=a();function m({videos:e,lang:r,selected:a,onPlay:s}){let l=t(r);return(0,p.jsx)(`ol`,{className:`watching-videos`,children:e.map(e=>{let t=e.locales[r]?.title,u=(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(`span`,{className:`watching-video-cover`,children:e.poster?(0,p.jsx)(`img`,{src:e.poster,...c(e.poster,`(min-width: 768px) 180px, 110px`),width:1600,height:900,alt:``,loading:`lazy`,decoding:`async`}):null}),(0,p.jsxs)(`span`,{className:`watching-video-copy`,children:[(0,p.jsx)(`span`,{className:`paper-title watching-video-title`,children:t}),(0,p.jsx)(`span`,{className:`watching-video-duration`,dir:`ltr`,children:n(e.duration)})]})]});return(0,p.jsx)(`li`,{"data-selected":a===e.id,children:a===e.id&&s?(0,p.jsx)(`button`,{type:`button`,onClick:s,className:`watching-video-link`,"aria-label":`${l.play}: ${t}`,children:u}):(0,p.jsx)(i,{...o(r,e.id),onClick:()=>d(e.id),className:`watching-video-link`,"aria-label":`${l.play}: ${t}`,children:u})},e.id)})})}var h=e(r(),1);function g(e,t,n=0){let r=e.getContext(`2d`,{alpha:!0});if(!r)return null;e.dataset.renderer=`canvas-loading`;let i=Math.min(440,e.width),a=1024,o=new Image,s=new Image,c=!1,l=null,u=null,d,f,p,m,h=0,g=document.createElement(`canvas`);g.width=i,g.height=i;let _=g.getContext(`2d`);if(!_)return null;function v(){h=i,u=_.createImageData(i,i),d=new Float32Array(i*i),f=new Int32Array(i*i),p=new Float32Array(i*i),m=new Float32Array(i*i);for(let e=0;e<i;e++)for(let t=0;t<i;t++){let n=e*i+t,r=(2*(t+.5)/i-1)*1.035,o=(1-2*(e+.5)/i)*1.035,s=r*r+o*o;if(s>=1){f[n]=-1;continue}let c=Math.sqrt(1-s),l=o*Math.cos(.23)+c*Math.sin(.23),h=c*Math.cos(.23)-o*Math.sin(.23);d[n]=(Math.atan2(r,h)/(2*Math.PI)+.52)*a,f[n]=Math.min(511,Math.max(0,Math.floor((.5-Math.asin(l)/Math.PI)*512)))*a;let g=(r*.77+o*.33+c*.55)/Math.sqrt(1.0043),_=Math.max(0,Math.min(1,(g+.1)/.42)),v=_*_*(3-2*_);p[n]=.025+1.02*v*(.55+.45*Math.max(g,0)),m[n]=(1-c)**2.4*.42*(.2+.8*v),u.data[n*4+3]=Math.round(255*Math.min(1,(1-s)/.006))}}let y=(t,n)=>{if(c||!l)return;(!u||h!==i)&&v();let o=u.data,s=t*a;for(let e=0;e<i*i;e++){if(f[e]<0)continue;let t=(d[e]+s)%a,n=Math.floor(t),r=t-n,i=(f[e]+n)*4,c=(f[e]+(n+1)%a)*4,u=e*4,h=p[e]*(1-m[e]),g=m[e]*Math.min(1,.15+p[e]);o[u]=(l[i]+(l[c]-l[i])*r)*h+g*102,o[u+1]=(l[i+1]+(l[c+1]-l[i+1])*r)*h+g*153,o[u+2]=(l[i+2]+(l[c+2]-l[i+2])*r)*h+g*242}_.putImageData(u,0,0),r.clearRect(0,0,e.width,e.height),r.drawImage(g,0,0,e.width,e.height)},b=0,x=()=>{if(c||++b<2)return;let r=document.createElement(`canvas`);r.width=a,r.height=512;let i=r.getContext(`2d`,{willReadFrequently:!0});i&&(i.drawImage(o,0,0,a,512),i.globalCompositeOperation=`screen`,i.globalAlpha=.84,i.drawImage(s,0,0,a,512),l=i.getImageData(0,0,a,512).data,e.dataset.renderer=`canvas`,y(n),t())};return o.onload=x,s.onload=x,o.src=`/images/orbis-earth-day.jpg`,s.src=`/images/orbis-earth-clouds.jpg`,{draw:y,dispose(){c=!0,o.onload=null,s.onload=null,l=null,u=null}}}function _(e,t,n=0){let r=e.getContext(`webgl`,{alpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:`low-power`});if(!r)return g(e,t,n);e.dataset.renderer=`loading`;let i=[],a=(t,n)=>{let a=r.createShader(t);return a?(r.shaderSource(a,n),r.compileShader(a),r.getShaderParameter(a,r.COMPILE_STATUS)?(i.push(a),a):(e.dataset.renderer=r.getShaderInfoLog(a)||`shader-failed`,r.deleteShader(a),null)):null},o=a(r.VERTEX_SHADER,`attribute vec2 position; varying vec2 point;
    void main(){ point=position; gl_Position=vec4(position,0.0,1.0); }`),s=a(r.FRAGMENT_SHADER,`
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
      for(int k=0;k<3;k++){ v+=a*noise(s); s=s*2.03+vec2(17.0,9.0); a*=0.5; }
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
      float zg=1.0/(1.0-0.96*dive*dive);
      float zc=1.0/(1.0-0.985*dive*dive);
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
        fill=smoothstep(0.45,0.95,dive)*0.5;
        // Inside the deck: bright tops and grey hollows, not a flat haze.
        float body=smoothstep(0.22,0.82,0.55*fine+0.45*broad+0.25*cloud);
        vec3 inside=mix(vec3(0.32,0.52,0.78),vec3(0.92,0.96,1.0),body);
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
      float haze=smoothstep(0.18,0.55,dive)*(1.0-smoothstep(0.7,1.0,dive));
      color=mix(color,sky*0.9+0.1,haze*0.42*(0.25+0.75*day));
      float alpha=1.0-smoothstep(0.994,1.0,r);
      float halo=smoothstep(-0.05,0.75,dot(normalize(p+1e-5),SUN.xy))*0.3;
      gl_FragColor=vec4(mix(sky*halo,color,alpha),mix(halo,1.0,alpha));
    }`),c=r.createProgram();if(!o||!s||!c)return i.forEach(e=>r.deleteShader(e)),null;if(r.attachShader(c,o),r.attachShader(c,s),r.linkProgram(c),!r.getProgramParameter(c,r.LINK_STATUS))return r.deleteProgram(c),i.forEach(e=>r.deleteShader(e)),null;r.useProgram(c);let l=r.createBuffer();r.bindBuffer(r.ARRAY_BUFFER,l),r.bufferData(r.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),r.STATIC_DRAW);let u=r.getAttribLocation(c,`position`);r.enableVertexAttribArray(u),r.vertexAttribPointer(u,2,r.FLOAT,!1,0,0);let d=r.getUniformLocation(c,`turn`),f=r.getUniformLocation(c,`dive`),p=[],m=[],h=!1,_=0,v=(t,n=0)=>{h||_<2||r.isContextLost()||(r.viewport(0,0,e.width,e.height),r.uniform1f(d,t),r.uniform1f(f,n),r.drawArrays(r.TRIANGLE_STRIP,0,4))};return[`/images/orbis-earth-day.jpg`,`/images/orbis-earth-clouds.jpg`].forEach((i,a)=>{let o=r.createTexture();if(!o)return;p.push(o);let s=new Image;m.push(s),s.onload=()=>{h||r.isContextLost()||(r.activeTexture(r.TEXTURE0+a),r.bindTexture(r.TEXTURE_2D,o),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texImage2D(r.TEXTURE_2D,0,r.RGB,r.RGB,r.UNSIGNED_BYTE,s),r.uniform1i(r.getUniformLocation(c,a?`clouds`:`land`),a),++_===2&&(e.dataset.renderer=`webgl`,v(n),t()))},s.src=i}),{draw:v,dispose(){h=!0,m.forEach(e=>{e.onload=null}),p.forEach(e=>r.deleteTexture(e)),i.forEach(e=>r.deleteShader(e)),r.deleteBuffer(l),r.deleteProgram(c)}}}function v({paused:e=!1}){let t=(0,h.useRef)(null),n=(0,h.useRef)(null),r=(0,h.useRef)(e),i=(0,h.useRef)(null);r.current=e;let[a,o]=(0,h.useState)(!1),[s,c]=(0,h.useState)(!1);return(0,h.useEffect)(()=>{let e=t.current,a=n.current;if(!e||!a)return;let s=0,l=!1,u=!1,d=0,f=0,p=!1,m=0,h=null,g=window.matchMedia(`(prefers-reduced-motion: reduce)`),v=()=>{let t=Math.min(900,Math.round(e.clientWidth*Math.min(window.devicePixelRatio||1,1.5)));a.width!==t&&(a.width=t,a.height=t),h?.draw(f)},y=e=>{if(!l||document.hidden||g.matches||r.current||!u||p){s=0,d=0;return}(!d||e-d>=1e3/(a.dataset.renderer===`canvas`?20:30))&&(d&&(f=(f+Math.min(e-d,80)/24e4)%1),d=e,h?.draw(f)),s=requestAnimationFrame(y)},b=()=>{cancelAnimationFrame(s),s=0,d=0,!p&&(u&&l&&!document.hidden&&h?.draw(f),l&&!document.hidden&&!r.current&&!g.matches&&u&&(s=requestAnimationFrame(y)))},x=()=>{h?.dispose(),v(),h=_(a,()=>{u=!0,h?.draw(f),o(!0),c(!0),b()},f)};i.current=b,x();let S=new IntersectionObserver(([e])=>{l=e.isIntersecting,b()});S.observe(e);let C=new ResizeObserver(v);C.observe(e);let w=e=>{let t=e.detail;if(!t||!h||!u||(t.handled=a.dataset.renderer===`webgl`,cancelAnimationFrame(s),s=0,cancelAnimationFrame(m),p=!0,!t.handled))return;if(t.progress!==void 0){h.draw(f,Math.max(0,Math.min(1,t.progress)));return}let n=t.duration??1500,r=-1,i=e=>{r<0&&(r=e);let t=Math.min(1,(e-r)/n);h?.draw(f,t**1.3),m=t<1?requestAnimationFrame(i):0};m=requestAnimationFrame(i)};a.addEventListener(`orbis-dive`,w);let T=e=>{e.preventDefault(),u=!1,o(!1),b()},E=()=>{x()};return a.addEventListener(`webglcontextlost`,T),a.addEventListener(`webglcontextrestored`,E),document.addEventListener(`visibilitychange`,b),window.addEventListener(`pageshow`,b),g.addEventListener(`change`,b),()=>{i.current=null,cancelAnimationFrame(s),cancelAnimationFrame(m),S.disconnect(),C.disconnect(),h?.dispose(),a.removeEventListener(`orbis-dive`,w),a.removeEventListener(`webglcontextlost`,T),a.removeEventListener(`webglcontextrestored`,E),window.removeEventListener(`pageshow`,b),document.removeEventListener(`visibilitychange`,b),g.removeEventListener(`change`,b)}},[]),(0,h.useEffect)(()=>{i.current?.()},[e]),(0,p.jsxs)(`div`,{ref:t,className:`watching-earth`,"data-ready":a,"data-drawn":s,"aria-hidden":`true`,children:[!s&&(0,p.jsx)(`img`,{className:`watching-earth-still`,src:`/images/orbis-earth-first.webp`,alt:``,width:720,height:720,decoding:`async`}),(0,p.jsx)(`canvas`,{ref:n,width:600,height:600})]})}var y=[[-48,-28],[-22,-36],[27,-31],[52,-15],[48,22],[18,38],[-29,33],[-55,10],[-52,-8],[56,7]];function b({paused:e=!1}){let t=(0,h.useRef)(null),[n,r]=(0,h.useState)(!1);return(0,h.useEffect)(()=>{let e=t.current;if(!e)return;let n=!1,i=()=>r(n&&!document.hidden),a=new IntersectionObserver(([e])=>{n=e.isIntersecting,i()});return a.observe(e),document.addEventListener(`visibilitychange`,i),()=>{a.disconnect(),document.removeEventListener(`visibilitychange`,i)}},[]),(0,p.jsxs)(`div`,{ref:t,className:`video-atmosphere`,"data-active":n&&!e,"aria-hidden":`true`,children:[(0,p.jsx)(`div`,{className:`video-cloud-field`,children:[0,1].map(e=>(0,p.jsx)(`img`,{className:`video-cloud${e?` video-cloud-next`:``}`,src:`/images/orbis-deep-sky.webp`,width:1536,height:1024,alt:``,loading:`lazy`,decoding:`async`,fetchPriority:`low`},e))}),y.map(([e,t],n)=>(0,p.jsx)(`span`,{className:`video-flight-star`,style:{"--star-x":`${e}vw`,"--star-y":`${t}rem`,"--star-delay":`${-n*2.7}s`,"--star-duration":`${16+n%3*2}s`,"--star-size":`${n%4==0?2:1.5}px`}},n)),(0,p.jsx)(v,{paused:e})]})}export{l as i,m as n,f as r,b as t};