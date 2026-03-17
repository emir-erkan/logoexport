/**
 * SVG Group Detection & Selective Recoloring
 * 
 * Detects named groups in SVGs exported from Illustrator,
 * and determines which groups are recolorable (single-color)
 * vs. preserved (multi-color).
 */

export interface SvgGroup {
  id: string;
  uniqueColors: string[];
  isRecolorable: boolean;
}

/**
 * Parse an SVG string and detect top-level <g> elements with IDs.
 * For each group, count unique fill/stroke colors.
 */
export function detectSvgGroups(svgString: string): SvgGroup[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return [];

  const groups: SvgGroup[] = [];
  
  // Look for top-level <g> elements with IDs
  const topGroups = svgEl.querySelectorAll(":scope > g[id]");
  
  // If no named groups at top level, check one level deeper
  const gElements = topGroups.length > 0 
    ? topGroups 
    : svgEl.querySelectorAll("g[id]");

  gElements.forEach((g) => {
    const id = g.getAttribute("id");
    if (!id) return;
    // Skip Illustrator metadata groups
    if (id.startsWith("_x") || id === "Layer_1" || id === "Layer_2") return;

    const colors = extractColorsFromElement(g);
    groups.push({
      id,
      uniqueColors: colors,
      isRecolorable: colors.length <= 1,
    });
  });

  return groups;
}

/**
 * Extract unique fill/stroke colors from an SVG element and its children.
 */
function extractColorsFromElement(element: Element): string[] {
  const colors = new Set<string>();
  
  const processElement = (el: Element) => {
    // Check for <style> blocks within the element
    if (el.tagName.toLowerCase() === "style" && el.textContent) {
      const cssColors = el.textContent.match(/(?:fill|stroke):\s*([^;}"]+)/gi) || [];
      cssColors.forEach((match) => {
        const val = match.replace(/^(?:fill|stroke):\s*/i, "").trim();
        if (val !== "none" && val !== "transparent" && !val.startsWith("url(")) {
          colors.add(normalizeColor(val));
        }
      });
      return;
    }

    // Check attributes
    const fill = el.getAttribute("fill");
    if (fill && fill !== "none" && fill !== "transparent" && !fill.startsWith("url(")) {
      colors.add(normalizeColor(fill));
    }
    
    const stroke = el.getAttribute("stroke");
    if (stroke && stroke !== "none" && stroke !== "transparent" && !stroke.startsWith("url(")) {
      colors.add(normalizeColor(stroke));
    }

    // Check inline style
    const style = el.getAttribute("style") || "";
    const fillMatch = style.match(/fill:\s*([^;}"]+)/i);
    if (fillMatch) {
      const val = fillMatch[1].trim();
      if (val !== "none" && val !== "transparent" && !val.startsWith("url(")) {
        colors.add(normalizeColor(val));
      }
    }
    const strokeMatch = style.match(/stroke:\s*([^;}"]+)/i);
    if (strokeMatch) {
      const val = strokeMatch[1].trim();
      if (val !== "none" && val !== "transparent" && !val.startsWith("url(")) {
        colors.add(normalizeColor(val));
      }
    }

    // Check class-based colors by looking at computed style won't work in DOMParser
    // So also check for class attribute - colors may come from SVG-level <style>
    
    // Recurse children
    for (const child of Array.from(el.children)) {
      processElement(child);
    }
  };

  processElement(element);
  
  // Also extract colors from the SVG root <style> that apply to classes used in this element
  const root = element.ownerDocument?.querySelector("svg");
  if (root) {
    const styleEl = root.querySelector("style");
    if (styleEl?.textContent) {
      // Find all classes used in this element's subtree
      const usedClasses = new Set<string>();
      const collectClasses = (el: Element) => {
        const cls = el.getAttribute("class");
        if (cls) cls.split(/\s+/).forEach(c => usedClasses.add(c));
        for (const child of Array.from(el.children)) collectClasses(child);
      };
      collectClasses(element);
      
      // Parse CSS rules for those classes
      const css = styleEl.textContent;
      usedClasses.forEach(cls => {
        const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const ruleMatch = css.match(new RegExp(`\\.${escaped}\\s*\\{([^}]+)\\}`, 'i'));
        if (ruleMatch) {
          const declarations = ruleMatch[1];
          const fillM = declarations.match(/fill:\s*([^;}"]+)/i);
          if (fillM) {
            const val = fillM[1].trim();
            if (val !== "none" && val !== "transparent" && !val.startsWith("url(")) {
              colors.add(normalizeColor(val));
            }
          }
          const strokeM = declarations.match(/stroke:\s*([^;}"]+)/i);
          if (strokeM) {
            const val = strokeM[1].trim();
            if (val !== "none" && val !== "transparent" && !val.startsWith("url(")) {
              colors.add(normalizeColor(val));
            }
          }
        }
      });
    }
  }

  return Array.from(colors);
}

function normalizeColor(color: string): string {
  return color.trim().toUpperCase();
}

/**
 * Selectively recolor an SVG — only recolor elements within groups
 * that have a single color (recolorable groups). Preserve multi-color groups.
 * If no named groups are detected, falls back to full recolor.
 */
export function selectiveRecolorSvg(
  svgString: string, 
  newColor: string, 
  uniquePrefix?: string,
  groups?: SvgGroup[]
): string {
  const detectedGroups = groups || detectSvgGroups(svgString);
  
  // No named groups → fall back to full recolor
  if (detectedGroups.length === 0) {
    // Import dynamically avoided; inline the logic
    return fullRecolor(svgString, newColor, uniquePrefix);
  }

  const recolorableIds = new Set(
    detectedGroups.filter((g) => g.isRecolorable).map((g) => g.id)
  );

  // If all groups are recolorable or none are, fall back to full recolor
  if (recolorableIds.size === 0 || recolorableIds.size === detectedGroups.length) {
    return fullRecolor(svgString, newColor, uniquePrefix);
  }

  // For groups using class-based styling from <style> blocks,
  // we need to also recolor via the SVG root <style>
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return svgString;

  // Collect classes used in recolorable groups
  const recolorableClasses = new Set<string>();
  const preservedClasses = new Set<string>();
  
  const collectClasses = (el: Element, target: Set<string>) => {
    const cls = el.getAttribute("class");
    if (cls) cls.split(/\s+/).forEach(c => target.add(c));
    for (const child of Array.from(el.children)) collectClasses(child, target);
  };

  recolorableIds.forEach((groupId) => {
    const group = svgEl.querySelector(`#${CSS.escape(groupId)}`);
    if (group) collectClasses(group, recolorableClasses);
  });
  
  detectedGroups.filter(g => !g.isRecolorable).forEach((g) => {
    const group = svgEl.querySelector(`#${CSS.escape(g.id)}`);
    if (group) collectClasses(group, preservedClasses);
  });

  // Remove classes that are shared with preserved groups
  preservedClasses.forEach(c => recolorableClasses.delete(c));

  // Recolor inline attributes in recolorable groups
  recolorableIds.forEach((groupId) => {
    const group = svgEl.querySelector(`#${CSS.escape(groupId)}`);
    if (!group) return;
    recolorElement(group, newColor);
  });

  // Recolor CSS rules for classes only used in recolorable groups
  const styleEl = svgEl.querySelector("style");
  if (styleEl?.textContent && recolorableClasses.size > 0) {
    let css = styleEl.textContent;
    recolorableClasses.forEach(cls => {
      const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      css = css.replace(
        new RegExp(`(\\.${escaped}\\s*\\{[^}]*?)fill:\\s*(?!none|transparent)[^;}"]+`, 'gi'),
        `$1fill: ${newColor}`
      );
      css = css.replace(
        new RegExp(`(\\.${escaped}\\s*\\{[^}]*?)stroke:\\s*(?!none|transparent)[^;}"]+`, 'gi'),
        `$1stroke: ${newColor}`
      );
    });
    styleEl.textContent = css;
  }

  let result = new XMLSerializer().serializeToString(svgEl);

  // Deduplicate IDs
  if (uniquePrefix) {
    result = deduplicateIds(result, uniquePrefix);
  }

  return result;
}

function recolorElement(element: Element, newColor: string) {
  const fill = element.getAttribute("fill");
  if (fill && fill !== "none" && fill !== "transparent" && !fill.startsWith("url(")) {
    element.setAttribute("fill", newColor);
  }
  
  const stroke = element.getAttribute("stroke");
  if (stroke && stroke !== "none" && stroke !== "transparent" && !stroke.startsWith("url(")) {
    element.setAttribute("stroke", newColor);
  }

  // Handle inline styles
  const style = element.getAttribute("style");
  if (style) {
    let newStyle = style.replace(
      /fill:\s*(?!none|transparent)[^;}"]+/gi,
      `fill: ${newColor}`
    );
    newStyle = newStyle.replace(
      /stroke:\s*(?!none|transparent)[^;}"]+/gi,
      `stroke: ${newColor}`
    );
    element.setAttribute("style", newStyle);
  }

  for (const child of Array.from(element.children)) {
    recolorElement(child, newColor);
  }
}

function fullRecolor(svgString: string, newColor: string, uniquePrefix?: string): string {
  let result = svgString.replace(
    /fill="(?!none|transparent)([^"]*)"/gi,
    `fill="${newColor}"`
  );
  result = result.replace(
    /stroke="(?!none|transparent)([^"]*)"/gi,
    `stroke="${newColor}"`
  );
  // Inline styles
  result = result.replace(
    /fill:\s*(?!none|transparent)[^;}"]+/gi,
    `fill: ${newColor}`
  );
  result = result.replace(
    /stroke:\s*(?!none|transparent)[^;}"]+/gi,
    `stroke: ${newColor}`
  );
  // CSS <style> blocks: replace color values in fill/stroke declarations
  result = result.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open, css, close) => {
      let newCss = css.replace(
        /fill:\s*(?!none|transparent)[^;}"]+/gi,
        `fill: ${newColor}`
      );
      newCss = newCss.replace(
        /stroke:\s*(?!none|transparent)[^;}"]+/gi,
        `stroke: ${newColor}`
      );
      return open + newCss + close;
    }
  );

  if (uniquePrefix) {
    result = deduplicateIds(result, uniquePrefix);
  }

  return result;
}

function deduplicateIds(svgString: string, uniquePrefix: string): string {
  let result = svgString;
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
  return result;
}
