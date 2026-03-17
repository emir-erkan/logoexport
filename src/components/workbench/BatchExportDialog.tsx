import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportAsset } from "@/lib/export-utils";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { SvgGroup } from "@/lib/svg-group-utils";
import { saveAs } from "file-saver";

interface BatchExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  combos: { lc: string; bc: string }[];
  svgContent: string;
  projectName: string;
  fileType?: "svg" | "png";
  fit?: "fit" | "padded";
}

const FORMATS = ["svg", "png", "jpg", "pdf"] as const;
const SIZES = [512, 1024, 2048];

export function BatchExportDialog({
  open,
  onOpenChange,
  combos,
  svgContent,
  projectName,
  fileType = "svg",
  fit = "padded",
}: BatchExportDialogProps) {
  const isSvg = fileType === "svg";
  const availableFormats = isSvg ? FORMATS : (["png", "jpg", "pdf"] as const);
  const [format, setFormat] = useState<typeof FORMATS[number]>("png");
  const [transparent, setTransparent] = useState(false);
  const [size, setSize] = useState(1024);
  const [customSize, setCustomSize] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const transparentAvailable = format === "svg" || format === "png";

  const handleBatchExport = async () => {
    setExporting(true);
    setProgress(0);
    try {
      const finalSize = customSize ? parseInt(customSize) : size;
      if (isNaN(finalSize) || finalSize < 16 || finalSize > 8192) {
        toast.error("Size must be between 16 and 8192px");
        setExporting(false);
        return;
      }

      const zip = new JSZip();

      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        const isTransparentBg = combo.bc === "transparent";
        const effectiveTransparent = isTransparentBg || (transparentAvailable && transparent);
        const blob = await exportAsset({
          format,
          transparent: effectiveTransparent,
          size: finalSize,
          logoColor: combo.lc,
          bgColor: isTransparentBg ? "#FFFFFF" : combo.bc,
          svgContent,
          fileName: projectName,
          fileType,
          padded: fit === "padded",
        });

        const bgLabel = isTransparentBg ? "transparent" : combo.bc.replace("#", "");
        const fileName = `${projectName}-${combo.lc.replace("#", "")}-on-${bgLabel}.${format}`;
        zip.file(fileName, blob);
        setProgress(Math.round(((i + 1) / combos.length) * 100));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${projectName}-batch-export.zip`);
      toast.success(`Exported ${combos.length} files!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Batch export failed");
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Batch Export · {combos.length} combination{combos.length !== 1 ? "s" : ""}
          </DialogTitle>
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

          <Button onClick={handleBatchExport} disabled={exporting} className="w-full">
            {exporting ? (
              <span className="flex items-center gap-2">
                Exporting... {progress}%
                <span className="h-1 w-16 overflow-hidden rounded-full bg-background/20">
                  <span className="block h-full rounded-full bg-background transition-all" style={{ width: `${progress}%` }} />
                </span>
              </span>
            ) : (
              `Download ZIP (${combos.length} files)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
