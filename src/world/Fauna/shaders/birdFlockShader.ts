export const birdVertex = () => /* glsl */ `
#pragma vscode_glsllint_stage: vert
      uniform float uTime;

      attribute float aPhase;
      attribute float aFlapSpeed;
      attribute float aBirdScale;

      varying float vWingMask;
      varying float vShade;

      void main() {
        vec3 p = position;
        float wingMask = step(0.001, abs(p.x));
        vWingMask = wingMask;

        float flap = sin(uTime * aFlapSpeed + aPhase);
        p.y += wingMask * flap * 0.08 * sign(p.x);
        p *= aBirdScale;

        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        vShade = 0.5 + 0.5 * flap;
      }
`;

export const birdFragment = () => /* glsl */ `
#pragma vscode_glsllint_stage: frag
      uniform float uOpacity;
      varying float vWingMask;
      varying float vShade;

      void main() {
        vec3 body = vec3(0.08, 0.085, 0.095);
        vec3 wing = vec3(0.035, 0.038, 0.045);
        vec3 col = mix(body, wing, vWingMask);
        col *= mix(0.82, 1.05, vShade);
        gl_FragColor = vec4(col, uOpacity);
      }
`;
