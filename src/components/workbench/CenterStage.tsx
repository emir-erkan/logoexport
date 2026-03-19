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
      <div className="flex items-center justify-center gap-3 border-b px-4 py-3">
        <div className="flex rounded-xl bg-muted p-1">
          <button
            onClick={() => setViewMode("manual")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              viewMode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Palette className="h-3.5 w-3.5" /> Manual
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              viewMode === "gallery" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Gallery
          </button>
        </div>

        <div className="flex rounded-xl bg-muted p-1">
          <button
            onClick={() => setFit("fit")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              fit === "fit" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Maximize className="h-3.5 w-3.5" /> Fit
          </button>
          <button
            onClick={() => setFit("padded")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              fit === "padded" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Frame className="h-3.5 w-3.5" /> Padded
          </button>
        </div>
      </div>

      {/* File selector */}
      {loadedFiles.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
          {loadedFiles.map((lf, idx) => (
            <button
              key={lf.file.id}
              onClick={() => setSelectedFileIdx(idx)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedFileIdx === idx
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {lf.file.file_name.replace(/\.\w+$/, "")}
            </button>
          ))}
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
        <div className="flex flex-1 flex-col items-center justify-center gap-5 sm:gap-6 overflow-y-auto p-4 sm:p-8">
          <div
            className={`flex aspect-square w-full max-w-md items-center justify-center rounded-2xl transition-colors duration-200 ${fitClassLarge}`}
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
                <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Logo</p>
                <div className="flex flex-wrap gap-2">
                  {logoColors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedLogo(c.hex)}
                      className={`h-9 w-9 rounded-xl transition-all ${
                        activeLogo === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Background</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setTransparentBg(true); setSelectedBg(null); }}
                  className={`h-9 w-9 rounded-xl border transition-all ${
                    transparentBg ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"
                  }`}
                  style={checkerStyle}
                  title="Transparent"
                />
                {bgColors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setTransparentBg(false); setSelectedBg(c.hex); }}
                    className={`h-9 w-9 rounded-xl transition-all ${
                      !transparentBg && activeBg === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setExportTarget({ logo: activeLogo, bg: activeBg, fileIdx: selectedFileIdx })}
            className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-semibold text-background transition-all hover:opacity-90 hover:shadow-md"
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
          svgGroups={svgGroups}
        />
      )}
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t px-4 py-3 text-center">
      <p className="text-[10px] text-muted-foreground/40">
        Made by{" "}
        <a
          href="http://emirerkan.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/60 underline-offset-2 hover:underline hover:text-muted-foreground transition-colors"
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-medium ${badgeColors[level]}`}>
      {ratio.toFixed(1)}:1 <span className="font-sans">{level}</span>
    </span>
  );
}
