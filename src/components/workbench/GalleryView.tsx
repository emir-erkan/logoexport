import { useMemo } from "react";
import { contrastRatio, wcagLevel } from "@/lib/color-utils";
import { selectiveRecolorSvg, type SvgGroup } from "@/lib/svg-group-utils";
import type { LoadedFile } from "./CenterStage";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;

interface GalleryViewProps {
  colors: ProjectColor[];
  activeFile: LoadedFile;
  fileIdx: number;
  svgGroups: SvgGroup[];
}

export function GalleryView({ colors, activeFile, fileIdx, svgGroups }: GalleryViewProps) {
  const logoColors = useMemo(
    () => colors.filter((c) => c.role === "logo" || c.role === "both"),
    [colors]
  );
  const bgColors = useMemo(
    () => colors.filter((c) => c.role === "background" || c.role === "both"),
    [colors]
  );

  // Group combos by background, sort each group by contrast (high → low)
  const sections = useMemo(() => {
    return bgColors.map((bg) => {
      const combos = logoColors
        .map((logo) => ({
          logo,
          bg,
          ratio: contrastRatio(logo.hex, bg.hex),
        }))
        .sort((a, b) => b.ratio - a.ratio);
      return { bg, combos };
    });
  }, [logoColors, bgColors]);

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

  if (logoColors.length === 0 || bgColors.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Add logo and background colors to see combinations
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-10">
        {sections.map(({ bg, combos }) => (
          <section key={bg.id}>
            <div className="mb-4 flex items-center gap-3">
              <div
                className="h-5 w-5 rounded border"
                style={{ backgroundColor: bg.hex }}
              />
              <h3 className="font-mono text-xs font-medium text-muted-foreground">
                Background {bg.hex}
                {bg.label && (
                  <span className="ml-2 font-sans text-muted-foreground/60">
                    ({bg.label})
                  </span>
                )}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {combos.map(({ logo, ratio }) => {
                const level = wcagLevel(ratio);
                const badgeColors: Record<string, string> = {
                  AAA: "bg-emerald-500/10 text-emerald-600",
                  AA: "bg-amber-500/10 text-amber-600",
                  "Low Contrast": "bg-red-500/10 text-red-500",
                };
                return (
                  <div key={`${logo.id}-${bg.id}`} className="group">
                    <div
                      className="flex aspect-square items-center justify-center rounded-lg p-6 transition-shadow group-hover:shadow-lg"
                      style={{ backgroundColor: bg.hex }}
                    >
                      {renderLogo(
                        logo.hex,
                        bg.hex,
                        `gallery-${fileIdx}-${logo.id}-${bg.id}`
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-3 w-3 rounded-sm border"
                          style={{ backgroundColor: logo.hex }}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {logo.hex}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${badgeColors[level]}`}
                      >
                        {ratio.toFixed(1)}:1{" "}
                        <span className="font-sans">{level}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
