export const throttleVertexCommon = () => /* glsl */ `
#include <common>
varying vec3 vObjPos;
`;

export const throttleVertexBegin = () => /* glsl */ `
#include <begin_vertex>
vObjPos = position;
`;

export const throttleFragmentCommon = () => /* glsl */ `
#include <common>
varying vec3 vObjPos;

// Simplex 3D Noise 
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
            i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
          + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

// Organic projection for avoiding tiling artifacts and adding detail
vec4 textureNoTile(sampler2D samp, vec2 uv, float vScale) {
  vec2 p = uv * vScale;
  float k = snoise(vec3(p * 0.5, 0.0));
  vec2 duv1 = vec2(snoise(vec3(p * 2.0, 1.0)), snoise(vec3(p * 2.0, 2.0))) * 0.1;
  vec2 duv2 = vec2(snoise(vec3(p * 2.0, 3.0)), snoise(vec3(p * 2.0, 4.0))) * 0.1;
  
  float w1 = smoothstep(-1.0, 0.0, k);
  float w2 = smoothstep(0.0, 1.0, k);
  float w3 = 1.0 - w1 - w2;
  
  vec4 col1 = texture2D(samp, p + duv1);
  vec4 col2 = texture2D(samp, p * 1.62 + duv2 + vec2(0.3, 0.7));
  vec4 col3 = texture2D(samp, p * 2.11 - duv1 + vec2(0.8, 0.1));
  
  return col1 * w1 + col2 * w2 + col3 * w3;
}
`;

export const throttleMapFragment = (isKnurled: boolean) => /* glsl */ `
#ifdef USE_MAP
  float uvScale = ${isKnurled ? '15.0' : '4.0'};
  
  vec2 sampleUv;
  if (${isKnurled ? 'true' : 'false'}) {
    // Cylindrical mapping around Y axis (Z rotation makes it align with handle length)
    float angle = atan(vObjPos.x, vObjPos.z);
    sampleUv = vec2(angle * 0.5, vObjPos.y);
  } else {
    // Planar/Triplanar approximation
    sampleUv = vObjPos.xy + vObjPos.yz;
  }
  
  vec4 sampledTexel = textureNoTile(map, sampleUv, uvScale);
  float luminance = dot(sampledTexel.rgb, vec3(0.299, 0.587, 0.114));
  
  // Multiply the material's uniform color by the extracted detail from the generated texture
  vec4 mapColor = vec4(vec3(luminance * 2.0), sampledTexel.a);
  
  diffuseColor *= mapColor;
#endif
`;
