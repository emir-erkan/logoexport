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

interface PatternExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgContent: string;
  projectName: string;
  bgColor: string;
}

const FORMATS = ["svg", "png", "jpg", "pdf"] as const;
type Unit = "px" | "mm";
const MM_TO_PX = 3.7795275591; // 96 DPI

function svgToDataUrl(svgString: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
}

function resizeSvg(svgContent: string, pxW: number, pxH: number): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) throw new Error("Invalid SVG");
  svgEl.setAttribute("width", String(pxW));
  svgEl.setAttribute("height", String(pxH));
  // Do NOT change viewBox — pattern coordinates are in userSpaceOnUse (800x800 space)
  return new XMLSerializer().serializeToString(svgEl);
}

function renderPatternToCanvas(svgString: string, width: number, height: number): Promise<HTMLCanvasElement> {
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
  svgContent,
  projectName,
  bgColor,
}: PatternExportDialogProps) {
  const [format, setFormat] = useState<typeof FORMATS[number]>("png");
  const [width, setWidth] = useState("2000");
  const [height, setHeight] = useState("2000");
  const [unit, setUnit] = useState<Unit>("px");
  const [exporting, setExporting] = useState(false);

  const isTransparent = bgColor === "transparent";
  const transparentAvailable = format === "svg" || format === "png";

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

      if (pxW > 10000 || pxH > 10000) {
        toast.error("Maximum 10000px per side");
        return;
      }

      // Resize the already-composed pattern SVG (no recoloring needed)
      const resizedSvg = resizeSvg(svgContent, pxW, pxH);

      let blob: Blob;

      switch (format) {
        case "svg":
          blob = new Blob([resizedSvg], { type: "image/svg+xml" });
          break;
        case "png": {
          const canvas = await renderPatternToCanvas(resizedSvg, pxW, pxH);
          blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
          break;
        }
        case "jpg": {
          // For JPG, ensure white bg if transparent
          let jpgSvg = resizedSvg;
          if (isTransparent) {
            // Wrap with a white background
            jpgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">
              <rect width="${pxW}" height="${pxH}" fill="#FFFFFF"/>
              <image href="${svgToDataUrl(resizedSvg)}" width="${pxW}" height="${pxH}"/>
            </svg>`;
          }
          const canvas = await renderPatternToCanvas(jpgSvg, pxW, pxH);
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.fillStyle = isTransparent ? "#FFFFFF" : bgColor;
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(canvas, 0, 0);
          blob = await new Promise<Blob>((resolve) => tempCanvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
          break;
        }
        case "pdf": {
          const { jsPDF } = await import("jspdf");
          const { svg2pdf } = await import("svg2pdf.js");
          const orientation = pxW >= pxH ? "landscape" : "portrait";
          const pdf = new jsPDF({ orientation, unit: "px", format: [pxW, pxH], compress: true });
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(resizedSvg, "image/svg+xml");
          const svgElement = svgDoc.querySelector("svg") as SVGSVGElement;
          if (!svgElement) throw new Error("Invalid SVG for PDF");
          await svg2pdf(svgElement, pdf, { x: 0, y: 0, width: pxW, height: pxH });
          blob = pdf.output("blob");
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
          {/* Format */}
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

          {/* Size */}
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

          {!transparentAvailable && isTransparent && (
            <p className="text-[10px] text-muted-foreground">Transparent background only available for SVG & PNG</p>
          )}

          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? "Exporting..." : "Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
