import React from "react";
import type { AnchorPoint } from "@/lib/svg-anchor-utils";
import type { AnchorShape, AnchorFilter } from "./OutlineSettings";
import { deduplicatePoints, filterEdgeAnchors, subsamplePoints } from "@/lib/svg-anchor-utils";

interface Props {
  anchors: AnchorPoint[];
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  anchorShape: AnchorShape;
  anchorSize: number;
  anchorFilter: AnchorFilter;
  maxAnchors: number;
  strokeColor: string;
}

export default function AnchorOverlay({
  anchors, vbX, vbY, vbW, vbH,
  anchorShape, anchorSize, anchorFilter, maxAnchors, strokeColor,
}: Props) {
  let filtered = deduplicatePoints(anchors, vbW * 0.005);

  // Apply filter
  switch (anchorFilter) {
    case "corners":
      filtered = filtered.filter(p => p.type === "corner" || p.type === "endpoint");
      break;
    case "edges":
      filtered = filterEdgeAnchors(filtered, vbX, vbY, vbW, vbH, 0.1);
      break;
    case "curves":
      filtered = filtered.filter(p => p.type === "curve");
      break;
    // "all" shows everything
  }

  // Subsample to max count
  filtered = subsamplePoints(filtered, maxAnchors);

  const s = vbW * anchorSize * 0.003; // scale size relative to viewBox

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
            <React.Fragment key={key}>
              <circle cx={p.x} cy={p.y} r={s} fill={fill} stroke={stroke} strokeWidth={sw} opacity={0.9} />
            </React.Fragment>
          );
        }
        if (anchorShape === "square") {
          return (
            <rect key={key} x={p.x - s} y={p.y - s} width={s * 2} height={s * 2} fill={fill} stroke={stroke} strokeWidth={sw} opacity={0.9} />
          );
        }
        // diamond
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
