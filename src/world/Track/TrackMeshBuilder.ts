import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  BoxGeometry,
  Vector3,
  Vector2,
  Color,
  Texture,
} from "three";
import { TrackSpline } from "./TrackSpline";

export type TrackMeshConfig = {
  sampleCountForMesh: number;
  railGauge: number;
  railSegmentLength: number;
  sleeperSpacing: number;
  ballastWidth: number;
  ballastHeight: number;
  ballastTopOffset: number;
  ballastSideTaper: number;
  railWidth: number;
  railHeight: number;
  railBaseOffset: number;
  sleeperWidth: number;
  sleeperHeight: number;
  sleeperDepth: number;
  sleeperBaseOffset: number;
};

const UP = new Vector3(0, 1, 0);

export class TrackMeshBuilder {
  private readonly center = new Vector3();
  private readonly tangent = new Vector3();
  private readonly right = new Vector3();
  private readonly tmp = new Vector3();

  constructor(
    private readonly spline: TrackSpline,
    private readonly config: TrackMeshConfig,
    private readonly dirtPathTexture: Texture,
    private readonly woodenPlankTexture: Texture,
    private readonly railTexture: Texture,
  ) {}

  build(): Group {
    const group = new Group();

    group.name = "track-mesh";
    group.add(this.buildBallastMesh());
    group.add(this.buildSleeperMesh());
    group.add(this.buildRailMesh(-1));
    group.add(this.buildRailMesh(1));

    return group;
  }

  private buildBallastMesh(): Mesh {
    const sampleCount = Math.max(12, this.config.sampleCountForMesh);
    const ringCount = sampleCount + 1;
    const vertices = new Float32Array(ringCount * 4 * 3);
    const uvs = new Float32Array(ringCount * 4 * 2);
    const indices: number[] = [];
    const halfWidth = this.config.ballastWidth * 0.5;
    const thickness = this.config.ballastHeight;
    const sideTaper = Math.max(0, this.config.ballastSideTaper);

    const sideWidth = Math.hypot(sideTaper, thickness);
    const totalWidth = sideWidth * 2 + this.config.ballastWidth;
    const uTopLeft = sideWidth / totalWidth;
    const uTopRight = (sideWidth + this.config.ballastWidth) / totalWidth;

    for (let i = 0; i < ringCount; i += 1) {
      const distance = (i / sampleCount) * this.spline.getLength();
      this.sampleFrame(distance);

      const topCenter = this.center.clone();
      topCenter.y += this.config.ballastTopOffset;
      const topLeft = topCenter.clone().addScaledVector(this.right, -halfWidth);
      const topRight = topCenter.clone().addScaledVector(this.right, halfWidth);
      const bottomLeft = topLeft
        .clone()
        .addScaledVector(this.right, -sideTaper)
        .addScaledVector(UP, -thickness);
      const bottomRight = topRight
        .clone()
        .addScaledVector(this.right, sideTaper)
        .addScaledVector(UP, -thickness);

      const vertexOffset = i * 12;
      this.writeVertex(vertices, vertexOffset, topLeft);
      this.writeVertex(vertices, vertexOffset + 3, topRight);
      this.writeVertex(vertices, vertexOffset + 6, bottomLeft);
      this.writeVertex(vertices, vertexOffset + 9, bottomRight);

      const uvOffset = i * 8;
      const uvV = distance / totalWidth;
      uvs[uvOffset] = uTopLeft; uvs[uvOffset + 1] = uvV;
      uvs[uvOffset + 2] = uTopRight; uvs[uvOffset + 3] = uvV;
      uvs[uvOffset + 4] = 0; uvs[uvOffset + 5] = uvV;
      uvs[uvOffset + 6] = 1; uvs[uvOffset + 7] = uvV;

      if (i < sampleCount) {
        const a = i * 4;
        const b = (i + 1) * 4;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a, b, a + 2, b, b + 2, a + 2);
        indices.push(a + 1, a + 3, b + 1, b + 1, a + 3, b + 3);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.0,
      map: this.dirtPathTexture,
      color: new Color("#ffffff"),
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying vec3 vWorldPosition;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

      shader.fragmentShader = `
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

        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
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
        `
      );
    };

    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildRailMesh(side: -1 | 1): InstancedMesh {
    const length = this.spline.getLength();
    const segmentLength = Math.max(0.5, this.config.railSegmentLength);
    const count = Math.max(1, Math.floor(length / segmentLength));
    const geometry = new BoxGeometry(
      this.config.railWidth,
      this.config.railHeight,
      segmentLength,
    );
    const material = new MeshStandardMaterial({
      color: 0xbcc6ce,
      roughness: 0.28,
      metalness: 0.95,
      map: this.railTexture,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying vec3 vWorldPosition;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        `
      );

      shader.fragmentShader = `
        varying vec3 vWorldPosition;
        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
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
        `
      );
    };

    const rails = new InstancedMesh(geometry, material, count);
    rails.castShadow = true;
    rails.receiveShadow = true;

    const offset = this.config.railGauge * 0.5 * side;
    const yOffset =
      this.config.ballastTopOffset +
      this.config.railBaseOffset +
      this.config.railHeight * 0.5;
    const instance = new Object3D();

    for (let i = 0; i < count; i += 1) {
      const distance = Math.min(
        length,
        i * segmentLength + segmentLength * 0.5,
      );
      this.sampleFrame(distance);

      instance.position.copy(this.center).addScaledVector(this.right, offset);
      instance.position.y += yOffset;

      this.tmp.copy(instance.position).add(this.tangent);
      instance.up.copy(UP);
      instance.lookAt(this.tmp);
      instance.updateMatrix();

      rails.setMatrixAt(i, instance.matrix);
    }

    rails.instanceMatrix.needsUpdate = true;
    return rails;
  }

  private buildSleeperMesh(): InstancedMesh {
    const length = this.spline.getLength();
    const sleeperSpacing = Math.max(0.6, this.config.sleeperSpacing);
    const count = Math.max(1, Math.floor(length / sleeperSpacing));
    const geometry = new BoxGeometry(
      this.config.sleeperWidth,
      this.config.sleeperHeight,
      this.config.sleeperDepth,
    );
    const material = new MeshStandardMaterial({
      color: 0x6d4f35,
      roughness: 0.9,
      metalness: 0.08,
      map: this.woodenPlankTexture,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying vec3 vWorldPosition;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        `
      );

      shader.fragmentShader = `
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

        ${shader.fragmentShader}
      `.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          // Offset the UVs per sleeper based on its world position so each sleeper looks unique
          vec2 sleeperOffset = vec2(snoise(vWorldPosition.xz * 0.1), snoise(vWorldPosition.xz * 0.1 + 10.0)) * 2.0;
          vec4 sampledDiffuseColor = texture2D( map, vMapUv + sleeperOffset );
          diffuseColor *= sampledDiffuseColor;
        #endif
        `
      );
    };
    const sleepers = new InstancedMesh(geometry, material, count);
    sleepers.castShadow = true;
    sleepers.receiveShadow = true;

    const yOffset =
      this.config.ballastTopOffset +
      this.config.sleeperBaseOffset +
      this.config.sleeperHeight * 0.5;
    const instance = new Object3D();

    for (let i = 0; i < count; i += 1) {
      const distance = i * sleeperSpacing;
      this.sampleFrame(distance);

      instance.position.copy(this.center);
      instance.position.y += yOffset;

      this.tmp.copy(this.center).add(this.tangent);
      instance.up.copy(UP);
      instance.lookAt(this.tmp);
      instance.updateMatrix();

      sleepers.setMatrixAt(i, instance.matrix);
    }

    sleepers.instanceMatrix.needsUpdate = true;
    return sleepers;
  }

  private sampleFrame(distance: number): void {
    this.center.copy(this.spline.getPositionAtDistance(distance));
    this.tangent.copy(this.spline.getTangentAtDistance(distance));
    this.right.crossVectors(this.tangent, UP).normalize();
  }

  private writeVertex(
    buffer: Float32Array,
    offset: number,
    value: Vector3,
  ): void {
    buffer[offset] = value.x;
    buffer[offset + 1] = value.y;
    buffer[offset + 2] = value.z;
  }
}
