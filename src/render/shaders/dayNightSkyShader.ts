/* GLSL Lint: The shader stage could not be determined automatically. Please add: '#pragma vscode_glsllint_stage: STAGE' to the shader code. Where STAGE is a valid shader stage (e.g.: 'vert' or 'frag', see 'Available stages' in the docs) */

export const starfieldVertex =
  () => /* glsl */ `#pragma vscode_glsllint_stage: vert
uniform float time;
attribute float size;
attribute vec2 twinkle;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  vColor = color;
  float twinkleWave = sin(time * twinkle.y + twinkle.x);
  float twinkleSize = 3.0 + twinkleWave * 0.8;
  vTwinkle = 0.78 + twinkleWave * 0.22;
  vec4 mvPosition = modelViewMatrix * vec4(position, 0.5);
  gl_PointSize = size * (30.0 / -mvPosition.z) * twinkleSize;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const starfieldFragment = (
  colorSpaceInclude: string,
) => /* glsl */ `#pragma vscode_glsllint_stage: frag
uniform float fade;
uniform float alpha;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  float opacity = 1.0;
  if (fade == 1.0) {
    float d = distance(gl_PointCoord, vec2(0.5, 0.5));
    opacity = 1.0 / (1.0 + exp(16.0 * (d - 0.25)));
  }

  gl_FragColor = vec4(vColor, opacity * alpha * vTwinkle);

  #include <tonemapping_fragment>
  #include <${colorSpaceInclude}>
}
`;

export const skyUniformsHeader =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
uniform vec3 up;
uniform float cloudCoverage;
uniform float cloudDensity;
uniform float cloudElevation;
uniform float cloudNightFactor;
uniform float time;
`;

export const skyNoiseFunctions =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
float hash2( vec2 p ) {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float noise2( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix(
        mix( hash2( i + vec2( 0.0, 0.0 ) ), hash2( i + vec2( 1.0, 0.0 ) ), u.x ),
        mix( hash2( i + vec2( 0.0, 1.0 ) ), hash2( i + vec2( 1.0, 1.0 ) ), u.x ),
        u.y
    );
}

float fbm2( vec2 p ) {
    float value = 0.0;
    float amplitude = 0.5;

    for ( int i = 0; i < 5; i ++ ) {
        value += noise2( p ) * amplitude;
        p = p * 2.03 + vec2( 13.7, 7.1 );
        amplitude *= 0.5;
    }

    return value;
}

void main() {
`;

export const skyCloudColorReplace =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

vec2 skyUv = uv - vec2( 0.5 );
vec2 rotatedSkyUv = vec2( skyUv.y, -skyUv.x );
vec2 cloudUv = rotatedSkyUv * 8.0 + vec2( -time * 0.006, 0.0 );
float cloudField = fbm2( cloudUv + fbm2( cloudUv * 0.57 ) * 0.35 );
float cloudShape = smoothstep(
    1.0 - cloudCoverage - cloudDensity * 0.55,
    1.0 - cloudCoverage + 0.12,
    cloudField
);
float horizonMask = smoothstep( cloudElevation - 0.28, cloudElevation + 0.35, uv.y );
float cloudMask = cloudShape * horizonMask;
    vec3 cloudTintDay = mix(
        vec3( 1.0 ),
        vec3( 1.25, 0.72, 0.42 ),
        clamp( 1.0 - direction.y * 1.4, 0.0, 1.0 )
    );
    vec3 cloudTintNight = mix(
        vec3( 0.74, 0.81, 0.95 ),
        vec3( 0.58, 0.66, 0.8 ),
        clamp( 1.0 - direction.y * 1.2, 0.0, 1.0 )
    );
    vec3 cloudTint = mix( cloudTintDay, cloudTintNight, cloudNightFactor );
    float cloudDensityMix = cloudDensity * mix( 1.0, 0.35, cloudNightFactor );
    float cloudDarken = mix( 0.6, 0.78, cloudNightFactor );
    float cloudTintStrength = mix( 0.08, 0.03, cloudNightFactor );
    texColor = mix(
        texColor,
        texColor * cloudDarken + cloudTint * cloudTintStrength,
        cloudMask * cloudDensityMix
    );
`;

export const directionalFogPars =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
#include <fog_pars_fragment>
uniform vec3 directionalFogSunViewDirection;
uniform float directionalFogStrength;
`;

export const directionalFogFragment =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
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

export const spriteCloudVertexBase =
  () => /* glsl */ `#pragma vscode_glsllint_stage: vert
attribute float cloudOpacity;
varying float vCloudOpacity;
`;

export const spriteCloudFogVertex =
  () => /* glsl */ `#pragma vscode_glsllint_stage: vert
#include <fog_vertex>
vCloudOpacity = cloudOpacity;
`;

export const spriteCloudFragmentBase =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
varying float vCloudOpacity;
`;

export const spriteCloudOpaqueFragment =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
#include <opaque_fragment>
gl_FragColor = vec4( outgoingLight, diffuseColor.a * vCloudOpacity );
`;

export const spriteCloudOutputFragment =
  () => /* glsl */ `#pragma vscode_glsllint_stage: frag
#include <output_fragment>
gl_FragColor = vec4( outgoingLight, diffuseColor.a * vCloudOpacity );
`;
