import { useState, useMemo } from "react";
import { recolorSvg, contrastRatio, wcagLevel, normalizeHex } from "@/lib/color-utils";
import { ExportDialog } from "./ExportDialog";
import { BatchExportDialog } from "./BatchExportDialog";
import { Download, Maximize, Frame, CheckSquare, Square, Package } from "lucide-react";
import { motion } from "framer-motion";
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

type Mode = "manual" | "matrix";
type Fit = "fit" | "padded";

interface ComboEntry {
  lc: string;
  bc: string;
  ratio: number;
}

function getUniqueColorCombos(logoColors: ProjectColor[], bgColors: ProjectColor[], isSvg: boolean): ComboEntry[] {
  if (isSvg) {
    const seen = new Set<string>();
    const combos: ComboEntry[] = [];
    for (const lc of logoColors) {
      for (const bc of bgColors) {
        const nlc = normalizeHex(lc.hex);
        const nbc = normalizeHex(bc.hex);
        if (nlc === nbc) continue;
        const key = `${nlc}-${nbc}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combos.push({ lc: lc.hex, bc: bc.hex, ratio: contrastRatio(lc.hex, bc.hex) });
      }
    }
    combos.sort((a, b) => b.ratio - a.ratio);
    return combos;
  } else {
    return bgColors.map((bc) => ({
      lc: "#000000",
      bc: bc.hex,
      ratio: 0,
    }));
  }
}

export function CenterStage({ colors, loadedFiles, projectName, readOnly = false }: CenterStageProps) {
  const [mode, setMode] = useState<Mode>("matrix");
  const [fit, setFit] = useState<Fit>("padded");
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [exportTarget, setExportTarget] = useState<{ logo: string; bg: string; fileIdx: number } | null>(null);
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set());
  const [showBatchExport, setShowBatchExport] = useState(false);

  const logoColors = useMemo(
    () => colors.filter((c) => c.role === "logo" || c.role === "both"),
    [colors]
  );
  const bgColors = useMemo(
    () => colors.filter((c) => c.role === "background" || c.role === "both"),
    [colors]
  );

  // Unique color combos (shared across all files)
  const combos = useMemo(
    () => getUniqueColorCombos(logoColors, bgColors, true),
    [logoColors, bgColors]
  );

  const fitClass = fit === "fit" ? "p-0" : "p-6";
  const fitClassLarge = fit === "fit" ? "p-0" : "p-12";

  // For batch export, track combo+file pairs
  const toggleCombo = (key: string) => {
    setSelectedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allKeys = useMemo(() => {
    const keys: string[] = [];
    for (const lf of loadedFiles) {
      for (const c of combos) {
        keys.push(`${lf.file.id}-${c.lc}-${c.bc}`);
      }
    }
    return keys;
  }, [loadedFiles, combos]);

  const toggleAll = () => {
    if (selectedCombos.size === allKeys.length) {
      setSelectedCombos(new Set());
    } else {
      setSelectedCombos(new Set(allKeys));
    }
  };

  const batchCombos = useMemo(() => {
    const result: { lc: string; bc: string; ratio: number }[] = [];
    const seen = new Set<string>();
    for (const key of selectedCombos) {
      const parts = key.split("-");
      // key format: fileId-#HEXLC-#HEXBC
      const lc = parts[1];
      const bc = parts[2];
      const comboKey = `${lc}-${bc}`;
      if (!seen.has(comboKey)) {
        seen.add(comboKey);
        result.push({ lc, bc, ratio: contrastRatio(lc, bc) });
      }
    }
    return result;
  }, [selectedCombos]);

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

        {/* Batch controls (matrix mode only) */}
        {mode === "matrix" && combos.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {selectedCombos.size === allKeys.length ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selectedCombos.size > 0 ? `${selectedCombos.size} selected` : "Select all"}
            </button>
            {selectedCombos.size > 0 && (
              <button
                onClick={() => setShowBatchExport(true)}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
              >
                <Package className="h-3.5 w-3.5" /> Export ZIP
              </button>
            )}
          </>
        )}
      </div>

      {mode === "manual" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8">
          {/* File selector for manual mode */}
          {loadedFiles.length > 1 && (
            <div className="flex gap-1.5">
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
          <div className="flex gap-8">
            {activeFile.type === "svg" && (
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
          <button
            onClick={() => setExportTarget({ logo: activeLogo, bg: activeBg, fileIdx: selectedFileIdx })}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {combos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Assign at least one color to "Logo" and one to "Background"
            </p>
          ) : (
            <div className="space-y-8">
              {loadedFiles.map((lf) => (
                <div key={lf.file.id}>
                  {/* File group header */}
                  {loadedFiles.length > 1 && (
                    <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {lf.file.file_name}
                    </h3>
                  )}
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))` }}>
                    {combos.map((combo, i) => {
                      const comboKey = `${lf.file.id}-${combo.lc}-${combo.bc}`;
                      const isSelected = selectedCombos.has(comboKey);
                      return (
                        <motion.div
                          key={comboKey}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className={`group relative overflow-hidden rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                            isSelected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
                          }`}
                          onClick={() => toggleCombo(comboKey)}
                        >
                          {/* Selection indicator */}
                          <div className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-all ${
                            isSelected
                              ? "border-foreground bg-foreground text-background"
                              : "border-muted-foreground/30 bg-background/60 opacity-0 group-hover:opacity-100"
                          }`}>
                            {isSelected && <CheckSquare className="h-3 w-3" />}
                          </div>

                          <div
                            className={`flex aspect-square items-center justify-center transition-colors duration-200 ${fitClass}`}
                            style={{ backgroundColor: combo.bc }}
                          >
                            {renderLogo(lf, combo.lc)}
                          </div>
                          <div className="flex items-center justify-between bg-card p-2">
                            {lf.type === "svg" ? (
                              <ContrastBadge logo={combo.lc} bg={combo.bc} small />
                            ) : (
                              <span className="font-mono text-[10px] text-muted-foreground">{combo.bc}</span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setExportTarget({ logo: combo.lc, bg: combo.bc, fileIdx: loadedFiles.indexOf(lf) }); }}
                              className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {lf.type === "svg" && (
                            <div className="flex gap-1 px-2 pb-2">
                              <span className="font-mono text-[10px] text-muted-foreground">{combo.lc}</span>
                              <span className="text-[10px] text-muted-foreground/40">/</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{combo.bc}</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {showBatchExport && loadedFiles[0] && (
        <BatchExportDialog
          open={showBatchExport}
          onOpenChange={setShowBatchExport}
          combos={batchCombos}
          svgContent={loadedFiles[0].content}
          projectName={projectName}
          fileType={loadedFiles[0].type}
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
