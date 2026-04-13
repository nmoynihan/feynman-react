import type { Point } from "./types";

export const EPSILON = 1e-6;

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

export function length(point: Point): number {
  return Math.hypot(point.x, point.y);
}

export function distance(a: Point, b: Point): number {
  return length(subtract(a, b));
}

export function normalize(point: Point): Point {
  const value = length(point);

  if (value < EPSILON) {
    return { x: 0, y: 0 };
  }

  return scale(point, 1 / value);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

export function leftNormal(point: Point): Point {
  return normalize({ x: point.y, y: -point.x });
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

export function toPath(points: Point[]): string {
  if (points.length === 0) {
    return "";
  }

  const first = points[0]!;
  const rest = points.slice(1);
  return [
    `M ${formatNumber(first.x)} ${formatNumber(first.y)}`,
    ...rest.map((point) => `L ${formatNumber(point.x)} ${formatNumber(point.y)}`)
  ].join(" ");
}

export function toSmoothPath(points: Point[]): string {
  if (points.length < 3) {
    return toPath(points);
  }

  const [first] = points;

  if (!first) {
    return "";
  }

  const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(index - 1, 0)]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const afterNext = points[Math.min(index + 2, points.length - 1)]!;
    const control1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6
    };
    const control2 = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6
    };

    commands.push(
      `C ${formatNumber(control1.x)} ${formatNumber(control1.y)} ${formatNumber(control2.x)} ${formatNumber(control2.y)} ${formatNumber(next.x)} ${formatNumber(next.y)}`
    );
  }

  return commands.join(" ");
}