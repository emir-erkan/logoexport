import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { recolorSvg } from "./color-utils";

export interface ExportOptions {
  format: "svg" | "png" | "jpg" | "pdf";
  transparent: boolean;
  size: number;
  logoColor: string;
  bgColor: string;
  svgContent: string; // SVG string or image URL for PNG
  fileName: string;
  fileType?: "svg" | "png";
}

function svgToDataUrl(svgString: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
}

function buildExportSvg(opts: ExportOptions): string {
  const recolored = recolorSvg(opts.svgContent, opts.logoColor);
  const parser = new DOMParser();
  const doc = parser.parseFromString(recolored, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return recolored;

  const viewBox = svgEl.getAttribute("viewBox") || "0 0 100 100";
  const [, , vbW, vbH] = viewBox.split(" ").map(Number);
  const aspectRatio = vbH / vbW;
  const width = opts.size;
  const height = Math.round(width * aspectRatio);

  if (opts.transparent) {
    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));
    return new XMLSerializer().serializeToString(svgEl);
  }

  const innerSvg = new XMLSerializer().serializeToString(svgEl);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${opts.bgColor}" />
    <svg x="0" y="0" width="${width}" height="${height}" viewBox="${viewBox}">${svgEl.innerHTML}</svg>
  </svg>`;
}

function renderToCanvas(svgString: string, width: number, height: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = svgToDataUrl(svgString);
  });
}

function renderImageToCanvas(imageUrl: string, width: number, height: number, bgColor: string, transparent: boolean): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      if (!transparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

function getDimensions(svgContent: string, size: number): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  const viewBox = svgEl?.getAttribute("viewBox") || "0 0 100 100";
  const [, , vbW, vbH] = viewBox.split(" ").map(Number);
  const aspectRatio = vbH / vbW;
  return { width: size, height: Math.round(size * aspectRatio) };
}

/**
 * Build a DOM SVG element for vector PDF export via svg2pdf.js
 */
function buildSvgElement(opts: ExportOptions, width: number, height: number): SVGSVGElement {
  const recolored = recolorSvg(opts.svgContent, opts.logoColor);
  const parser = new DOMParser();
  const doc = parser.parseFromString(recolored, "image/svg+xml");
  const svgEl = doc.querySelector("svg")!;

  const viewBox = svgEl.getAttribute("viewBox") || "0 0 100 100";

  // Create wrapper SVG at export dimensions
  const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrapper.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  wrapper.setAttribute("width", String(width));
  wrapper.setAttribute("height", String(height));
  wrapper.setAttribute("viewBox", `0 0 ${width} ${height}`);

  if (!opts.transparent) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", opts.bgColor);
    wrapper.appendChild(rect);
  }

  // Nest the original SVG
  const inner = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  inner.setAttribute("x", "0");
  inner.setAttribute("y", "0");
  inner.setAttribute("width", String(width));
  inner.setAttribute("height", String(height));
  inner.setAttribute("viewBox", viewBox);
  inner.innerHTML = svgEl.innerHTML;
  wrapper.appendChild(inner);

  // Must be in DOM for svg2pdf to measure
  wrapper.style.position = "absolute";
  wrapper.style.left = "-9999px";
  document.body.appendChild(wrapper);

  return wrapper;
}

export async function exportAsset(opts: ExportOptions): Promise<Blob> {
  const isPng = opts.fileType === "png";

  if (isPng) {
    const width = opts.size;
    const height = opts.size;
    const canvas = await renderImageToCanvas(opts.svgContent, width, height, opts.bgColor, opts.transparent);

    switch (opts.format) {
      case "png":
        return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      case "jpg": {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.fillStyle = opts.transparent ? "#FFFFFF" : opts.bgColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        return new Promise((resolve) => tempCanvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
      }
      case "pdf": {
        // PNG source: still raster in PDF (no vector data available)
        const pdfCanvas = opts.transparent
          ? await renderImageToCanvas(opts.svgContent, width, height, "#FFFFFF", false)
          : canvas;
        const imgData = pdfCanvas.toDataURL("image/png");
        const orientation = width >= height ? "landscape" : "portrait";
        const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
        pdf.addImage(imgData, "PNG", 0, 0, width, height);
        return pdf.output("blob");
      }
      default:
        throw new Error(`SVG export not available for PNG source files`);
    }
  }

  // SVG source file
  const { width, height } = getDimensions(opts.svgContent, opts.size);
  const exportSvg = buildExportSvg(opts);

  switch (opts.format) {
    case "svg":
      return new Blob([exportSvg], { type: "image/svg+xml" });
    case "png": {
      const canvas = await renderToCanvas(exportSvg, width, height);
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    }
    case "jpg": {
      let jpgSvg = exportSvg;
      if (opts.transparent) {
        jpgSvg = buildExportSvg({ ...opts, transparent: false, bgColor: "#FFFFFF" });
      }
      const canvas = await renderToCanvas(jpgSvg, width, height);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.fillStyle = opts.transparent ? "#FFFFFF" : opts.bgColor;
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
      return new Promise((resolve) => tempCanvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
    }
    case "pdf": {
      // Vector PDF using svg2pdf.js
      const pdfOpts = opts.transparent
        ? { ...opts, transparent: false, bgColor: "#FFFFFF" }
        : opts;
      const svgElement = buildSvgElement(pdfOpts, width, height);
      try {
        const orientation = width >= height ? "landscape" : "portrait";
        const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
        await (pdf as any).svg(svgElement, { x: 0, y: 0, width, height });
        return pdf.output("blob");
      } finally {
        // Clean up DOM element
        if (svgElement.parentNode) {
          svgElement.parentNode.removeChild(svgElement);
        }
      }
    }
    default:
      throw new Error(`Unsupported format: ${opts.format}`);
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
