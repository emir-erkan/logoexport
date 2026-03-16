import { jsPDF } from "jspdf";
import { recolorSvg } from "./color-utils";

export interface ExportOptions {
  format: "svg" | "png" | "jpg" | "pdf";
  transparent: boolean;
  size: number; // width in px, height auto-scales
  logoColor: string;
  bgColor: string;
  svgContent: string;
  fileName: string;
}

function svgToDataUrl(svgString: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
}

function buildExportSvg(opts: ExportOptions): string {
  const recolored = recolorSvg(opts.svgContent, opts.logoColor);

  // Parse original SVG to get viewBox
  const parser = new DOMParser();
  const doc = parser.parseFromString(recolored, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return recolored;

  const viewBox = svgEl.getAttribute("viewBox") || "0 0 100 100";
  const [, , vbW, vbH] = viewBox.split(" ").map(Number);
  const aspectRatio = vbH / vbW;
  const width = opts.size;
  const height = Math.round(width * aspectRatio);

  // Build a wrapper SVG with background
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
      canvas.width = width * 2; // 2x for retina
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

function getDimensions(svgContent: string, size: number): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  const viewBox = svgEl?.getAttribute("viewBox") || "0 0 100 100";
  const [, , vbW, vbH] = viewBox.split(" ").map(Number);
  const aspectRatio = vbH / vbW;
  return { width: size, height: Math.round(size * aspectRatio) };
}

export async function exportAsset(opts: ExportOptions): Promise<Blob> {
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
      // JPG: if transparent was requested, we still need a white matte
      let jpgSvg = exportSvg;
      if (opts.transparent) {
        jpgSvg = buildExportSvg({ ...opts, transparent: false, bgColor: "#FFFFFF" });
      }
      const canvas = await renderToCanvas(jpgSvg, width, height);
      // Draw white background first for JPG
      const ctx = canvas.getContext("2d")!;
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
      const pdfSvg = opts.transparent
        ? buildExportSvg({ ...opts, transparent: false, bgColor: "#FFFFFF" })
        : exportSvg;
      const canvas = await renderToCanvas(pdfSvg, width, height);
      const imgData = canvas.toDataURL("image/png");
      const orientation = width >= height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      return pdf.output("blob");
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
