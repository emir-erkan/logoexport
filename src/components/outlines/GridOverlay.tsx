import React from "react";
import type { ElementBBox } from "@/lib/svg-anchor-utils";

interface Props {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  showGrid: boolean;
  gridDensity: number;
  showCenterLines: boolean;
  showConstructionLines: boolean;
  showBoundingBoxes: boolean;
  showDimensions: boolean;
  gridColor: string;
  dimensionColor: string;
  elementBBoxes: ElementBBox[];
}

export default function GridOverlay({
  vbX, vbY, vbW, vbH,
  showGrid, gridDensity,
  showCenterLines, showConstructionLines,
  showBoundingBoxes, showDimensions,
  gridColor, dimensionColor, elementBBoxes,
}: Props) {
  const lines: React.ReactNode[] = [];
  const sw = vbW * 0.001;
  const swDim = vbW * 0.0015;
  const fontSz = vbW * 0.018;

  // Base grid
  if (showGrid) {
    const stepX = vbW / gridDensity;
    const stepY = vbH / gridDensity;
    for (let i = 0; i <= gridDensity; i++) {
      lines.push(
        <line key={`gx-${i}`} x1={vbX + i * stepX} y1={vbY} x2={vbX + i * stepX} y2={vbY + vbH} stroke={gridColor} strokeWidth={sw} opacity={0.2} />,
        <line key={`gy-${i}`} x1={vbX} y1={vbY + i * stepY} x2={vbX + vbW} y2={vbY + i * stepY} stroke={gridColor} strokeWidth={sw} opacity={0.2} />
      );
    }
  }

  // Center lines
  if (showCenterLines) {
    lines.push(
      <line key="cx" x1={vbX + vbW / 2} y1={vbY} x2={vbX + vbW / 2} y2={vbY + vbH} stroke={dimensionColor} strokeWidth={swDim} strokeDasharray={`${vbW * 0.006} ${vbW * 0.003}`} opacity={0.6} />,
      <line key="cy" x1={vbX} y1={vbY + vbH / 2} x2={vbX + vbW} y2={vbY + vbH / 2} stroke={dimensionColor} strokeWidth={swDim} strokeDasharray={`${vbW * 0.006} ${vbW * 0.003}`} opacity={0.6} />
    );
  }

  // Bounding boxes around top-level elements
  if (showBoundingBoxes && elementBBoxes.length > 0) {
    elementBBoxes.forEach((box, i) => {
      lines.push(
        <rect
          key={`bbox-${i}`}
          x={box.x} y={box.y} width={box.width} height={box.height}
          fill="none" stroke={dimensionColor} strokeWidth={swDim}
          strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
          opacity={0.5}
        />
      );
    });
  }

  // Construction lines — extend horizontal & vertical lines from element edges
  if (showConstructionLines && elementBBoxes.length > 0) {
    const allEdges = new Set<string>();
    elementBBoxes.forEach((box) => {
      // Horizontal lines from top and bottom of each element
      const hLines = [box.y, box.y + box.height];
      // Vertical lines from left and right of each element
      const vLines = [box.x, box.x + box.width];

      hLines.forEach((y) => {
        const key = `h-${y.toFixed(2)}`;
        if (!allEdges.has(key)) {
          allEdges.add(key);
          lines.push(
            <line key={key} x1={vbX} y1={y} x2={vbX + vbW} y2={y}
              stroke={gridColor} strokeWidth={sw * 1.5} opacity={0.35}
              strokeDasharray={`${vbW * 0.004} ${vbW * 0.002}`}
            />
          );
        }
      });

      vLines.forEach((x) => {
        const key = `v-${x.toFixed(2)}`;
        if (!allEdges.has(key)) {
          allEdges.add(key);
          lines.push(
            <line key={key} x1={x} y1={vbY} x2={x} y2={vbY + vbH}
              stroke={gridColor} strokeWidth={sw * 1.5} opacity={0.35}
              strokeDasharray={`${vbW * 0.004} ${vbW * 0.002}`}
            />
          );
        }
      });
    });
  }

  // Dimension labels between elements
  if (showDimensions && elementBBoxes.length >= 2) {
    // Show spacing between consecutive bounding boxes (sorted by x)
    const sorted = [...elementBBoxes].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const gap = b.x - (a.x + a.width);
      if (gap > vbW * 0.01) {
        const midY = Math.max(a.y + a.height, b.y + b.height) + vbH * 0.04;
        const x1 = a.x + a.width;
        const x2 = b.x;
        // Arrow line
        lines.push(
          <line key={`dim-${i}`} x1={x1} y1={midY} x2={x2} y2={midY}
            stroke={dimensionColor} strokeWidth={swDim} opacity={0.7}
          />,
          // End ticks
          <line key={`dt1-${i}`} x1={x1} y1={midY - fontSz * 0.4} x2={x1} y2={midY + fontSz * 0.4}
            stroke={dimensionColor} strokeWidth={swDim} opacity={0.7}
          />,
          <line key={`dt2-${i}`} x1={x2} y1={midY - fontSz * 0.4} x2={x2} y2={midY + fontSz * 0.4}
            stroke={dimensionColor} strokeWidth={swDim} opacity={0.7}
          />,
          // Label
          <text key={`dl-${i}`} x={(x1 + x2) / 2} y={midY - fontSz * 0.4}
            fill={dimensionColor} fontSize={fontSz * 0.8}
            fontFamily="DM Sans, system-ui, sans-serif"
            fontWeight="500" textAnchor="middle" opacity={0.8}
          >
            {gap.toFixed(1)}
          </text>
        );
      }
    }

    // Show total width dimension at bottom
    const totalY = vbY + vbH + vbH * 0.06;
    lines.push(
      <line key="total-w" x1={vbX} y1={totalY} x2={vbX + vbW} y2={totalY}
        stroke={dimensionColor} strokeWidth={swDim} opacity={0.5}
      />,
      <line key="tw1" x1={vbX} y1={totalY - fontSz * 0.4} x2={vbX} y2={totalY + fontSz * 0.4}
        stroke={dimensionColor} strokeWidth={swDim} opacity={0.5}
      />,
      <line key="tw2" x1={vbX + vbW} y1={totalY - fontSz * 0.4} x2={vbX + vbW} y2={totalY + fontSz * 0.4}
        stroke={dimensionColor} strokeWidth={swDim} opacity={0.5}
      />,
      <text key="twl" x={vbX + vbW / 2} y={totalY + fontSz * 1.2}
        fill={dimensionColor} fontSize={fontSz * 0.8}
        fontFamily="DM Sans, system-ui, sans-serif"
        fontWeight="500" textAnchor="middle" opacity={0.6}
      >
        {vbW.toFixed(1)}
      </text>
    );
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`${vbX - vbW * 0.05} ${vbY - vbH * 0.05} ${vbW * 1.1} ${vbH * 1.15}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {lines}
    </svg>
  );
}
