import {
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  type IUniform
} from 'three'
import { SeededRandom } from '../../util/SeededRandom'
import { ASSETS_CDN_BASE } from "../../game/Config";
import { TrackSpline } from '../Track/TrackSpline'

export type TerrainHeightSampler = (x: number, z: number) => number
export type TrackDistanceSampler = (x: number, z: number) => number

export type GrassConfig = {
  clumpSpacing: number
  bladesPerClump: number
  maxBladeCount: number
  spawnChancePerSide: number
  bandNear: number
  bandFar: number
  lateralJitter: number
  forwardJitter: number
  clumpRadius: number
  trackClearDistance: number
  trackFadeDistance: number
  bladeBaseHeight: number
  bladeBaseWidth: number
  bladeHeightVariance: number
  bladeWidthVariance: number
  bladeRootOffset: number
  accentFrequency: number
  tintVariation: number
  slopeSampleStep: number
  slopeMin: number
  slopeMax: number
  densityNoiseScale: number
  densityThresholdMin: number
  windStrength: number
  windSpeed: number
  windSpatialFrequency: number
  fadeStart: number
  fadeEnd: number
  rootDarken: number
  tipLighten: number
  fieldColor: string
  patchColor: string
}

type GrassShaderUniforms = {
  uTime: IUniform<number>
  uWind: IUniform<Vector3>
  uFadeDistance: IUniform<Vector2>
  uColorRamp: IUniform<Vector2>
  uWindNoise: IUniform<Texture | null>
  uGrassLeaf: IUniform<Texture | null>
  uGrassAccent: IUniform<Texture | null>
  uPatchColor: IUniform<Color>
  uHasWindNoise: IUniform<number>
  uHasLeafTexture: IUniform<number>
}

type GrassFieldData = {
  bladeMatrices: Matrix4[]
  bladeData: Float32Array
  bladeCount: number
}

const TAU = Math.PI * 2
const GRASS_SHADER_CACHE_KEY = 'grass-layer-v1'
const UP = new Vector3(0, 1, 0)

export class GrassLayer {
  private readonly root = new Group()
  private readonly geometry: PlaneGeometry
  private readonly material: MeshStandardMaterial
  private readonly mesh: InstancedMesh<PlaneGeometry, MeshStandardMaterial>
  private readonly uniforms: GrassShaderUniforms
  private readonly textures = {
    windNoise: null as Texture | null,
    grassLeaf: null as Texture | null,
    grassAccent: null as Texture | null
  }

  private readonly center = new Vector3()
  private readonly tangent = new Vector3()
  private readonly right = new Vector3()
  private readonly bladePosition = new Vector3()
  private readonly bladeScale = new Vector3()
  private readonly bladeRotation = new Euler(0, 0, 0, 'YXZ')
  private readonly bladeQuaternion = new Quaternion()
  private elapsedTime = 0
  private disposed = false

  constructor(
    private readonly scene: Scene,
    private readonly spline: TrackSpline,
    private readonly seed: number,
    private readonly config: GrassConfig,
    private readonly sampleTerrainHeight: TerrainHeightSampler,
    private readonly sampleTrackDistance: TrackDistanceSampler
  ) {
    this.geometry = new PlaneGeometry(1, 1, 1, 4)
    this.geometry.translate(0, 0.5, 0)

    this.uniforms = {
      uTime: { value: 0 },
      uWind: {
        value: new Vector3(
          this.config.windStrength,
          this.config.windSpeed,
          this.config.windSpatialFrequency
        )
      },
      uFadeDistance: {
        value: new Vector2(this.config.fadeStart, this.config.fadeEnd)
      },
      uColorRamp: {
        value: new Vector2(this.config.rootDarken, this.config.tipLighten)
      },
      uWindNoise: { value: null },
      uGrassLeaf: { value: null },
      uGrassAccent: { value: null },
      uPatchColor: { value: new Color(this.config.patchColor) },
      uHasWindNoise: { value: 0 },
      uHasLeafTexture: { value: 0 }
    }

    this.material = this.createMaterial()

    const field = this.buildGrassField()
    this.geometry.setAttribute(
      'aBladeData',
      new InstancedBufferAttribute(field.bladeData, 4)
    )

    this.mesh = new InstancedMesh(
      this.geometry,
      this.material,
      Math.max(1, field.bladeCount)
    )
    this.mesh.count = field.bladeCount
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true
    this.mesh.castShadow = false

    for (let i = 0; i < field.bladeCount; i += 1) {
      this.mesh.setMatrixAt(i, field.bladeMatrices[i])
    }
    this.mesh.instanceMatrix.needsUpdate = true

    this.root.name = 'grass-layer'
    this.root.frustumCulled = false
    this.root.add(this.mesh)
    this.scene.add(this.root)

    this.loadTextures()
  }

  update(dt: number): void {
    this.elapsedTime += dt
    this.uniforms.uTime.value = this.elapsedTime
  }

  dispose(): void {
    this.disposed = true
    this.scene.remove(this.root)
    this.geometry.dispose()
    this.material.dispose()
    this.textures.windNoise?.dispose()
    this.textures.grassLeaf?.dispose()
    this.textures.grassAccent?.dispose()
  }

  private buildGrassField(): GrassFieldData {
    const bladeMatrices: Matrix4[] = []
    const bladeDataRaw = new Float32Array(this.config.maxBladeCount * 4)
    const rng = new SeededRandom(this.seed ^ 0x7f4a7c15)

    const spacing = Math.max(1.5, this.config.clumpSpacing)
    const trackLength = this.spline.getLength()
    let bladeCount = 0

    for (
      let distance = 0;
      distance < trackLength && bladeCount < this.config.maxBladeCount;
      distance += spacing
    ) {
      const trackDistance = distance + rng.range(-this.config.forwardJitter, this.config.forwardJitter)
      this.center.copy(this.spline.getPositionAtDistance(trackDistance))
      this.tangent.copy(this.spline.getTangentAtDistance(trackDistance))
      this.right.crossVectors(this.tangent, UP)

      if (this.right.lengthSq() <= 1e-6) {
        continue
      }
      this.right.normalize()

      bladeCount = this.spawnSideClump(
        rng,
        -1,
        bladeCount,
        bladeMatrices,
        bladeDataRaw
      )
      if (bladeCount >= this.config.maxBladeCount) {
        break
      }
      bladeCount = this.spawnSideClump(
        rng,
        1,
        bladeCount,
        bladeMatrices,
        bladeDataRaw
      )
    }

    return {
      bladeMatrices,
      bladeData: bladeDataRaw.subarray(0, bladeCount * 4),
      bladeCount
    }
  }

  private spawnSideClump(
    rng: SeededRandom,
    side: -1 | 1,
    bladeCount: number,
    bladeMatrices: Matrix4[],
    bladeDataRaw: Float32Array
  ): number {
    if (rng.next() > this.config.spawnChancePerSide) {
      return bladeCount
    }

    const sideOffset =
      rng.range(this.config.bandNear, this.config.bandFar) +
      rng.range(-this.config.lateralJitter, this.config.lateralJitter)
    const clumpX = this.center.x + this.right.x * sideOffset * side
    const clumpZ = this.center.z + this.right.z * sideOffset * side

    const distanceToTrack = this.sampleTrackDistance(clumpX, clumpZ)
    const trackBlend = MathUtils.smoothstep(
      distanceToTrack,
      this.config.trackClearDistance,
      this.config.trackFadeDistance
    )
    if (trackBlend <= 0.001) {
      return bladeCount
    }

    const slope = this.sampleTerrainSlope(clumpX, clumpZ)
    const slopeMask = 1 - MathUtils.smoothstep(slope, this.config.slopeMin, this.config.slopeMax)
    if (slopeMask <= 0.05) {
      return bladeCount
    }

    const density = this.sampleDensity(clumpX, clumpZ, slopeMask, trackBlend)
    const densityThreshold = this.config.densityThresholdMin + rng.next() * 0.18
    if (density < densityThreshold) {
      return bladeCount
    }

    const bladeTarget = Math.max(
      1,
      Math.round(this.config.bladesPerClump * MathUtils.lerp(0.55, 1.35, density))
    )
    const radius = Math.max(0.2, this.config.clumpRadius)

    for (
      let i = 0;
      i < bladeTarget && bladeCount < this.config.maxBladeCount;
      i += 1
    ) {
      const sampleRadius = radius * Math.sqrt(rng.next())
      const sampleAngle = rng.next() * TAU
      const x = clumpX + Math.cos(sampleAngle) * sampleRadius
      const z = clumpZ + Math.sin(sampleAngle) * sampleRadius

      if (this.sampleTrackDistance(x, z) < this.config.trackClearDistance * 0.85) {
        continue
      }

      const localSlope = this.sampleTerrainSlope(x, z)
      const localSlopeMask =
        1 - MathUtils.smoothstep(localSlope, this.config.slopeMin, this.config.slopeMax)
      if (localSlopeMask <= 0.03) {
        continue
      }

      const localDensity = this.sampleDensity(x, z, localSlopeMask, trackBlend)
      if (localDensity < this.config.densityThresholdMin * 0.7) {
        continue
      }

      const isAccent = rng.next() < this.config.accentFrequency
      const widthNoise =
        1 -
        this.config.bladeWidthVariance * 0.5 +
        rng.next() * this.config.bladeWidthVariance
      const heightNoise =
        1 -
        this.config.bladeHeightVariance * 0.5 +
        rng.next() * this.config.bladeHeightVariance
      const accentHeightScale = isAccent ? 1.55 : 1
      const accentWidthScale = isAccent ? 1.25 : 1
      const width = this.config.bladeBaseWidth * widthNoise * accentWidthScale
      const height =
        this.config.bladeBaseHeight *
        heightNoise *
        MathUtils.lerp(0.85, 1.2, localDensity) *
        accentHeightScale

      const yaw = rng.next() * TAU
      const leanX = (rng.next() - 0.5) * 0.12
      const leanZ = (rng.next() - 0.5) * 0.12
      this.bladeRotation.set(leanX, yaw, leanZ)
      this.bladeQuaternion.setFromEuler(this.bladeRotation)

      this.bladePosition.set(
        x,
        this.sampleTerrainHeight(x, z) + this.config.bladeRootOffset,
        z
      )
      this.bladeScale.set(width, height, 1)

      const matrix = new Matrix4()
      matrix.compose(this.bladePosition, this.bladeQuaternion, this.bladeScale)
      bladeMatrices.push(matrix)

      const dataIndex = bladeCount * 4
      bladeDataRaw[dataIndex] = rng.next()
      bladeDataRaw[dataIndex + 1] = localDensity
      bladeDataRaw[dataIndex + 2] = rng.next()
      const tint = rng.range(-1, 1)
      bladeDataRaw[dataIndex + 3] = isAccent ? -(Math.abs(tint) + 2) : tint
      bladeCount += 1
    }

    return bladeCount
  }

  private sampleTerrainSlope(x: number, z: number): number {
    const step = Math.max(0.25, this.config.slopeSampleStep)
    const hL = this.sampleTerrainHeight(x - step, z)
    const hR = this.sampleTerrainHeight(x + step, z)
    const hU = this.sampleTerrainHeight(x, z - step)
    const hD = this.sampleTerrainHeight(x, z + step)
    const dx = (hR - hL) / (2 * step)
    const dz = (hD - hU) / (2 * step)

    return Math.sqrt(dx * dx + dz * dz)
  }

  private sampleDensity(
    x: number,
    z: number,
    slopeMask: number,
    trackBlend: number
  ): number {
    const scale = this.config.densityNoiseScale
    const macroDensity = this.valueNoise2D(x * scale, z * scale)
    const patchDensity = this.valueNoise2D(
      (x + 41.7) * scale * 0.58,
      (z - 17.3) * scale * 0.58
    )

    return MathUtils.clamp((macroDensity * 0.72 + patchDensity * 0.28) * slopeMask * trackBlend, 0, 1)
  }

  private valueNoise2D(x: number, z: number): number {
    const x0 = Math.floor(x)
    const z0 = Math.floor(z)
    const x1 = x0 + 1
    const z1 = z0 + 1
    const tx = x - x0
    const tz = z - z0
    const sx = tx * tx * (3 - 2 * tx)
    const sz = tz * tz * (3 - 2 * tz)

    const n00 = this.hash2D(x0, z0)
    const n10 = this.hash2D(x1, z0)
    const n01 = this.hash2D(x0, z1)
    const n11 = this.hash2D(x1, z1)
    const nx0 = MathUtils.lerp(n00, n10, sx)
    const nx1 = MathUtils.lerp(n01, n11, sx)

    return MathUtils.lerp(nx0, nx1, sz)
  }

  private hash2D(x: number, z: number): number {
    const value = Math.sin(
      x * 127.1 +
      z * 311.7 +
      this.seed * 0.173
    ) * 43758.5453123

    return value - Math.floor(value)
  }

  private createMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
      color: this.config.fieldColor,
      roughness: 0.96,
      metalness: 0.02,
      side: DoubleSide,
      alphaTest: 0.5
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime
      shader.uniforms.uWind = this.uniforms.uWind
      shader.uniforms.uFadeDistance = this.uniforms.uFadeDistance
      shader.uniforms.uColorRamp = this.uniforms.uColorRamp
      shader.uniforms.uWindNoise = this.uniforms.uWindNoise
      shader.uniforms.uGrassLeaf = this.uniforms.uGrassLeaf
      shader.uniforms.uGrassAccent = this.uniforms.uGrassAccent
      shader.uniforms.uPatchColor = this.uniforms.uPatchColor
      shader.uniforms.uHasWindNoise = this.uniforms.uHasWindNoise
      shader.uniforms.uHasLeafTexture = this.uniforms.uHasLeafTexture

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
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
uniform float uHasWindNoise;
`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
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

float windValue;
if (uHasWindNoise > 0.5) {
  vec2 uv1 = instanceOrigin.xz * uWind.z * 0.016 + vec2(uTime * uWind.y * 0.025, uTime * uWind.y * 0.018);
  vec2 uv2 = instanceOrigin.xz * uWind.z * 0.011 + vec2(-uTime * uWind.y * 0.02, uTime * uWind.y * 0.021);
  float n1 = texture2D(uWindNoise, uv1 + vec2(aBladeData.z, aBladeData.x)).r * 2.0 - 1.0;
  float n2 = texture2D(uWindNoise, uv2 + vec2(aBladeData.x * 0.7, aBladeData.z * 0.6)).r * 2.0 - 1.0;
  windValue = n1 * 0.68 + n2 * 0.32;
} else {
  float windPhase = uTime * uWind.y + dot(instanceOrigin.xz, vec2(uWind.z, uWind.z * 1.19)) + aBladeData.z * 6.28318;
  windValue = sin(windPhase) * 0.72 + cos(windPhase * 1.63 + aBladeData.x * 4.0) * 0.28;
}

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
`
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec2 uFadeDistance;
uniform vec2 uColorRamp;
uniform vec3 uPatchColor;
uniform sampler2D uWindNoise;
uniform sampler2D uGrassLeaf;
uniform sampler2D uGrassAccent;
uniform float uHasWindNoise;
uniform float uHasLeafTexture;
varying vec2 vGrassUv;
varying float vGrassTip;
varying float vGrassSeed;
varying float vGrassTint;
varying vec3 vGrassWorldPos;
varying float vWindStrength;
varying float vIsAccent;
`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
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

vec3 leafRgb = vec3(1.0);
float alphaMask = 1.0;
if (uHasLeafTexture > 0.5) {
  vec4 leafColor = vIsAccent > 0.5
    ? texture2D(uGrassAccent, uv)
    : texture2D(uGrassLeaf, uv);
  if (leafColor.a < 0.5) discard;
  leafRgb = leafColor.rgb;
  alphaMask = leafColor.a;
} else {
  float sideMask = smoothstep(0.02, 0.28, vGrassUv.x) * (1.0 - smoothstep(0.72, 0.98, vGrassUv.x));
  float tipTaper = 1.0 - smoothstep(0.68, 1.0, vGrassTip) * abs(vGrassUv.x - 0.5) * 2.0;
  float bladeMask = sideMask * tipTaper;
  if (bladeMask < 0.09) discard;
  alphaMask = bladeMask;
}

float gradient = mix(uColorRamp.x, uColorRamp.y, smoothstep(0.0, 1.0, vGrassTip));
float patch2 = 0.0;
float patch3 = 0.0;
if (uHasWindNoise > 0.5) {
  patch2 = texture2D(uWindNoise, vGrassWorldPos.xz * 0.005).r;
  patch3 = texture2D(uWindNoise, vGrassWorldPos.xz * 0.003 + vec2(0.41, 0.73)).r;
} else {
  patch2 = fract(sin(dot(vGrassWorldPos.xz * 0.01, vec2(127.1, 311.7))) * 43758.5453);
  patch3 = fract(sin(dot(vGrassWorldPos.xz * 0.007 + vec2(4.3, 9.1), vec2(269.5, 183.3))) * 43758.5453);
}

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

float tint = 1.0 + vGrassTint * ${this.config.tintVariation.toFixed(3)};
diffuseColor.rgb = baseColor * leafRgb * gradient * tint;
diffuseColor.a *= alphaMask;
`
        )
    }

    material.customProgramCacheKey = () => GRASS_SHADER_CACHE_KEY
    return material
  }

  private loadTextures(): void {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return
    }

    const loader = new TextureLoader()

    loader.load(`${ASSETS_CDN_BASE}/simplex-noise.png`, (texture) => {
      if (this.disposed) {
        texture.dispose()
        return
      }
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      this.textures.windNoise = texture
      this.uniforms.uWindNoise.value = texture
      this.uniforms.uHasWindNoise.value = 1
    })

    loader.load(`${ASSETS_CDN_BASE}/grassleaf.png`, (texture) => {
      if (this.disposed) {
        texture.dispose()
        return
      }
      texture.colorSpace = SRGBColorSpace
      this.textures.grassLeaf = texture
      this.uniforms.uGrassLeaf.value = texture
      this.updateLeafTextureState()
    })

    loader.load(`${ASSETS_CDN_BASE}/accentleaf.png`, (texture) => {
      if (this.disposed) {
        texture.dispose()
        return
      }
      texture.colorSpace = SRGBColorSpace
      this.textures.grassAccent = texture
      this.uniforms.uGrassAccent.value = texture
      this.updateLeafTextureState()
    })
  }

  private updateLeafTextureState(): void {
    this.uniforms.uHasLeafTexture.value =
      this.textures.grassLeaf && this.textures.grassAccent ? 1 : 0
  }
}
