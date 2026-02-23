import { Object3D, Vector3 } from "three";
import { TrackSpline } from "./TrackSpline";

const _center = new Vector3();
const _tangent = new Vector3();
const _right = new Vector3();
const _lookTarget = new Vector3();
const _UP = new Vector3(0, 1, 0);

export function placeAlongTrack(
  object: Object3D,
  spline: TrackSpline,
  distance: number,
  lateralOffset = 0,
  heightOffset = 0,
  faceBackward = false,
): void {
  _center.copy(spline.getPositionAtDistance(distance));
  _tangent.copy(spline.getTangentAtDistance(distance));
  _right.crossVectors(_tangent, _UP).normalize();

  object.position.copy(_center).addScaledVector(_right, lateralOffset);
  object.position.y += heightOffset;

  _lookTarget.copy(_tangent);
  if (faceBackward) {
    _lookTarget.multiplyScalar(-1);
  }
  _lookTarget.add(object.position);
  object.up.copy(_UP);
  object.lookAt(_lookTarget);
}
