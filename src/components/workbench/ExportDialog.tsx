import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportAsset, downloadBlob } from "@/lib/export-utils";
import { toast } from "sonner";
import type { SvgGroup } from "@/lib/svg-group-utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logoColor: string;
  bgColor: string;
  svgContent: string;
  projectName: string;
  fileType?: "svg" | "png";
  fit?: "fit" | "padded";
  svgGroups?: SvgGroup[];
}

const FORMATS = ["svg", "png", "jpg", "pdf"] as const;
const SIZES = [512, 1024, 2048];

export function ExportDialog({
  open,
  onOpenChange,
  logoColor,
  bgColor,
  svgContent,
  projectName,
  fileType = "svg",
  fit = "padded",
  svgGroups,
}: ExportDialogProps) {
  const isSvg = fileType === "svg";
  const availableFormats = isSvg ? FORMATS : (["png", "jpg", "pdf"] as const);
  const [format, setFormat] = useState<typeof FORMATS[number]>(isSvg ? "png" : "png");
  const [transparent, setTransparent] = useState(bgColor === "transparent");
  const [size, setSize] = useState(1024);
  const [customSize, setCustomSize] = useState("");
  const [exporting, setExporting] = useState(false);

  const transparentAvailable = format === "svg" || format === "png";
  const isTransparentBg = bgColor === "transparent";

  const handleExport = async () => {
    setExporting(true);
    try {
      const finalSize = customSize ? parseInt(customSize) : size;
      if (isNaN(finalSize) || finalSize < 16 || finalSize > 8192) {
        toast.error("Size must be between 16 and 8192px");
        return;
      }
      const effectiveTransparent = isTransparentBg || (transparentAvailable && transparent);
      const blob = await exportAsset({
        format,
        transparent: effectiveTransparent,
        size: finalSize,
        logoColor,
        bgColor: isTransparentBg ? "#FFFFFF" : bgColor,
        svgContent,
        fileName: projectName,
        fileType,
        padded: fit === "padded",
        svgGroups,
      });
      const ext = format;
      const bgLabel = effectiveTransparent ? "transparent" : bgColor.replace("#", "");
      downloadBlob(blob, `${projectName}-${logoColor.replace("#", "")}-on-${bgLabel}.${ext}`);
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
          <DialogTitle className="text-sm font-medium">Export</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Format */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground uppercase tracking-widest">Format</p>
            <div className="flex gap-1.5">
              {availableFormats.map((f) => (
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

          {/* Background */}
          {!isTransparentBg && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground uppercase tracking-widest">Background</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setTransparent(false)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    !transparent ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Solid
                </button>
                <button
                  onClick={() => setTransparent(true)}
                  disabled={!transparentAvailable}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    transparent ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  Transparent
                </button>
              </div>
              {!transparentAvailable && (
                <p className="mt-1 text-[10px] text-muted-foreground">Transparent only for SVG & PNG</p>
              )}
            </div>
          )}

          {/* Size */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground uppercase tracking-widest">Size (width)</p>
            <div className="flex gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSize(s); setCustomSize(""); }}
                  className={`rounded px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                    size === s && !customSize
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
              <Input
                placeholder="Custom"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                className="h-7 w-20 font-mono text-xs"
              />
            </div>
          </div>

          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? "Exporting..." : "Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
