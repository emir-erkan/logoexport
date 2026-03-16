import { useState, useMemo } from "react";
import { recolorSvg, contrastRatio, wcagLevel } from "@/lib/color-utils";
import { ExportDialog } from "./ExportDialog";
import { Download, Maximize, Frame } from "lucide-react";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;

interface CenterStageProps {
  colors: ProjectColor[];
  fileContent: string | null;
  fileType: "svg" | "png";
  projectName: string;
  readOnly?: boolean;
}

type Mode = "manual" | "matrix";
type Fit = "fit" | "padded";

export function CenterStage({ colors, fileContent, fileType, projectName, readOnly = false }: CenterStageProps) {
  const [mode, setMode] = useState<Mode>("matrix");
  const [fit, setFit] = useState<Fit>("padded");
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{ logo: string; bg: string } | null>(null);

  const isSvg = fileType === "svg";

  const logoColors = useMemo(
    () => (isSvg ? colors.filter((c) => c.role === "logo" || c.role === "both") : []),
    [colors, isSvg]
  );
  const bgColors = useMemo(
    () => colors.filter((c) => c.role === "background" || c.role === "both"),
    [colors]
  );

  // Build unique combos for matrix, sorted by contrast (high→low)
  const matrixCombos = useMemo(() => {
    if (isSvg) {
      const seen = new Set<string>();
      const combos: { lc: string; bc: string; ratio: number }[] = [];
      for (const lc of logoColors) {
        for (const bc of bgColors) {
          if (lc.hex === bc.hex) continue; // skip same-color combos
          const key = `${lc.hex}-${bc.hex}`;
          if (seen.has(key)) continue;
          seen.add(key);
          combos.push({ lc: lc.hex, bc: bc.hex, ratio: contrastRatio(lc.hex, bc.hex) });
        }
      }
      combos.sort((a, b) => b.ratio - a.ratio);
      return combos;
    } else {
      // PNG: just show on different backgrounds
      return bgColors.map((bc) => ({
        lc: "#000000", // placeholder, not used for recoloring
        bc: bc.hex,
        ratio: 0,
      }));
    }
  }, [logoColors, bgColors, isSvg]);

  // Manual mode defaults
  const activeLogo = selectedLogo || logoColors[0]?.hex || "#000000";
  const activeBg = selectedBg || bgColors[0]?.hex || "#FFFFFF";

  const fitClass = fit === "fit" ? "p-0" : "p-6";
  const fitClassLarge = fit === "fit" ? "p-0" : "p-12";

  if (!fileContent) {
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

  const renderLogo = (logoColor: string, className?: string) => {
    if (isSvg) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: recolorSvg(fileContent, logoColor) }}
          className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${className || ""}`}
        />
      );
    }
    return <img src={fileContent} alt="Logo" className={`h-full w-full object-contain ${className || ""}`} />;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 border-b px-4 py-3">
        {/* Mode toggle */}
        <div className="flex rounded-lg bg-muted p-0.5">
          {(["manual", "matrix"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "manual" ? "Manual" : "Matrix"}
            </button>
          ))}
        </div>

        {/* Fit toggle */}
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

      {mode === "manual" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8">
          {/* Preview */}
          <div
            className={`flex aspect-square w-full max-w-md items-center justify-center rounded-lg transition-colors duration-200 ${fitClassLarge}`}
            style={{ backgroundColor: activeBg }}
          >
            {renderLogo(activeLogo)}
          </div>

          {/* Contrast badge (SVG only) */}
          {isSvg && <ContrastBadge logo={activeLogo} bg={activeBg} />}

          {/* Color selectors */}
          <div className="flex gap-8">
            {isSvg && (
              <div>
                <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Logo</p>
                <div className="flex gap-1.5">
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
              <div className="flex gap-1.5">
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

          {/* Export button */}
          <button
            onClick={() => setExportTarget({ logo: activeLogo, bg: activeBg })}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      ) : (
        /* Matrix mode */
        <div className="flex-1 overflow-y-auto p-6">
          {matrixCombos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {isSvg
                ? 'Assign at least one color to "Logo" and one to "Background"'
                : 'Assign at least one color to "Background"'}
            </p>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))` }}>
              {matrixCombos.map((combo, i) => (
                <motion.div
                  key={`${combo.lc}-${combo.bc}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="group relative overflow-hidden rounded-lg border bevel transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`flex aspect-square items-center justify-center transition-colors duration-200 ${fitClass}`}
                    style={{ backgroundColor: combo.bc }}
                  >
                    {renderLogo(combo.lc)}
                  </div>
                  <div className="flex items-center justify-between bg-card p-2">
                    {isSvg ? (
                      <ContrastBadge logo={combo.lc} bg={combo.bc} small />
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">{combo.bc}</span>
                    )}
                    <button
                      onClick={() => setExportTarget({ logo: combo.lc, bg: combo.bc })}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isSvg && (
                    <div className="flex gap-1 px-2 pb-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{combo.lc}</span>
                      <span className="text-[10px] text-muted-foreground/40">/</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{combo.bc}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {exportTarget && fileContent && (
        <ExportDialog
          open={!!exportTarget}
          onOpenChange={(open) => !open && setExportTarget(null)}
          logoColor={exportTarget.logo}
          bgColor={exportTarget.bg}
          svgContent={fileContent}
          projectName={projectName}
          fileType={fileType}
        />
      )}
    </div>
  );
}

function ContrastBadge({ logo, bg, small = false }: { logo: string; bg: string; small?: boolean }) {
  const ratio = contrastRatio(logo, bg);
  const level = wcagLevel(ratio);
  const colors = {
    AAA: "bg-success/10 text-success",
    AA: "bg-warning/10 text-warning",
    FAIL: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono ${small ? "text-[10px]" : "text-xs"} font-medium ${colors[level]}`}>
      {ratio.toFixed(1)}:1 <span className="font-sans">{level}</span>
    </span>
  );
}
