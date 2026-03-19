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
  // Use the smaller dimension as the "element unit" (like the icon crest)
  const unitSize = Math.min(vbW, vbH) * 0.15; // ~15% of smallest side = "1x" element
  const space = unitSize * multiplier;

  // Extended viewBox to show the safe space
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

      {/* Element unit boxes at corners — showing the measurement element */}
      {[
        // Top-left
        { x: vbX - space, y: vbY - space },
        // Top-right
        { x: vbX + vbW + space - unitSize * multiplier, y: vbY - space },
        // Bottom-left
        { x: vbX - space, y: vbY + vbH + space - unitSize * multiplier },
        // Bottom-right
        { x: vbX + vbW + space - unitSize * multiplier, y: vbY + vbH + space - unitSize * multiplier },
      ].map((pos, i) => (
        <rect
          key={`unit-${i}`}
          x={pos.x} y={pos.y}
          width={unitSize * multiplier}
          height={unitSize * multiplier}
          fill={safeSpaceColor}
          opacity={0.08}
          stroke={safeSpaceColor}
          strokeWidth={sw * 0.5}
          strokeDasharray={`${vbW * 0.005} ${vbW * 0.003}`}
        />
      ))}

      {/* Dimension lines — top */}
      <line
        x1={vbX + vbW / 2} y1={vbY - space}
        x2={vbX + vbW / 2} y2={vbY}
        stroke={safeSpaceColor} strokeWidth={sw}
        markerEnd="url(#arrowEnd)" markerStart="url(#arrowStart)"
      />
      {/* Bottom */}
      <line
        x1={vbX + vbW / 2} y1={vbY + vbH}
        x2={vbX + vbW / 2} y2={vbY + vbH + space}
        stroke={safeSpaceColor} strokeWidth={sw}
      />
      {/* Left */}
      <line
        x1={vbX - space} y1={vbY + vbH / 2}
        x2={vbX} y2={vbY + vbH / 2}
        stroke={safeSpaceColor} strokeWidth={sw}
      />
      {/* Right */}
      <line
        x1={vbX + vbW} y1={vbY + vbH / 2}
        x2={vbX + vbW + space} y2={vbY + vbH / 2}
        stroke={safeSpaceColor} strokeWidth={sw}
      />

      {/* Small ticks at line ends */}
      {/* Top ticks */}
      <line x1={vbX + vbW / 2 - fontSz * 0.5} y1={vbY - space} x2={vbX + vbW / 2 + fontSz * 0.5} y2={vbY - space} stroke={safeSpaceColor} strokeWidth={sw} />
      <line x1={vbX + vbW / 2 - fontSz * 0.5} y1={vbY} x2={vbX + vbW / 2 + fontSz * 0.5} y2={vbY} stroke={safeSpaceColor} strokeWidth={sw} />

      {showDimensions && (
        <>
          {/* Top label */}
          <text
            x={vbX + vbW / 2 + fontSz * 0.6}
            y={vbY - space / 2 + fontSz * 0.35}
            fill={safeSpaceColor}
            fontSize={fontSz}
            fontFamily="DM Sans, system-ui, sans-serif"
            fontWeight="500"
          >
            {multiplier}x
          </text>
          {/* Left label */}
          <text
            x={vbX - space / 2 - fontSz * 0.8}
            y={vbY + vbH / 2 + fontSz * 0.35}
            fill={safeSpaceColor}
            fontSize={fontSz}
            fontFamily="DM Sans, system-ui, sans-serif"
            fontWeight="500"
            textAnchor="middle"
          >
            {multiplier}x
          </text>
        </>
      )}
    </svg>
  );
}
