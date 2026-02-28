import { clamp } from "../util/Math";
import type {
  CurvaturePreviewSample,
  MinimapPathPoint,
} from "../sim/TrackSampler";

export class MinimapCurvatureWidget {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = this.canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to create minimap canvas context");
    }

    this.ctx = ctx;
  }

  draw(
    pathPoints: MinimapPathPoint[],
    samples: CurvaturePreviewSample[],
    speed: number,
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);
    if (pathPoints.length === 0) {
      return;
    }

    const paddingX = 16;
    const paddingTop = 8;
    const paddingBottom = 10;
    const maxForward = Math.max(1, ...pathPoints.map((point) => point.forward));
    const maxAbsLateral = Math.max(
      1,
      ...pathPoints.map((point) => Math.abs(point.lateral)),
    );
    const scaleX = (width - paddingX * 2) / (maxAbsLateral * 2);
    const scaleY = (height - paddingTop - paddingBottom) / maxForward;
    const scale = Math.min(scaleX, scaleY);
    const originX = width * 0.5;
    const originY = height - paddingBottom;

    this.ctx.strokeStyle = "rgba(127, 165, 218, 0.33)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(originX, paddingTop);
    this.ctx.lineTo(originX, originY);
    this.ctx.stroke();

    const lastSample = samples[samples.length - 1];
    const severity = clamp(speed / lastSample.safeSpeed, 0, 1);
    const lineColor = `rgba(${Math.round(255 * severity)}, ${Math.round(210 - 70 * severity)}, 120, 0.95)`;

    this.ctx.lineWidth = 2.6;
    this.ctx.strokeStyle = lineColor;
    this.ctx.beginPath();
    pathPoints.forEach((point, index) => {
      const x = originX + point.lateral * scale;
      const y = originY - point.forward * scale;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    for (const sample of samples) {
      const severity = clamp(
        Math.abs(sample.lateral) / (sample.forward * 0.22),
        0,
        1,
      );
      const x = originX + sample.lateral * scale;
      const y = originY - sample.forward * scale;
      this.ctx.fillStyle = `rgba(${Math.round(255 * severity)}, ${Math.round(210 - 70 * severity)}, 120, 0.95)`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.fillStyle = "rgba(215, 235, 255, 0.95)";
    this.ctx.beginPath();
    this.ctx.arc(originX, originY, 4.8, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
