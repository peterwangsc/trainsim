export const terrainVertex = (shaderVertexShader: string) => /* glsl */ `
#pragma vscode_glsllint_stage: vert
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
${shaderVertexShader}
`;

export const terrainWorldPosVertex = () => /* glsl */ `
#pragma vscode_glsllint_stage: vert
#include <worldpos_vertex>
vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldNormal = normalize(mat3(modelMatrix) * normal);
`;

export const terrainFragment = (shaderFragmentShader: string) => /* glsl */ `
#pragma vscode_glsllint_stage: frag
uniform sampler2D tGrass;
uniform sampler2D tRock;
uniform vec3 directionalFogSunViewDirection;
uniform float directionalFogStrength;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

// Fast hash-based noise
vec2 hash2( vec2 p ) {
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
vec4 hash4( vec2 p ) {
    return fract(sin(vec4( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)), dot(p,vec2(113.5,271.9)), dot(p,vec2(246.1,124.6)))) * 43758.5453123);
}

// Simplex Noise
float snoise( in vec2 p ) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;
    vec2 i = floor( p + (p.x+p.y)*K1 );
    vec2 a = p - i + (i.x+i.y)*K2;
    vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0*K2;
    vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
    vec3 n = h*h*h*h*vec3( dot(a,hash2(i+0.0)), dot(b,hash2(i+o)), dot(c,hash2(i+1.0)));
    return dot( n, vec3(70.0) );
}

// Classic Perlin Noise (Gradient Noise)
float pnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( dot( hash2( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ), 
                     dot( hash2( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( hash2( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ), 
                     dot( hash2( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y) * 2.0;
}

// Stochastic Texture Sampling (Organic 3-Way Projection Blend)
vec4 textureNoTile( sampler2D samp, vec2 uv, float vScale ) {
    vec2 scaledUv = uv * vScale;
    
    // Sample 1: Base projection
    vec4 col1 = texture2D(samp, scaledUv);
    
    // Sample 2: Rotated 45 degrees, scaled up slightly, arbitrary offset
    const float angle2 = 0.785398;
    const float s2 = 0.707106, c2 = 0.707106;
    mat2 rot2 = mat2(c2, -s2, s2, c2);
    vec2 uv2 = rot2 * (scaledUv * 0.8) + vec2(12.3, 45.6);
    vec4 col2 = texture2D(samp, uv2);
    
    // Sample 3: Rotated -30 degrees, scaled down slightly, arbitrary offset
    const float angle3 = -0.523598;
    const float s3 = -0.499999, c3 = 0.866025;
    mat2 rot3 = mat2(c3, -s3, s3, c3);
    vec2 uv3 = rot3 * (scaledUv * 1.1) + vec2(78.9, 12.3);
    vec4 col3 = texture2D(samp, uv3);
    
    // Generate low-frequency organic masks using Simplex noise
    // We use the unscaled 'uv' so the masks are large and swooping
    float mask1 = snoise(uv * 0.1) * 0.5 + 0.5;
    float mask2 = snoise(uv * 0.1 + vec2(11.1, 22.2)) * 0.5 + 0.5;
    
    // Blend them smoothly. smoothstep adds a little contrast to the mask boundaries
    // so we don't get too much muddy variance-loss
    vec4 finalCol = mix(col1, col2, smoothstep(0.3, 0.7, mask1));
    finalCol = mix(finalCol, col3, smoothstep(0.3, 0.7, mask2));
    
    return finalCol;
}

${shaderFragmentShader}
`;

export const terrainMapFragment = () => /* glsl */ `
#pragma vscode_glsllint_stage: frag
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  
  vec2 uvGrass = vWorldPosition.xz * 0.15;
  // Zoomed out: Multiplier 0.15 controls scale. Higher = smaller texture.
  vec4 grassColor = textureNoTile(tGrass, uvGrass, 1.0);
  
  vec3 blending = abs(vWorldNormal);
  blending = normalize(max(blending, 0.00001));
  float b = (blending.x + blending.y + blending.z);
  blending /= vec3(b, b, b);
  
  // Triplanar rock mapping with organic stochastic sampling
  // Multiplier 0.15 controls texture scale. Increase to zoom out.
  vec4 xaxis = textureNoTile( tRock, vWorldPosition.yz * 0.15, 1.0 );
  vec4 yaxis = textureNoTile( tRock, vWorldPosition.xz * 0.15, 1.0 );
  vec4 zaxis = textureNoTile( tRock, vWorldPosition.xy * 0.15, 1.0 );
  vec4 rockColor = xaxis * blending.x + yaxis * blending.y + zaxis * blending.z;

  float slope = 1.0 - max(0.0, vWorldNormal.y);
  
  // Modern splat blending using multiple frequencies
  float nBroad = pnoise(vWorldPosition.xz * 0.012) * 0.5 + 0.5;
  float nDetail = snoise(vWorldPosition.xz * 0.06) * 0.5 + 0.5;
  
  float blendMask = mix(nBroad, nDetail, 0.3);
  float rockBlend = smoothstep(0.1, 0.5, slope + (blendMask - 0.5) * 0.6);
  
  vec4 detailTex = mix(grassColor, rockColor, rockBlend);
  
  // Extract high-frequency detail as luminance from the splat textures
  float detailLum = dot(detailTex.rgb, vec3(0.299, 0.587, 0.114));
  detailLum = mix(0.4, detailLum, 1.4);
  
  sampledDiffuseColor = vec4(sampledDiffuseColor.rgb * detailLum * 1.5, sampledDiffuseColor.a);

  diffuseColor *= sampledDiffuseColor;
#endif
`;

export const terrainFogFragment = () => /* glsl */ `
#pragma vscode_glsllint_stage: frag
#include <fog_fragment>
#ifdef USE_FOG
  vec2 directionalFogView = vec2( -vViewPosition.x, -vViewPosition.z );
  vec2 directionalFogSun = directionalFogSunViewDirection.xz;
  float directionalFogViewLen = length( directionalFogView );
  float directionalFogSunLen = length( directionalFogSun );
  if ( directionalFogViewLen > 1e-4 && directionalFogSunLen > 1e-4 ) {
    directionalFogView /= directionalFogViewLen;
    directionalFogSun /= directionalFogSunLen;
    float directionalFogTowardSun = dot( directionalFogView, directionalFogSun ) * 0.5 + 0.5;
    float directionalFogBoost = mix( 1.0 - directionalFogStrength, 1.0 + directionalFogStrength, directionalFogTowardSun );
    float directionalFogAdjusted = clamp( fogFactor * directionalFogBoost, 0.0, 1.0 );
    float directionalFogExtra = max( 0.0, directionalFogAdjusted - fogFactor );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, 0.1 * fogColor, 2.0 * directionalFogExtra );
  }
#endif
`;
