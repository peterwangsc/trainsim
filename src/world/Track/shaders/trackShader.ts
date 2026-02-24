export const ballastVertex = (shaderVertexShader: string) => /* glsl */ `
varying vec3 vWorldPosition;
${shaderVertexShader}
`;

export const ballastWorldPosVertex = () => /* glsl */ `
#include <worldpos_vertex>
vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

export const ballastFragment = (shaderFragmentShader: string) => /* glsl */ `
varying vec3 vWorldPosition;

// Fast hash-based noise
vec4 hash4( vec2 p ) {
    return fract(sin(vec4( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)), dot(p,vec2(113.5,271.9)), dot(p,vec2(246.1,124.6)))) * 43758.5453123);
}

// Simplex Noise
vec2 hash2( vec2 p ) {
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float snoise( in vec2 p ) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor( p + (p.x+p.y)*K1 );
    vec2 a = p - i + (i.x+i.y)*K2;
    vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0*K2;
    vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
    vec3 n = h*h*h*h*vec3( dot(a,hash2(i+0.0)), dot(b,hash2(i+o)), dot(c,hash2(i+1.0)));
    return dot( n, vec3(70.0) );
}

// Classic Perlin Noise
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

export const ballastMapFragment = () => /* glsl */ `
#ifdef USE_MAP
  // Zoomed out: The multiplier 0.25 controls the frequency of the dirt texture.
  // Increase this number to zoom out (make rocks smaller), decrease to zoom in.
  vec4 sampledDiffuseColor = textureNoTile( map, vWorldPosition.xz * 0.25, 1.0 );
  
  // Broad strokes from Perlin noise to create macro color variation over very large distances
  float nBroad = pnoise(vWorldPosition.xz * 0.005) * 0.5 + 0.5;
  
  // Extract high-frequency detail as luminance from the dirt path texture
  float detailLum = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // Apply contrast curve to the detail map
  detailLum = mix(0.4, detailLum, 1.4);
  
  // Base rock/dirt colors for the ballast to lower overall brightness
  vec3 baseColor1 = vec3(0.28, 0.26, 0.24); // Darker grey-brown
  vec3 baseColor2 = vec3(0.42, 0.39, 0.36); // Lighter grey-brown
  vec3 macroColor = mix(baseColor1, baseColor2, nBroad);
  
  // Combine the macro color with the high-frequency luminance
  sampledDiffuseColor = vec4(macroColor * detailLum * 1.5, sampledDiffuseColor.a);
  
  diffuseColor *= sampledDiffuseColor;
#endif
`;

export const railVertex = (shaderVertexShader: string) => /* glsl */ `
varying vec3 vWorldPosition;
${shaderVertexShader}
`;

export const railWorldPosVertex = () => /* glsl */ `
#include <worldpos_vertex>
#ifdef USE_INSTANCING
  vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;

export const railFragment = (shaderFragmentShader: string) => /* glsl */ `
varying vec3 vWorldPosition;
${shaderFragmentShader}
`;

export const railMapFragment = () => /* glsl */ `
#ifdef USE_MAP
  // Sample the rail texture along the longitudinal axis using world position
  // This ensures the brushed metal detail follows the track perfectly without stretching
  vec2 railUv = vec2(vWorldPosition.y * 0.5, length(vWorldPosition.xz) * 0.2);
  
  // Using a simple longitudinal mapping for the rails
  // We use world Y and a projected length to keep it consistent
  vec4 sampledDiffuseColor = texture2D( map, vec2(vMapUv.x, vWorldPosition.y + vWorldPosition.x + vWorldPosition.z) * 0.1 );
  
  // Re-adjust: just use a high-frequency longitudinal tile
  sampledDiffuseColor = texture2D( map, vec2(vMapUv.x, (vWorldPosition.x + vWorldPosition.y + vWorldPosition.z) * 0.5) );
  
  diffuseColor *= sampledDiffuseColor;
#endif
`;

export const sleeperVertex = (shaderVertexShader: string) => /* glsl */ `
varying vec3 vWorldPosition;
${shaderVertexShader}
`;

export const sleeperWorldPosVertex = () => /* glsl */ `
#include <worldpos_vertex>
#ifdef USE_INSTANCING
  vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;

export const sleeperFragment = (shaderFragmentShader: string) => /* glsl */ `
varying vec3 vWorldPosition;

vec2 hash2( vec2 p ) {
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float snoise( in vec2 p ) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor( p + (p.x+p.y)*K1 );
    vec2 a = p - i + (i.x+i.y)*K2;
    vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0*K2;
    vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
    vec3 n = h*h*h*h*vec3( dot(a,hash2(i+0.0)), dot(b,hash2(i+o)), dot(c,hash2(i+1.0)));
    return dot( n, vec3(70.0) );
}

${shaderFragmentShader}
`;

export const sleeperMapFragment = () => /* glsl */ `
#ifdef USE_MAP
  // Offset the UVs per sleeper based on its world position so each sleeper looks unique
  vec2 sleeperOffset = vec2(snoise(vWorldPosition.xz * 0.1), snoise(vWorldPosition.xz * 0.1 + 10.0)) * 2.0;
  vec4 sampledDiffuseColor = texture2D( map, vMapUv + sleeperOffset );
  diffuseColor *= sampledDiffuseColor;
#endif
`;
