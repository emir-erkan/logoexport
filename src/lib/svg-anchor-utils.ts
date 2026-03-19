/**
 * Utilities for extracting anchor points from SVG path data
 */

export interface AnchorPoint {
  x: number;
  y: number;
  type: "corner" | "curve" | "edge" | "endpoint";
}

/** Parse a single SVG path `d` attribute into anchor points */
export function extractPathAnchors(d: string): AnchorPoint[] {
  const points: AnchorPoint[] = [];
  // Regex to match path commands
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!commands) return points;

  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).trim().match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)?.map(Number) || [];
    const isRelative = type === type.toLowerCase();

    switch (type.toUpperCase()) {
      case "M": {
        for (let i = 0; i < nums.length; i += 2) {
          cx = isRelative ? cx + nums[i] : nums[i];
          cy = isRelative ? cy + nums[i + 1] : nums[i + 1];
          if (i === 0) { startX = cx; startY = cy; }
          points.push({ x: cx, y: cy, type: "endpoint" });
        }
        break;
      }
      case "L": {
        for (let i = 0; i < nums.length; i += 2) {
          cx = isRelative ? cx + nums[i] : nums[i];
          cy = isRelative ? cy + nums[i + 1] : nums[i + 1];
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "H": {
        for (const n of nums) {
          cx = isRelative ? cx + n : n;
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "V": {
        for (const n of nums) {
          cy = isRelative ? cy + n : n;
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "C": {
        for (let i = 0; i < nums.length; i += 6) {
          // Control point 1
          const cp1x = isRelative ? cx + nums[i] : nums[i];
          const cp1y = isRelative ? cy + nums[i + 1] : nums[i + 1];
          // Control point 2
          const cp2x = isRelative ? cx + nums[i + 2] : nums[i + 2];
          const cp2y = isRelative ? cy + nums[i + 3] : nums[i + 3];
          // End point
          cx = isRelative ? cx + nums[i + 4] : nums[i + 4];
          cy = isRelative ? cy + nums[i + 5] : nums[i + 5];
          points.push({ x: cp1x, y: cp1y, type: "curve" });
          points.push({ x: cp2x, y: cp2y, type: "curve" });
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "S": {
        for (let i = 0; i < nums.length; i += 4) {
          const cpx = isRelative ? cx + nums[i] : nums[i];
          const cpy = isRelative ? cy + nums[i + 1] : nums[i + 1];
          cx = isRelative ? cx + nums[i + 2] : nums[i + 2];
          cy = isRelative ? cy + nums[i + 3] : nums[i + 3];
          points.push({ x: cpx, y: cpy, type: "curve" });
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "Q": {
        for (let i = 0; i < nums.length; i += 4) {
          const cpx = isRelative ? cx + nums[i] : nums[i];
          const cpy = isRelative ? cy + nums[i + 1] : nums[i + 1];
          cx = isRelative ? cx + nums[i + 2] : nums[i + 2];
          cy = isRelative ? cy + nums[i + 3] : nums[i + 3];
          points.push({ x: cpx, y: cpy, type: "curve" });
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "T": {
        for (let i = 0; i < nums.length; i += 2) {
          cx = isRelative ? cx + nums[i] : nums[i];
          cy = isRelative ? cy + nums[i + 1] : nums[i + 1];
          points.push({ x: cx, y: cy, type: "corner" });
        }
        break;
      }
      case "A": {
        for (let i = 0; i < nums.length; i += 7) {
          cx = isRelative ? cx + nums[i + 5] : nums[i + 5];
          cy = isRelative ? cy + nums[i + 6] : nums[i + 6];
          points.push({ x: cx, y: cy, type: "curve" });
        }
        break;
      }
      case "Z": {
        cx = startX;
        cy = startY;
        break;
      }
    }
  }

  return points;
}

/** Extract all anchor points from an SVG element tree */
export function extractAllAnchors(svgElement: SVGSVGElement): AnchorPoint[] {
  const allPoints: AnchorPoint[] = [];
  const paths = svgElement.querySelectorAll("path");
  paths.forEach((path) => {
    const d = path.getAttribute("d");
    if (d) allPoints.push(...extractPathAnchors(d));
  });

  // Also extract center points of shapes
  const circles = svgElement.querySelectorAll("circle");
  circles.forEach((c) => {
    allPoints.push({
      x: parseFloat(c.getAttribute("cx") || "0"),
      y: parseFloat(c.getAttribute("cy") || "0"),
      type: "corner",
    });
  });

  const ellipses = svgElement.querySelectorAll("ellipse");
  ellipses.forEach((e) => {
    allPoints.push({
      x: parseFloat(e.getAttribute("cx") || "0"),
      y: parseFloat(e.getAttribute("cy") || "0"),
      type: "curve",
    });
  });

  const rects = svgElement.querySelectorAll("rect");
  rects.forEach((r) => {
    const x = parseFloat(r.getAttribute("x") || "0");
    const y = parseFloat(r.getAttribute("y") || "0");
    const w = parseFloat(r.getAttribute("width") || "0");
    const h = parseFloat(r.getAttribute("height") || "0");
    allPoints.push({ x, y, type: "corner" });
    allPoints.push({ x: x + w, y, type: "corner" });
    allPoints.push({ x: x + w, y: y + h, type: "corner" });
    allPoints.push({ x, y: y + h, type: "corner" });
  });

  return allPoints;
}

/** Deduplicate points within a tolerance */
export function deduplicatePoints(points: AnchorPoint[], tolerance = 0.5): AnchorPoint[] {
  const result: AnchorPoint[] = [];
  for (const p of points) {
    const exists = result.some(
      (r) => Math.abs(r.x - p.x) < tolerance && Math.abs(r.y - p.y) < tolerance
    );
    if (!exists) result.push(p);
  }
  return result;
}

/** Filter points to only the most significant ones (edge/boundary anchors) */
export function filterEdgeAnchors(
  points: AnchorPoint[],
  vbX: number, vbY: number, vbW: number, vbH: number,
  margin = 0.15
): AnchorPoint[] {
  const xMin = vbX + vbW * margin;
  const xMax = vbX + vbW * (1 - margin);
  const yMin = vbY + vbH * margin;
  const yMax = vbY + vbH * (1 - margin);
  return points.filter(
    (p) => p.x <= xMin || p.x >= xMax || p.y <= yMin || p.y >= yMax
  );
}

/** Get a subset of evenly spaced points */
export function subsamplePoints(points: AnchorPoint[], maxCount: number): AnchorPoint[] {
  if (points.length <= maxCount) return points;
  const step = points.length / maxCount;
  const result: AnchorPoint[] = [];
  for (let i = 0; i < maxCount; i++) {
    result.push(points[Math.floor(i * step)]);
  }
  return result;
}

/** Extract bounding boxes of top-level SVG groups/shapes for construction lines */
export interface ElementBBox {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function extractElementBBoxes(svgElement: SVGSVGElement): ElementBBox[] {
  const boxes: ElementBBox[] = [];
  const topChildren = svgElement.children;

  for (let i = 0; i < topChildren.length; i++) {
    const child = topChildren[i] as SVGGraphicsElement;
    if (!child.getBBox) continue;
    try {
      const bbox = child.getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        const tag = child.tagName.toLowerCase();
        const id = child.getAttribute("id") || `${tag}-${i}`;
        boxes.push({
          label: id,
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        });
      }
    } catch {
      // skip elements that can't compute bbox
    }
  }

  return boxes;
}
