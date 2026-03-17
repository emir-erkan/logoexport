import { useState, useMemo } from "react";
import { recolorSvg, contrastRatio, wcagLevel } from "@/lib/color-utils";
import { selectiveRecolorSvg, detectSvgGroups, hasRecolorableContent, type SvgGroup } from "@/lib/svg-group-utils";
import { ExportDialog } from "./ExportDialog";
import { GalleryView } from "./GalleryView";
import { Download, Maximize, Frame, Palette, LayoutGrid } from "lucide-react";
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
type ViewMode = "manual" | "gallery";

// Checkerboard for transparent bg
const checkerStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

export function CenterStage({ colors, loadedFiles, projectName, readOnly = false }: CenterStageProps) {
  const [fit, setFit] = useState<Fit>("padded");
  const [viewMode, setViewMode] = useState<ViewMode>("manual");
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [transparentBg, setTransparentBg] = useState(false);
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

  const activeFile = loadedFiles[selectedFileIdx] || loadedFiles[0];
  const activeLogo = selectedLogo || logoColors[0]?.hex || "#000000";
  const activeBg = transparentBg ? "transparent" : (selectedBg || bgColors[0]?.hex || "#FFFFFF");

  const svgGroups = useMemo<SvgGroup[]>(() => {
    if (!activeFile || activeFile.type !== "svg") return [];
    return detectSvgGroups(activeFile.content);
  }, [activeFile]);

  const hasSelectiveRecolor = svgGroups.length > 0 && svgGroups.some(g => g.isRecolorable) && svgGroups.some(g => !g.isRecolorable);
  const canRecolorLogo = activeFile?.type === "svg" ? hasRecolorableContent(svgGroups) : false;

  const fitClassLarge = fit === "fit" ? "p-0" : "p-8 sm:p-12";
  const aspectClass = fit === "fit" ? "" : "aspect-square max-w-md";

  if (loadedFiles.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Upload an SVG or PNG to get started</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (colors.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Add colors to your palette</p>
        </div>
        <Footer />
      </div>
    );
  }

  const renderLogo = (loadedFile: LoadedFile, logoColor: string, uniqueId: string, className?: string) => {
    if (loadedFile.type === "svg") {
      const html = selectiveRecolorSvg(loadedFile.content, logoColor, uniqueId, svgGroups);
      return (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${className || ""}`}
        />
      );
    }
    return <img src={loadedFile.content} alt="Logo" className={`h-full w-full object-contain ${className || ""}`} />;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 border-b px-4 py-3">
        {/* View mode toggle */}
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setViewMode("manual")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Palette className="h-3 w-3" /> Manual
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "gallery" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3 w-3" /> Gallery
          </button>
        </div>

        {/* Fit toggle — available in both views */}
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

      {/* File selector */}
      {loadedFiles.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
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

      {/* Selective recolor indicator */}
      {hasSelectiveRecolor && viewMode === "manual" && (
        <div className="flex items-center justify-center gap-2 border-b px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            Selective recolor active — preserving multi-color groups: {svgGroups.filter(g => !g.isRecolorable).map(g => g.id).join(", ")}
          </span>
        </div>
      )}
      {!canRecolorLogo && activeFile?.type === "svg" && viewMode === "manual" && (
        <div className="flex items-center justify-center gap-2 border-b px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            Colorful asset detected — only background can be changed
          </span>
        </div>
      )}

      {viewMode === "gallery" && activeFile ? (
        <GalleryView
          colors={colors}
          activeFile={activeFile}
          fileIdx={selectedFileIdx}
          svgGroups={svgGroups}
          fit={fit}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:gap-6 overflow-y-auto p-4 sm:p-8">
          <div
            className={`flex w-full items-center justify-center rounded-lg transition-colors duration-200 ${aspectClass} ${fitClassLarge} ${fit === "fit" ? "flex-1" : ""}`}
            style={
              transparentBg
                ? checkerStyle
                : { backgroundColor: activeBg }
            }
          >
            {activeFile && renderLogo(activeFile, activeLogo, `manual-${selectedFileIdx}`)}
          </div>
          {activeFile?.type === "svg" && !transparentBg && <ContrastBadge logo={activeLogo} bg={activeBg} />}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            {canRecolorLogo && (
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
                {/* Transparent option */}
                <button
                  onClick={() => { setTransparentBg(true); setSelectedBg(null); }}
                  className={`h-8 w-8 rounded border transition-all ${
                    transparentBg ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110"
                  }`}
                  style={checkerStyle}
                  title="Transparent"
                />
                {bgColors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setTransparentBg(false); setSelectedBg(c.hex); }}
                    className={`h-8 w-8 rounded transition-all ${
                      !transparentBg && activeBg === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110"
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
      )}

      <Footer />

      {exportTarget && loadedFiles[exportTarget.fileIdx] && (
        <ExportDialog
          open={!!exportTarget}
          onOpenChange={(open) => !open && setExportTarget(null)}
          logoColor={exportTarget.logo}
          bgColor={exportTarget.bg}
          svgContent={loadedFiles[exportTarget.fileIdx].content}
          projectName={projectName}
          fileType={loadedFiles[exportTarget.fileIdx].type}
          fit={fit}
        />
      )}
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t px-4 py-3 text-center">
      <p className="text-[10px] text-muted-foreground/50">
        Made by{" "}
        <a
          href="https://emirerkan.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/70 underline-offset-2 hover:underline hover:text-muted-foreground transition-colors"
        >
          emirerkan.com
        </a>
      </p>
    </div>
  );
}

function ContrastBadge({ logo, bg }: { logo: string; bg: string }) {
  const ratio = contrastRatio(logo, bg);
  const level = wcagLevel(ratio);
  const badgeColors: Record<string, string> = {
    AAA: "bg-emerald-500/10 text-emerald-600",
    AA: "bg-amber-500/10 text-amber-600",
    Weak: "bg-red-500/10 text-red-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${badgeColors[level]}`}>
      {ratio.toFixed(1)}:1 <span className="font-sans">{level}</span>
    </span>
  );
}
