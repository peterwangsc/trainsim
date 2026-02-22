export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private frameId = 0;

  constructor(
    private readonly fixedDt: number,
    private readonly simStep: (dt: number) => void,
    private readonly render: (alpha: number) => void
  ) {}

  start(): void {
    if (this.frameId !== 0) {
      return;
    }

    this.accumulator = 0;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameId !== 0) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private tick = (now: number): void => {
    const deltaSeconds = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;
    this.accumulator += deltaSeconds;

    while (this.accumulator >= this.fixedDt) {
      this.simStep(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.render(this.accumulator / this.fixedDt);
    this.frameId = requestAnimationFrame(this.tick);
  };
}
