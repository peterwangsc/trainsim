export const grassVertexCommon = () => /* glsl */ `
#pragma vscode_glsllint_stage: vert
#include <common>
attribute vec4 aBladeData;
varying vec2 vGrassUv;
varying float vGrassTip;
varying float vGrassSeed;
varying float vGrassTint;
varying vec3 vGrassWorldPos;
varying float vWindStrength;
varying float vIsAccent;

uniform float uTime;
uniform vec3 uWind;
uniform sampler2D uWindNoise;
`;

export const grassVertexMain = () => /* glsl */ `
#pragma vscode_glsllint_stage: vert
#include <begin_vertex>
vGrassUv = uv;
float tip = clamp(uv.y, 0.0, 1.0);
vGrassTip = tip;
vGrassSeed = aBladeData.x;

float rawTint = aBladeData.w;
float isAccent = step(rawTint, -1.5);
vIsAccent = isAccent;
vGrassTint = rawTint + isAccent * 2.0;

#ifdef USE_INSTANCING
vec3 instanceOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
vec3 instanceOrigin = vec3(0.0);
#endif

vec2 uv1 = instanceOrigin.xz * uWind.z * 0.016 + vec2(uTime * uWind.y * 0.025, uTime * uWind.y * 0.018);
vec2 uv2 = instanceOrigin.xz * uWind.z * 0.011 + vec2(-uTime * uWind.y * 0.02, uTime * uWind.y * 0.021);
float n1 = texture2D(uWindNoise, uv1 + vec2(aBladeData.z, aBladeData.x)).r * 2.0 - 1.0;
float n2 = texture2D(uWindNoise, uv2 + vec2(aBladeData.x * 0.7, aBladeData.z * 0.6)).r * 2.0 - 1.0;
float windValue = n1 * 0.68 + n2 * 0.32;

float sway = windValue * uWind.x * (0.35 + aBladeData.y * 0.65);
float bendMask = tip * tip;
transformed.x += sway * bendMask;
transformed.z += sway * 0.45 * bendMask;
vWindStrength = windValue;

#ifdef USE_INSTANCING
vec4 grassWorldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
vec4 grassWorldPosition = modelMatrix * vec4(transformed, 1.0);
#endif
vGrassWorldPos = grassWorldPosition.xyz;
`;

export const grassFragmentCommon = () => /* glsl */ `
#pragma vscode_glsllint_stage: frag
#include <common>
uniform vec2 uFadeDistance;
uniform vec2 uColorRamp;
uniform vec3 uPatchColor;
uniform sampler2D uWindNoise;
uniform sampler2D uGrassLeaf;
uniform sampler2D uGrassAccent;
varying vec2 vGrassUv;
varying float vGrassTip;
varying float vGrassSeed;
varying float vGrassTint;
varying vec3 vGrassWorldPos;
varying float vWindStrength;
varying float vIsAccent;
`;

export const grassFragmentMain = (tintVariation: string) => /* glsl */ `
#pragma vscode_glsllint_stage: frag
#include <color_fragment>
float distanceFade = 1.0 - smoothstep(uFadeDistance.x, uFadeDistance.y, distance(cameraPosition, vGrassWorldPos));
float ditherNoise = fract(sin(dot(gl_FragCoord.xy + vec2(vGrassSeed * 31.0, vGrassSeed * 97.0), vec2(12.9898, 78.233))) * 43758.5453);
if (ditherNoise > distanceFade) {
  discard;
}

vec2 uv = vGrassUv;
uv.x -= 0.5;
float fakePerspective = vWindStrength * 0.3;
uv.x *= (1.0 - uv.y) * fakePerspective + 1.0;
uv.x += 0.5;
uv.x = clamp(uv.x, 0.0, 1.0);

vec4 leafColor = vIsAccent > 0.5
  ? texture2D(uGrassAccent, uv)
  : texture2D(uGrassLeaf, uv);
if (leafColor.a < 0.5) discard;
vec3 leafRgb = leafColor.rgb;
float alphaMask = leafColor.a;

float gradient = mix(uColorRamp.x, uColorRamp.y, smoothstep(0.0, 1.0, vGrassTip));
float patch2 = texture2D(uWindNoise, vGrassWorldPos.xz * 0.005).r;
float patch3 = texture2D(uWindNoise, vGrassWorldPos.xz * 0.003 + vec2(0.41, 0.73)).r;

vec3 baseColor = diffuseColor.rgb;
if (patch2 > 0.604) {
  baseColor = mix(baseColor, uPatchColor, 0.55);
}
if (patch3 > 0.661) {
  baseColor = mix(baseColor, diffuseColor.rgb * 0.88 + vec3(0.02, 0.04, 0.0), 0.4);
}
if (vIsAccent > 0.5) {
  baseColor = mix(baseColor, baseColor * vec3(0.85, 1.05, 0.75), 0.35);
}

float tint = 1.0 + vGrassTint * ${tintVariation};
diffuseColor.rgb = baseColor * leafRgb * gradient * tint;
diffuseColor.a *= alphaMask;
`;
