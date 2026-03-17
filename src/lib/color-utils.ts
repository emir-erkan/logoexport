/**
 * Parse hex to RGB
 */
export function normalizeHex(hex: string): string {
  return hex.startsWith("#") ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

/**
 * Relative luminance (WCAG 2.0)
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Contrast ratio between two hex colors
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const n1 = normalizeHex(hex1);
  const n2 = normalizeHex(hex2);
  if (n1 === n2) return 1;
  const l1 = relativeLuminance(n1);
  const l2 = relativeLuminance(n2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG level from contrast ratio
 */
export function wcagLevel(ratio: number): "AAA" | "AA" | "Weak" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "Weak";
}

/**
 * Validate hex color
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Recolor SVG string: replace all fill/stroke colors with a new color
 */
export function recolorSvg(svgString: string, newColor: string, uniquePrefix?: string): string {
  // Replace fill and stroke attributes (but not "none" or "transparent")
  let result = svgString.replace(
    /fill="(?!none|transparent)([^"]*)"/gi,
    `fill="${newColor}"`
  );
  result = result.replace(
    /stroke="(?!none|transparent)([^"]*)"/gi,
    `stroke="${newColor}"`
  );
  // Also handle style attributes with fill/stroke
  result = result.replace(
    /fill:\s*(?!none|transparent)[^;}"]+/gi,
    `fill: ${newColor}`
  );
  result = result.replace(
    /stroke:\s*(?!none|transparent)[^;}"]+/gi,
    `stroke: ${newColor}`
  );

  // Deduplicate SVG internal IDs to prevent collisions when multiple SVGs are inline
  if (uniquePrefix) {
    // Replace id="xxx" definitions and all url(#xxx) / href="#xxx" / xlink:href="#xxx" references
    const idMap = new Map<string, string>();
    result = result.replace(/\bid="([^"]+)"/g, (_match, id) => {
      const newId = `${uniquePrefix}_${id}`;
      idMap.set(id, newId);
      return `id="${newId}"`;
    });
    for (const [oldId, newId] of idMap) {
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${newId})`);
      result = result.replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${newId}"`);
      result = result.replace(new RegExp(`xlink:href="#${escaped}"`, 'g'), `xlink:href="#${newId}"`);
    }
  }

  return result;
}
