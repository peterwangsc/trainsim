import { Vector3 } from 'three';
import { TrackSpline } from './TrackSpline';

const CURVATURE_SAMPLE_SPAN = 4;

export const curvatureAtDistance = (spline: TrackSpline, distance: number): number => {
  const prev = spline.getPositionAtDistance(distance - CURVATURE_SAMPLE_SPAN);
  const curr = spline.getPositionAtDistance(distance);
  const next = spline.getPositionAtDistance(distance + CURVATURE_SAMPLE_SPAN);

  const v1 = new Vector3().subVectors(curr, prev);
  const v2 = new Vector3().subVectors(next, curr);

  const len1 = v1.length();
  const len2 = v2.length();

  if (len1 === 0 || len2 === 0) {
    return 0;
  }

  const n1 = v1.normalize();
  const n2 = v2.normalize();
  const angle = Math.acos(Math.min(1, Math.max(-1, n1.dot(n2))));
  const arcLength = (len1 + len2) * 0.5;

  if (arcLength < 0.001) {
    return 0;
  }

  const cross = new Vector3().crossVectors(n1, n2);
  const sign = Math.sign(cross.y || 1);

  return sign * (angle / arcLength);
};
