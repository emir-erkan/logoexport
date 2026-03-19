import type { ElementBBox } from "@/lib/svg-anchor-utils";

interface Props {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  multiplier: number;
  showDimensions: boolean;
  safeSpaceColor: string;
  referenceElement: ElementBBox | null;
}

export default function SafeSpaceOverlay({
  vbX, vbY, vbW, vbH, multiplier, showDimensions, safeSpaceColor, referenceElement,
}: Props) {
  // Use the reference element's smallest dimension as the unit, fallback to 15% of viewBox
  const unitSize = referenceElement
    ? Math.min(referenceElement.width, referenceElement.height)
    : Math.min(vbW, vbH) * 0.15;

  const space = unitSize * multiplier;

  // Extended viewBox
  const evbX = vbX - space;
  const evbY = vbY - space;
  const evbW = vbW + space * 2;
  const evbH = vbH + space * 2;
  const sw = vbW * 0.002;
  const fontSz = vbW * 0.022;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`${evbX} ${evbY} ${evbW} ${evbH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Outer safe space boundary */}
      <rect
        x={evbX} y={evbY} width={evbW} height={evbH}
        fill="none" stroke={safeSpaceColor} strokeWidth={sw}
        strokeDasharray={`${vbW * 0.008} ${vbW * 0.004}`}
        opacity={0.7}
      />

      {/* Inner logo boundary */}
      <rect
        x={vbX} y={vbY} width={vbW} height={vbH}
        fill="none" stroke={safeSpaceColor} strokeWidth={sw * 0.6}
        opacity={0.4}
      />

      {/* Corner boxes — sized to the actual reference element × multiplier */}
      {[
        { x: evbX, y: evbY },
        { x: evbX + evbW - space, y: evbY },
        { x: evbX, y: evbY + evbH - space },
        { x: evbX + evbW - space, y: evbY + evbH - space },
      ].map((pos, i) => (
        <g key={`unit-${i}`}>
          <rect
            x={pos.x} y={pos.y}
            width={space} height={space}
            fill={safeSpaceColor}
            opacity={0.08}
            stroke={safeSpaceColor}
            strokeWidth={sw * 0.5}
            strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
          />
          {showDimensions && (
            <text
              x={pos.x + space / 2}
              y={pos.y + space / 2 + fontSz * 0.35}
              fill={safeSpaceColor}
              fontSize={fontSz}
              fontFamily="DM Sans, system-ui, sans-serif"
              fontWeight="500"
              textAnchor="middle"
              opacity={0.7}
            >
              {multiplier}x
            </text>
          )}
        </g>
      ))}

      {/* Edge fill strips between corner boxes */}
      {/* Top */}
      <rect
        x={evbX + space} y={evbY}
        width={evbW - space * 2} height={space}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
      {/* Bottom */}
      <rect
        x={evbX + space} y={vbY + vbH}
        width={evbW - space * 2} height={space}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
      {/* Left */}
      <rect
        x={evbX} y={evbY + space}
        width={space} height={evbH - space * 2}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
      {/* Right */}
      <rect
        x={vbX + vbW} y={evbY + space}
        width={space} height={evbH - space * 2}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />

      {/* Optional: show the reference element outline in the center for context */}
      {referenceElement && (
        <rect
          x={referenceElement.x} y={referenceElement.y}
          width={referenceElement.width} height={referenceElement.height}
          fill="none" stroke={safeSpaceColor}
          strokeWidth={sw * 1.5}
          strokeDasharray={`${vbW * 0.004} ${vbW * 0.002}`}
          opacity={0.5}
        />
      )}
    </svg>
  );
}
