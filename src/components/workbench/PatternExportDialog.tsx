import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadBlob } from "@/lib/export-utils";
import { toast } from "sonner";

interface RecoloredSymbol {
  id: string;
  viewBox: string;
  innerHTML: string;
  fileId: string;
}

interface PatternParams {
  recoloredSymbols: RecoloredSymbol[];
  layout: string;
  elementSize: number;
  hSpacing: number;
  vSpacing: number;
  rowOffset: number;
  angle: number;
  fileSizes: Record<string, number>;
  activeBg: string;
  transparentBg: boolean;
}

interface PatternExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patternParams: PatternParams;
  projectName: string;
}

const FORMATS = ["svg", "pdf", "png", "jpg"] as const;
type Unit = "px" | "mm";
const MM_TO_PX = 3.7795275591; // 96 DPI

function svgToDataUrl(svgString: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
}

/**
 * Generates a FLAT SVG — every logo placed as actual path data at its exact
 * position. No <symbol>, no <pattern>, no <use> references.
 * This is what Illustrator needs to show editable vector paths.
 */
function generateFlatSvg(params: PatternParams, pxW: number, pxH: number): string {
  const {
    recoloredSymbols, layout, elementSize, hSpacing, vSpacing,
    rowOffset, angle, fileSizes, activeBg, transparentBg
  } = params;

  const n = recoloredSymbols.length;
  if (n === 0) throw new Error("No logos selected");

  const cellW = elementSize + hSpacing;
  const cellH = elementSize + vSpacing;
  const offsetPx = (cellW * rowOffset) / 100;

  // Calculate how many rows/cols needed to cover the canvas after rotation
  // We generate a larger grid than needed, then rotate + clip
  const diag = Math.sqrt(pxW * pxW + pxH * pxH);
  const expandedW = diag * 1.5;
  const expandedH = diag * 1.5;

  // Scale cell sizes proportionally to output size
  const scale = pxW / 800;
  const sCellW = cellW * scale;
  const sCellH = cellH * scale;
  const sOffsetPx = offsetPx * scale;

  const startX = -(expandedW - pxW) / 2 - sCellW;
  const startY = -(expandedH - pxH) / 2 - sCellH;

  const cols = Math.ceil(expandedW / sCellW) + 4;
  const rows = Math.ceil(expandedH / sCellH) + 4;

  const elements: string[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let x = startX + col * sCellW;
      let y = startY + row * sCellH;

      if (layout === "brick" && row % 2 !== 0) {
        x += sOffsetPx;
      } else if (layout === "diamond") {
        x += row % 2 !== 0 ? sOffsetPx : 0;
        y = startY + row * (sCellH * 0.75);
      } else if (layout === "hex") {
        x += row % 2 !== 0 ? sOffsetPx : 0;
        y = startY + row * (sCellH * 0.866);
      }

      const sym = recoloredSymbols[col % n];
      const fileSize = (fileSizes[sym.fileId] ?? elementSize) * scale;
      const ox = ((elementSize * scale) - fileSize) / 2;
      const oy = ((elementSize * scale) - fileSize) / 2;

      elements.push(
        `<svg x="${x + ox}" y="${y + oy}" width="${fileSize}" height="${fileSize}" viewBox="${sym.viewBox}" overflow="visible">${sym.innerHTML}</svg>`
      );
    }
  }

  const bgRect = transparentBg ? "" : `<rect width="${pxW}" height="${pxH}" fill="${activeBg}"/>`;
  const cx = pxW / 2;
  const cy = pxH / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">
  <defs>
    <clipPath id="canvas-clip"><rect width="${pxW}" height="${pxH}"/></clipPath>
  </defs>
  ${bgRect}
  <g clip-path="url(#canvas-clip)">
    <g transform="rotate(${angle}, ${cx}, ${cy})">
      ${elements.join("\n      ")}
    </g>
  </g>
</svg>`;
}

function renderSvgToCanvas(svgString: string, width: number, height: number): Promise<HTMLCanvasElement> {
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

export function PatternExportDialog({
  open,
  onOpenChange,
  patternParams,
  projectName,
}: PatternExportDialogProps) {
  const [format, setFormat] = useState<typeof FORMATS[number]>("svg");
  const [width, setWidth] = useState("2000");
  const [height, setHeight] = useState("2000");
  const [unit, setUnit] = useState<Unit>("px");
  const [exporting, setExporting] = useState(false);

  const isTransparent = patternParams.transparentBg;

  const handleExport = async () => {
    setExporting(true);
    try {
      const w = parseFloat(width);
      const h = parseFloat(height);
      if (isNaN(w) || isNaN(h) || w < 1 || h < 1) {
        toast.error("Enter valid width and height");
        return;
      }

      const pxW = unit === "mm" ? Math.round(w * MM_TO_PX) : Math.round(w);
      const pxH = unit === "mm" ? Math.round(h * MM_TO_PX) : Math.round(h);

      if (pxW > 20000 || pxH > 20000) {
        toast.error("Maximum 20000px per side");
        return;
      }

      const flatSvg = generateFlatSvg(patternParams, pxW, pxH);
      let blob: Blob;

      switch (format) {
        case "svg":
          blob = new Blob([flatSvg], { type: "image/svg+xml" });
          break;

        case "pdf": {
          const { jsPDF } = await import("jspdf");
          const { svg2pdf } = await import("svg2pdf.js");
          const orientation = pxW >= pxH ? "landscape" : "portrait";
          const pdf = new jsPDF({ orientation, unit: "px", format: [pxW, pxH], compress: true });
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(flatSvg, "image/svg+xml");
          const svgElement = svgDoc.querySelector("svg") as SVGSVGElement;
          if (!svgElement) throw new Error("Invalid SVG for PDF export");
          await svg2pdf(svgElement, pdf, { x: 0, y: 0, width: pxW, height: pxH });
          blob = pdf.output("blob");
          break;
        }

        case "png": {
          const canvas = await renderSvgToCanvas(flatSvg, pxW, pxH);
          blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
          break;
        }

        case "jpg": {
          let jpgSvg = flatSvg;
          if (isTransparent) {
            jpgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">
              <rect width="${pxW}" height="${pxH}" fill="#FFFFFF"/>
              <image href="${svgToDataUrl(flatSvg)}" width="${pxW}" height="${pxH}"/>
            </svg>`;
          }
          const canvas = await renderSvgToCanvas(jpgSvg, pxW, pxH);
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.fillStyle = isTransparent ? "#FFFFFF" : patternParams.activeBg;
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(canvas, 0, 0);
          blob = await new Promise<Blob>((resolve) => tempCanvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
          break;
        }

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      downloadBlob(blob, `${projectName}.${format}`);
      toast.success("Exported!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">Export Pattern</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs text-muted-foreground uppercase tracking-widest">Format</p>
            <div className="flex gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                    format === f
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground uppercase tracking-widest">Dimensions</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">Width</label>
                <Input
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="h-8 font-mono text-xs"
                  placeholder="2000"
                />
              </div>
              <span className="text-muted-foreground mt-4">×</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">Height</label>
                <Input
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="h-8 font-mono text-xs"
                  placeholder="2000"
                />
              </div>
              <div className="w-20">
                <label className="text-[10px] text-muted-foreground mb-1 block">Unit</label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="px">px</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {unit === "mm" && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {Math.round(parseFloat(width || "0") * MM_TO_PX)} × {Math.round(parseFloat(height || "0") * MM_TO_PX)} px at 96 DPI
              </p>
            )}
          </div>

          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? "Exporting..." : "Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
