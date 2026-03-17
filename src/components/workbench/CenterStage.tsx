import { useState, useMemo } from "react";
import { recolorSvg, contrastRatio, wcagLevel } from "@/lib/color-utils";
import { ExportDialog } from "./ExportDialog";
import { Download, Maximize, Frame } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;
type ProjectFile = Tables<"project_files">;

export interface LoadedFile {
  file: ProjectFile;
  content: string;
  type: "svg" | "png";
}

interface CenterStageProps {
  colors: ProjectColor[];
  loadedFiles: LoadedFile[];
  projectName: string;
  readOnly?: boolean;
}

type Fit = "fit" | "padded";

export function CenterStage({ colors, loadedFiles, projectName, readOnly = false }: CenterStageProps) {
  const [fit, setFit] = useState<Fit>("padded");
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [exportTarget, setExportTarget] = useState<{ logo: string; bg: string; fileIdx: number } | null>(null);

  const logoColors = useMemo(
    () => colors.filter((c) => c.role === "logo" || c.role === "both"),
    [colors]
  );
  const bgColors = useMemo(
    () => colors.filter((c) => c.role === "background" || c.role === "both"),
    [colors]
  );

  const fitClassLarge = fit === "fit" ? "p-0" : "p-8 sm:p-12";

  if (loadedFiles.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Upload an SVG or PNG to get started</p>
      </div>
    );
  }

  if (colors.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Add colors to your palette</p>
      </div>
    );
  }

  const renderLogo = (loadedFile: LoadedFile, logoColor: string, uniqueId: string, className?: string) => {
    if (loadedFile.type === "svg") {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: recolorSvg(loadedFile.content, logoColor, uniqueId) }}
          className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${className || ""}`}
        />
      );
    }
    return <img src={loadedFile.content} alt="Logo" className={`h-full w-full object-contain ${className || ""}`} />;
  };

  const activeFile = loadedFiles[selectedFileIdx] || loadedFiles[0];
  const activeLogo = selectedLogo || logoColors[0]?.hex || "#000000";
  const activeBg = selectedBg || bgColors[0]?.hex || "#FFFFFF";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 border-b px-4 py-3">
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setFit("fit")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              fit === "fit" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Maximize className="h-3 w-3" /> Fit
          </button>
          <button
            onClick={() => setFit("padded")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              fit === "padded" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Frame className="h-3 w-3" /> Padded
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:gap-6 overflow-y-auto p-4 sm:p-8">
        {/* File selector */}
        {loadedFiles.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {loadedFiles.map((lf, idx) => (
              <button
                key={lf.file.id}
                onClick={() => setSelectedFileIdx(idx)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  selectedFileIdx === idx
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {lf.file.file_name}
              </button>
            ))}
          </div>
        )}
        <div
          className={`flex aspect-square w-full max-w-md items-center justify-center rounded-lg transition-colors duration-200 ${fitClassLarge}`}
          style={{ backgroundColor: activeBg }}
        >
          {renderLogo(activeFile, activeLogo, `manual-${selectedFileIdx}`)}
        </div>
        {activeFile.type === "svg" && <ContrastBadge logo={activeLogo} bg={activeBg} />}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
          {activeFile.type === "svg" && (
            <div>
              <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Logo</p>
              <div className="flex flex-wrap gap-1.5">
                {logoColors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedLogo(c.hex)}
                    className={`h-8 w-8 rounded transition-all ${
                      activeLogo === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Background</p>
            <div className="flex flex-wrap gap-1.5">
              {bgColors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedBg(c.hex)}
                  className={`h-8 w-8 rounded transition-all ${
                    activeBg === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExportTarget({ logo: activeLogo, bg: activeBg, fileIdx: selectedFileIdx })}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {exportTarget && loadedFiles[exportTarget.fileIdx] && (
        <ExportDialog
          open={!!exportTarget}
          onOpenChange={(open) => !open && setExportTarget(null)}
          logoColor={exportTarget.logo}
          bgColor={exportTarget.bg}
          svgContent={loadedFiles[exportTarget.fileIdx].content}
          projectName={projectName}
          fileType={loadedFiles[exportTarget.fileIdx].type}
        />
      )}
    </div>
  );
}

function ContrastBadge({ logo, bg, small = false }: { logo: string; bg: string; small?: boolean }) {
  const ratio = contrastRatio(logo, bg);
  const level = wcagLevel(ratio);
  const badgeColors = {
    AAA: "bg-success/10 text-success",
    AA: "bg-warning/10 text-warning",
    FAIL: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono ${small ? "text-[10px]" : "text-xs"} font-medium ${badgeColors[level]}`}>
      {ratio.toFixed(1)}:1 <span className="font-sans">{level}</span>
    </span>
  );
}
