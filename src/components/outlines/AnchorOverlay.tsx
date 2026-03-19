import React from "react";
import type { AnchorPoint } from "@/lib/svg-anchor-utils";
import type { AnchorShape, AnchorFilterType } from "./OutlineSettings";
import { deduplicatePoints, filterEdgeAnchors, subsamplePoints } from "@/lib/svg-anchor-utils";

interface Props {
  anchors: AnchorPoint[];
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  anchorShape: AnchorShape;
  anchorSize: number;
  anchorFilters: AnchorFilterType[];
  maxAnchors: number;
  strokeColor: string;
}

export default function AnchorOverlay({
  anchors, vbX, vbY, vbW, vbH,
  anchorShape, anchorSize, anchorFilters, maxAnchors, strokeColor,
}: Props) {
  let filtered = deduplicatePoints(anchors, vbW * 0.005);

  // Apply multi-select filters
  const hasCorners = anchorFilters.includes("corners");
  const hasEdges = anchorFilters.includes("edges");
  const hasCurves = anchorFilters.includes("curves");
  const showAll = hasCorners && hasEdges && hasCurves;

  if (!showAll) {
    let result: AnchorPoint[] = [];
    if (hasCorners) {
      result = result.concat(filtered.filter(p => p.type === "corner" || p.type === "endpoint"));
    }
    if (hasCurves) {
      result = result.concat(filtered.filter(p => p.type === "curve"));
    }
    if (hasEdges) {
      const edgePoints = filterEdgeAnchors(filtered, vbX, vbY, vbW, vbH, 0.1);
      result = result.concat(edgePoints);
    }
    // Deduplicate again after merging
    filtered = deduplicatePoints(result, vbW * 0.005);
  }

  // Subsample to max count
  filtered = subsamplePoints(filtered, maxAnchors);

  const s = vbW * anchorSize * 0.003;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {filtered.map((p, i) => {
        const key = `a-${i}`;
        const fill = strokeColor;
        const stroke = "white";
        const sw = s * 0.3;

        if (anchorShape === "circle") {
          return (
            <circle key={key} cx={p.x} cy={p.y} r={s} fill={fill} stroke={stroke} strokeWidth={sw} opacity={0.9} />
          );
        }
        if (anchorShape === "square") {
          return (
            <rect key={key} x={p.x - s} y={p.y - s} width={s * 2} height={s * 2} fill={fill} stroke={stroke} strokeWidth={sw} opacity={0.9} />
          );
        }
        return (
          <polygon
            key={key}
            points={`${p.x},${p.y - s * 1.3} ${p.x + s * 1.3},${p.y} ${p.x},${p.y + s * 1.3} ${p.x - s * 1.3},${p.y}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
}
