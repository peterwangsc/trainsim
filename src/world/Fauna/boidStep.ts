import { Vector3 } from 'three';

type Boid = { pos: Vector3; vel: Vector3 };

const separationVector = new Vector3();
const alignmentVector = new Vector3();
const cohesionVector = new Vector3();
const tempVector = new Vector3();

type BoidStepOptions = {
  neighborRadius?: number;
  separationRadius?: number;
  separationWeight?: number;
  alignmentWeight?: number;
  cohesionWeight?: number;
  maxSpeed?: number;
  minSpeed?: number;
};

export function stepBoidsCPU(
  boids: Boid[],
  dt: number,
  {
    neighborRadius = 3.5,
    separationRadius = 1.2,
    separationWeight = 1.2,
    alignmentWeight = 0.5,
    cohesionWeight = 0.35,
    maxSpeed = 4.5,
    minSpeed = 1.2
  }: BoidStepOptions = {}
): void {
  const neighborRadiusSquared = neighborRadius * neighborRadius;
  const separationRadiusSquared = separationRadius * separationRadius;

  for (let i = 0; i < boids.length; i += 1) {
    const current = boids[i];

    separationVector.set(0, 0, 0);
    alignmentVector.set(0, 0, 0);
    cohesionVector.set(0, 0, 0);

    let neighborCount = 0;

    for (let j = 0; j < boids.length; j += 1) {
      if (i === j) {
        continue;
      }

      const neighbor = boids[j];
      const distanceSquared = current.pos.distanceToSquared(neighbor.pos);
      if (distanceSquared > neighborRadiusSquared) {
        continue;
      }

      neighborCount += 1;
      alignmentVector.add(neighbor.vel);
      cohesionVector.add(neighbor.pos);

      if (distanceSquared < separationRadiusSquared && distanceSquared > 1e-6) {
        tempVector
          .copy(current.pos)
          .sub(neighbor.pos)
          .multiplyScalar(1 / distanceSquared);
        separationVector.add(tempVector);
      }
    }

    if (neighborCount > 0) {
      alignmentVector
        .multiplyScalar(1 / neighborCount)
        .sub(current.vel)
        .multiplyScalar(alignmentWeight);
      cohesionVector
        .multiplyScalar(1 / neighborCount)
        .sub(current.pos)
        .multiplyScalar(cohesionWeight);
      separationVector.multiplyScalar(separationWeight);

      current.vel.addScaledVector(alignmentVector, dt);
      current.vel.addScaledVector(cohesionVector, dt);
      current.vel.addScaledVector(separationVector, dt);
    }

    const speed = current.vel.length();
    if (speed > maxSpeed) {
      current.vel.setLength(maxSpeed);
    } else if (speed < minSpeed) {
      current.vel.setLength(minSpeed);
    }

    current.pos.addScaledVector(current.vel, dt);
  }
}
