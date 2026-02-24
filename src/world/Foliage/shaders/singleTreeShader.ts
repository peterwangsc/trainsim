export const trunkFragmentCommon = () => /* glsl */ `
#include <common>
uniform float trunkWrap;
`;

export const trunkLightsFragmentBegin = () => /* glsl */ `
#include <lights_fragment_begin>
reflectedLight.directDiffuse *= 1.0 + trunkWrap;
reflectedLight.indirectDiffuse *= 1.0 + trunkWrap * 0.5;
`;

export const canopyVertexCommon = () => /* glsl */ `
#include <common>
uniform float foliageNormalCompensation;
uniform float foliageShadowReceiverBias;
`;

export const canopyDefaultNormalVertex = () => /* glsl */ `
#include <defaultnormal_vertex>
mat3 foliageModelViewNoScale = mat3(
  normalize( modelViewMatrix[ 0 ].xyz ),
  normalize( modelViewMatrix[ 1 ].xyz ),
  normalize( modelViewMatrix[ 2 ].xyz )
);
vec3 foliageNoScaleNormal = normalize(
  foliageModelViewNoScale * normalize( objectNormal )
);
transformedNormal = normalize(
  mix( transformedNormal, foliageNoScaleNormal, foliageNormalCompensation )
);
`;

export const canopyShadowMapVertex = () => /* glsl */ `
#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )

  // Extra receiver offset softens close canopy self-shadowing while preserving terrain shadows.
  vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
  vec4 shadowWorldPosition;

#endif

#if defined( USE_SHADOWMAP )

  #if NUM_DIR_LIGHT_SHADOWS > 0

    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {

      float foliageDirectionalBias = directionalLightShadows[ i ].shadowNormalBias + foliageShadowReceiverBias;
      shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * foliageDirectionalBias, 0 );
      vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;

    }
    #pragma unroll_loop_end

  #endif

  #if NUM_POINT_LIGHT_SHADOWS > 0

    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {

      float foliagePointBias = pointLightShadows[ i ].shadowNormalBias + foliageShadowReceiverBias;
      shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * foliagePointBias, 0 );
      vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;

    }
    #pragma unroll_loop_end

  #endif

#endif

// spot lights can be evaluated without active shadow mapping (when SpotLight.map is used)

#if NUM_SPOT_LIGHT_COORDS > 0

  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {

    shadowWorldPosition = worldPosition;
    #if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
      shadowWorldPosition.xyz += shadowWorldNormal * ( spotLightShadows[ i ].shadowNormalBias + foliageShadowReceiverBias );
    #endif
    vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;

  }
  #pragma unroll_loop_end

#endif
`;

export const canopyFragmentCommon = () => /* glsl */ `
#include <common>
uniform float foliageWrap;
uniform float foliageBackscatter;
uniform float foliageBackscatterPower;
`;

export const canopyMapFragment = () => /* glsl */ `
#ifdef USE_MAP
  vec4 tex = texture2D( map, vMapUv );
  
  // Force bright/white background to be transparent so alphaTest can clip it.
  // We use the minimum color channel; if even the darkest channel is bright, it's white/gray background.
  float minCol = min(tex.r, min(tex.g, tex.b));
  float isBackground = smoothstep(0.0, 0.15, minCol);
  
  // Blend the texture color with the material's solid base color
  diffuseColor.rgb = tex.rgb * 1.5; 
  diffuseColor.a = tex.a * (1.0 - isBackground);
#endif
`;

export const canopyLightsFragmentBegin = () => /* glsl */ `
#include <lights_fragment_begin>
float foliageNoV = saturate( dot( geometryNormal, geometryViewDir ) );
float foliageTranslucency = pow( 1.0 - foliageNoV, foliageBackscatterPower );
reflectedLight.directDiffuse *= 1.0 + foliageWrap;
reflectedLight.indirectDiffuse *= 1.0 + foliageWrap * 0.24;
totalEmissiveRadiance += diffuseColor.rgb * foliageBackscatter * foliageTranslucency;
`;
