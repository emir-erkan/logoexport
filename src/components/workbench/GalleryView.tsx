import { useMemo, useState } from "react";
import { contrastRatio, wcagLevel } from "@/lib/color-utils";
import { selectiveRecolorSvg, hasRecolorableContent, type SvgGroup } from "@/lib/svg-group-utils";
import { BatchExportDialog } from "./BatchExportDialog";
import { Download, Check } from "lucide-react";
import type { LoadedFile } from "./CenterStage";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;

type Fit = "fit" | "padded";

interface GalleryViewProps {
  colors: ProjectColor[];
  activeFile: LoadedFile;
  fileIdx: number;
  svgGroups: SvgGroup[];
  fit: Fit;
}

// Checkerboard pattern for transparent bg preview
const checkerStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

export function GalleryView({ colors, activeFile, fileIdx, svgGroups, fit }: GalleryViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);

  const canRecolor = activeFile.type === "svg" ? hasRecolorableContent(svgGroups) : false;

  const logoColors = useMemo(
    () => colors.filter((c) => c.role === "logo" || c.role === "both"),
    [colors]
  );
  const bgColors = useMemo(
    () => colors.filter((c) => c.role === "background" || c.role === "both"),
    [colors]
  );

  // Include a "transparent" pseudo-entry
  const bgColorsWithTransparent = useMemo(() => {
    const transparent: ProjectColor = {
      id: "__transparent__",
      hex: "transparent",
      role: "background",
      label: "Transparent",
      project_id: "",
      sort_order: -1,
      created_at: "",
    };
    return [transparent, ...bgColors];
  }, [bgColors]);

  // When logo can't be recolored, use a single placeholder logo entry
  const effectiveLogoColors = useMemo(() => {
    if (!canRecolor) {
      return [{ id: "__original__", hex: "#000000", role: "logo", label: "Original", project_id: "", sort_order: 0, created_at: "" } as ProjectColor];
    }
    return logoColors;
  }, [canRecolor, logoColors]);

  const sections = useMemo(() => {
    return bgColorsWithTransparent.map((bg) => {
      const combos = effectiveLogoColors
        .map((logo) => ({
          logo,
          bg,
          ratio: bg.hex === "transparent" ? 0 : canRecolor ? contrastRatio(logo.hex, bg.hex) : 0,
        }))
        .sort((a, b) => b.ratio - a.ratio);
      return { bg, combos };
    });
  }, [effectiveLogoColors, bgColorsWithTransparent, canRecolor]);

  const fitClass = fit === "fit" ? "p-0" : "p-6";

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const allKeys = new Set<string>();
    sections.forEach(({ combos }) =>
      combos.forEach(({ logo, bg }) => allKeys.add(`${logo.hex}|${bg.hex}`))
    );
    setSelected(allKeys);
  };

  const clearSelection = () => setSelected(new Set());

  const selectedCombos = useMemo(() => {
    return Array.from(selected).map((key) => {
      const [lc, bc] = key.split("|");
      return { lc, bc };
    });
  }, [selected]);

  const renderLogo = (logoColor: string, bgHex: string, uniqueId: string) => {
    if (activeFile.type === "svg") {
      const html = selectiveRecolorSvg(activeFile.content, logoColor, uniqueId, svgGroups);
      return (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
        />
      );
    }
    return (
      <img
        src={activeFile.content}
        alt="Logo"
        className="h-full w-full object-contain"
      />
    );
  };

  if (effectiveLogoColors.length === 0 || bgColorsWithTransparent.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Add logo and background colors to see combinations
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Selection toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-2">
        <button
          onClick={selected.size > 0 ? clearSelection : selectAll}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {selected.size > 0 ? `${selected.size} selected · Clear` : "Select All"}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setBatchOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
          >
            <Download className="h-3 w-3" /> Download ZIP ({selected.size})
          </button>
        )}
      </div>

      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-10">
          {sections.map(({ bg, combos }) => (
            <section key={bg.id}>
              <div className="mb-4 flex items-center gap-3">
                {bg.hex === "transparent" ? (
                  <div
                    className="h-5 w-5 rounded border"
                    style={checkerStyle}
                  />
                ) : (
                  <div
                    className="h-5 w-5 rounded border"
                    style={{ backgroundColor: bg.hex }}
                  />
                )}
                <h3 className="font-mono text-xs font-medium text-muted-foreground">
                  {bg.hex === "transparent" ? "Transparent" : `Background ${bg.hex}`}
                  {bg.label && bg.hex !== "transparent" && (
                    <span className="ml-2 font-sans text-muted-foreground/60">
                      ({bg.label})
                    </span>
                  )}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {combos.map(({ logo, ratio }) => {
                  const isTransparent = bg.hex === "transparent";
                  const level = isTransparent ? null : wcagLevel(ratio);
                  const badgeColors: Record<string, string> = {
                    AAA: "bg-emerald-500/10 text-emerald-600",
                    AA: "bg-amber-500/10 text-amber-600",
                    Weak: "bg-red-500/10 text-red-500",
                  };
                  const key = `${logo.hex}|${bg.hex}`;
                  const isSelected = selected.has(key);
                  return (
                    <div key={`${logo.id}-${bg.id}`} className="group relative">
                      {/* Selection checkbox */}
                      <button
                        onClick={() => toggleSelect(key)}
                        className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-all ${
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-muted-foreground/30 bg-background/80 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                      <div
                        className={`flex aspect-square items-center justify-center rounded-lg transition-shadow group-hover:shadow-lg ${fitClass}`}
                        style={
                          isTransparent
                            ? checkerStyle
                            : { backgroundColor: bg.hex }
                        }
                      >
                        {renderLogo(
                          logo.hex,
                          bg.hex,
                          `gallery-${fileIdx}-${logo.id}-${bg.id}`
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        {canRecolor && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-3 w-3 rounded-sm border"
                              style={{ backgroundColor: logo.hex }}
                            />
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {logo.hex}
                            </span>
                          </div>
                        )}
                        {!canRecolor && (
                          <span className="font-mono text-[10px] text-muted-foreground">Original</span>
                        )}
                        {level && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${badgeColors[level]}`}
                          >
                            {ratio.toFixed(1)}:1{" "}
                            <span className="font-sans">{level}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {batchOpen && (
        <BatchExportDialog
          open={batchOpen}
          onOpenChange={setBatchOpen}
          combos={selectedCombos}
          svgContent={activeFile.content}
          projectName={`gallery`}
          fileType={activeFile.type}
          fit={fit}
          svgGroups={svgGroups}
        />
      )}
    </div>
  );
}
