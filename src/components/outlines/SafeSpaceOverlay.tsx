interface Props {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  multiplier: number;
  showDimensions: boolean;
  safeSpaceColor: string;
}

export default function SafeSpaceOverlay({
  vbX, vbY, vbW, vbH, multiplier, showDimensions, safeSpaceColor,
}: Props) {
  const unitSize = Math.min(vbW, vbH) * 0.15;
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

      {/* Element unit boxes at corners — OUTSIDE the logo, in the safe space margin */}
      {[
        // Top-left corner
        { x: evbX, y: evbY },
        // Top-right corner
        { x: evbX + evbW - unitSize * multiplier, y: evbY },
        // Bottom-left corner
        { x: evbX, y: evbY + evbH - unitSize * multiplier },
        // Bottom-right corner
        { x: evbX + evbW - unitSize * multiplier, y: evbY + evbH - unitSize * multiplier },
      ].map((pos, i) => (
        <g key={`unit-${i}`}>
          <rect
            x={pos.x} y={pos.y}
            width={unitSize * multiplier}
            height={unitSize * multiplier}
            fill={safeSpaceColor}
            opacity={0.08}
            stroke={safeSpaceColor}
            strokeWidth={sw * 0.5}
            strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
          />
          {/* Dimension label INSIDE each box */}
          {showDimensions && (
            <text
              x={pos.x + (unitSize * multiplier) / 2}
              y={pos.y + (unitSize * multiplier) / 2 + fontSz * 0.35}
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

      {/* Thin edge boxes on the sides (between corner boxes) */}
      {/* Top edge */}
      <rect
        x={evbX + unitSize * multiplier} y={evbY}
        width={evbW - unitSize * multiplier * 2} height={space}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
      {/* Bottom edge */}
      <rect
        x={evbX + unitSize * multiplier} y={vbY + vbH}
        width={evbW - unitSize * multiplier * 2} height={space}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
      {/* Left edge */}
      <rect
        x={evbX} y={evbY + unitSize * multiplier}
        width={space} height={evbH - unitSize * multiplier * 2}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
      {/* Right edge */}
      <rect
        x={vbX + vbW} y={evbY + unitSize * multiplier}
        width={space} height={evbH - unitSize * multiplier * 2}
        fill={safeSpaceColor} opacity={0.04}
        stroke={safeSpaceColor} strokeWidth={sw * 0.3}
        strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
      />
    </svg>
  );
}
