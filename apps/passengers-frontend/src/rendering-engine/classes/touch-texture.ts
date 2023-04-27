import { easeOutSine } from '@twl/common/utils/math';
import * as THREE from 'three';

interface Point {
  x: number;
  y: number;
  age: number;
  force: number;
}

export default class TouchTexture {
  private size = 64;

  private maxAge = 120;

  private radius = 0.15;

  private trail: Point[] = [];

  private canvas?: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D | null = null;

  texture?: THREE.Texture;

  constructor() {
    this.initTexture();
  }

  initTexture() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) throw new Error('Missing canvas context!');
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.texture = new THREE.Texture(this.canvas);

    this.canvas.id = 'touchTexture';
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.width}px`;
  }

  update() {
    this.clear();

    // age points
    this.trail.forEach((point, i) => {
      point.age += 1;
      // remove old
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      }
    });

    this.trail.forEach(point => {
      this.drawTouch(point);
    });

    if (this.texture) this.texture.needsUpdate = true;
  }

  clear() {
    if (!this.ctx || !this.canvas) throw new Error('Cannot clear, missing ctx and/or canvas!!');

    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0;
    const last = this.trail[this.trail.length - 1];
    if (last) {
      const dx = last.x - point.x;
      const dy = last.y - point.y;
      const dd = dx * dx + dy * dy;
      force = Math.min(dd * 10000, 1);
    }
    this.trail.push({ x: point.x, y: point.y, age: 0, force });
  }

  drawTouch(point: Point) {
    if (!this.ctx) throw new Error('Ctx is not defined!');

    const pos = {
      x: point.x * this.size,
      y: (1 - point.y) * this.size,
    };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = (point.age / (this.maxAge * 0.3), 0, 1, 1);
    } else {
      intensity = easeOutSine(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7)) + 1;
    }

    intensity *= point.force;

    const radius = this.size * this.radius * intensity;
    const grd = this.ctx.createRadialGradient(pos.x, pos.y, radius * 0.25, pos.x, pos.y, radius);
    grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
    grd.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    this.ctx.beginPath();
    this.ctx.fillStyle = grd;
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}