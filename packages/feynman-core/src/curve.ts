import type { CurveType, Point } from "./types";
import { EPSILON, add, clamp, distance, leftNormal, lerp, normalize, scale, subtract, toPath } from "./vector";

export interface CurveSampler {
  kind: CurveType;
  start: Point;
  end: Point;
  lengthEstimate: number;
  pointAt: (t: number) => Point;
  tangentAt: (t: number) => Point;
  normalAt: (t: number) => Point;
  sample: (segments: number, tStart?: number, tEnd?: number) => Point[];
}

function quadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y
  };
}

function quadraticTangent(start: Point, control: Point, end: Point, t: number): Point {
  return normalize({
    x: 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
    y: 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y)
  });
}

function buildArcSampler(start: Point, end: Point, bend: number): CurveSampler {
  const chord = subtract(end, start);
  const chordLength = distance(start, end);

  if (Math.abs(bend) < EPSILON || chordLength < EPSILON) {
    return buildCurveSampler(start, end, "line", 0);
  }

  const sagitta = bend;
  const radius = (chordLength * chordLength) / (8 * Math.abs(sagitta)) + Math.abs(sagitta) / 2;
  const midpoint = lerp(start, end, 0.5);
  const chordNormal = leftNormal(chord);
  const centerOffset = radius - Math.abs(sagitta);
  const center = add(midpoint, scale(chordNormal, sagitta > 0 ? -centerOffset : centerOffset));
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngleRaw = Math.atan2(end.y - center.y, end.x - center.x);
  let delta = endAngleRaw - startAngle;

  while (delta <= -Math.PI) {
    delta += Math.PI * 2;
  }

  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }

  if (sagitta > 0 && delta < 0) {
    delta += Math.PI * 2;
  }

  if (sagitta < 0 && delta > 0) {
    delta -= Math.PI * 2;
  }

  const pointAt = (t: number): Point => {
    const angle = startAngle + delta * clamp(t, 0, 1);
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  };

  const tangentAt = (t: number): Point => {
    const angle = startAngle + delta * clamp(t, 0, 1);
    return normalize({
      x: -Math.sin(angle) * delta,
      y: Math.cos(angle) * delta
    });
  };

  return {
    kind: "arc",
    start,
    end,
    lengthEstimate: Math.abs(delta) * radius,
    pointAt,
    tangentAt,
    normalAt: (t) => leftNormal(tangentAt(t)),
    sample: (segments, tStart = 0, tEnd = 1) => {
      const count = Math.max(segments, 2);
      return Array.from({ length: count + 1 }, (_, index) => {
        const t = tStart + (tEnd - tStart) * (index / count);
        return pointAt(t);
      });
    }
  };
}

export function buildCurveSampler(start: Point, end: Point, curve: CurveType, bend: number): CurveSampler {
  const lineVector = subtract(end, start);
  const lineLength = distance(start, end);
  const midpoint = lerp(start, end, 0.5);
  const chordNormal = leftNormal(lineVector);
  const control = add(midpoint, scale(chordNormal, bend));

  if (curve === "arc") {
    return buildArcSampler(start, end, bend);
  }

  if (curve === "quadratic") {
    const pointAt = (t: number): Point => quadraticPoint(start, control, end, clamp(t, 0, 1));
    const tangentAt = (t: number): Point => quadraticTangent(start, control, end, clamp(t, 0, 1));

    return {
      kind: "quadratic",
      start,
      end,
      lengthEstimate: lineLength + Math.abs(bend) * 0.8,
      pointAt,
      tangentAt,
      normalAt: (t) => leftNormal(tangentAt(t)),
      sample: (segments, tStart = 0, tEnd = 1) => {
        const count = Math.max(segments, 2);
        return Array.from({ length: count + 1 }, (_, index) => {
          const t = tStart + (tEnd - tStart) * (index / count);
          return pointAt(t);
        });
      }
    };
  }

  const pointAt = (t: number): Point => lerp(start, end, clamp(t, 0, 1));
  const tangent = normalize(lineVector);

  return {
    kind: "line",
    start,
    end,
    lengthEstimate: lineLength,
    pointAt,
    tangentAt: () => tangent,
    normalAt: () => leftNormal(tangent),
    sample: (segments, tStart = 0, tEnd = 1) => {
      const count = Math.max(segments, 1);
      return Array.from({ length: count + 1 }, (_, index) => {
        const t = tStart + (tEnd - tStart) * (index / count);
        return pointAt(t);
      });
    }
  };
}

export function trimRange(lengthEstimate: number, startInset: number, endInset: number): { tStart: number; tEnd: number } {
  if (lengthEstimate < EPSILON) {
    return { tStart: 0, tEnd: 1 };
  }

  const tStart = clamp(startInset / lengthEstimate, 0, 0.35);
  const tEnd = clamp(1 - endInset / lengthEstimate, 0.65, 1);

  if (tEnd <= tStart) {
    return { tStart: 0, tEnd: 1 };
  }

  return { tStart, tEnd };
}

export function sampledPath(sampler: CurveSampler, segments: number, tStart = 0, tEnd = 1): string {
  return toPath(sampler.sample(segments, tStart, tEnd));
}