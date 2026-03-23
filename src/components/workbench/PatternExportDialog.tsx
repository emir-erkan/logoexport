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
import { exportAsset, downloadBlob } from "@/lib/export-utils";
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

      // Rescale the SVG to the target dimensions
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const svgEl = doc.querySelector("svg");
      if (!svgEl) throw new Error("Invalid SVG");

      const origVB = svgEl.getAttribute("viewBox") || "0 0 800 800";
      svgEl.setAttribute("width", String(pxW));
      svgEl.setAttribute("height", String(pxH));
      // Keep viewBox as-is so the pattern tiles

      const resizedSvg = new XMLSerializer().serializeToString(svgEl);

      const effectiveTransparent = isTransparent && transparentAvailable;

      const blob = await exportAsset({
        format,
        transparent: effectiveTransparent,
        size: pxW,
        logoColor: "#000000",
        bgColor: isTransparent ? "#FFFFFF" : bgColor,
        svgContent: resizedSvg,
        fileName: projectName,
        fileType: "svg",
        padded: false,
      });

      const ext = format;
      downloadBlob(blob, `${projectName}.${ext}`);
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
