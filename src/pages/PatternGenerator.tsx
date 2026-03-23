import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppFooter } from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Check, Copy, Download, PanelLeft, PanelLeftClose } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { selectiveRecolorSvg, detectSvgGroups, hasRecolorableContent } from "@/lib/svg-group-utils";
import { PatternExportDialog } from "@/components/workbench/PatternExportDialog";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;
type ProjectColor = Tables<"project_colors">;
type ProjectFile = Tables<"project_files">;

interface LoadedSvg {
  file: ProjectFile;
  content: string;
}

type LayoutMode = "grid" | "brick" | "diamond" | "hex";

const checkerStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

/** A slider + text input combo for numeric values */
function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "px",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));

  // Sync text when slider changes externally
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commitText = () => {
    const n = parseFloat(text);
    if (!isNaN(n)) {
      onChange(Math.max(min, Math.min(max, n)));
    } else {
      setText(String(value));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => e.key === "Enter" && commitText()}
            className="h-6 w-16 rounded-lg px-1.5 text-right font-mono text-xs border-0 bg-muted"
          />
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        </div>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

export default function PatternGenerator() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [colors, setColors] = useState<ProjectColor[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loadedSvgs, setLoadedSvgs] = useState<LoadedSvg[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Pattern settings
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [hSpacing, setHSpacing] = useState(40);
  const [vSpacing, setVSpacing] = useState(40);
  const [rowOffset, setRowOffset] = useState(50); // percentage of cell width for offset rows
  const [angle, setAngle] = useState(0);
  const [elementSize, setElementSize] = useState(60);
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({}); // per-file size overrides
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [transparentBg, setTransparentBg] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const hasOffset = layout === "brick" || layout === "diamond" || layout === "hex";

  const logoColors = useMemo(() => colors.filter((c) => c.role === "logo" || c.role === "both"), [colors]);
  const bgColors = useMemo(() => colors.filter((c) => c.role === "background" || c.role === "both"), [colors]);
  const activeLogo = selectedLogo || logoColors[0]?.hex || "#000000";
  const activeBg = transparentBg ? "transparent" : (selectedBg || bgColors[0]?.hex || "#FFFFFF");

  const fetchProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    if (data) { setProject(data); setProjectName(data.name); }
  }, [id]);

  const fetchColors = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("project_colors").select("*").eq("project_id", id).order("sort_order");
    setColors(data || []);
  }, [id]);

  const fetchFiles = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("project_files").select("*").eq("project_id", id);
    const fileList = (data || []).filter(f => f.file_name.toLowerCase().endsWith(".svg"));
    setFiles(fileList);

    const loaded: LoadedSvg[] = [];
    for (const file of fileList) {
      const { data: fileData } = await supabase.storage.from("logos").download(file.storage_path);
      if (fileData) {
        loaded.push({ file, content: await fileData.text() });
      }
    }
    setLoadedSvgs(loaded);
    if (fileList.length > 0 && selectedFileIds.size === 0) {
      setSelectedFileIds(new Set([fileList[0].id]));
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchColors();
    fetchFiles();
  }, [fetchProject, fetchColors, fetchFiles]);

  const updateName = async () => {
    if (!project || !projectName.trim()) return;
    await supabase.from("projects").update({ name: projectName.trim() }).eq("id", project.id);
    setEditing(false);
    fetchProject();
  };

  const copyShareLink = () => {
    if (!project) return;
    const url = `https://logoexport.lovable.app/shared/${project.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Share link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const selectedSvgs = useMemo(
    () => loadedSvgs.filter(s => selectedFileIds.has(s.file.id)),
    [loadedSvgs, selectedFileIds]
  );

  // Generate the pattern SVG
  const patternSvg = useMemo(() => {
    if (selectedSvgs.length === 0) return null;

    const canvasW = 800;
    const canvasH = 800;
    const cellW = elementSize + hSpacing;
    const cellH = elementSize + vSpacing;
    const cols = Math.ceil(canvasW / cellW) + 4;
    const rows = Math.ceil(canvasH / cellH) + 4;
    const offsetPx = (cellW * rowOffset) / 100;

    const elements: string[] = [];
    let svgIdx = 0;

    for (let row = -2; row < rows; row++) {
      for (let col = -2; col < cols; col++) {
        let x = col * cellW;
        let y = row * cellH;

        if (layout === "brick" && row % 2 !== 0) {
          x += offsetPx;
        } else if (layout === "diamond") {
          x += (row % 2 !== 0 ? offsetPx : 0);
          y = row * (cellH * 0.75);
        } else if (layout === "hex") {
          x += (row % 2 !== 0 ? offsetPx : 0);
          y = row * (cellH * 0.866);
        }

        const svg = selectedSvgs[svgIdx % selectedSvgs.length];
        const fileSize = fileSizes[svg.file.id] ?? elementSize;
        svgIdx++;

        const groups = detectSvgGroups(svg.content);
        const recolored = hasRecolorableContent(groups)
          ? selectiveRecolorSvg(svg.content, activeLogo, `pat-${row}-${col}`, groups)
          : selectiveRecolorSvg(svg.content, activeLogo, `pat-${row}-${col}`);

        const parser = new DOMParser();
        const doc = parser.parseFromString(recolored, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        if (!svgEl) continue;

        const viewBox = svgEl.getAttribute("viewBox") || "0 0 100 100";
        // Center the element within the cell if it's smaller than the cell
        const offsetX = (elementSize - fileSize) / 2;
        const offsetY = (elementSize - fileSize) / 2;

        elements.push(
          `<svg x="${x + offsetX}" y="${y + offsetY}" width="${fileSize}" height="${fileSize}" viewBox="${viewBox}">${svgEl.innerHTML}</svg>`
        );
      }
    }

    const bgRect = transparentBg ? "" : `<rect width="${canvasW}" height="${canvasH}" fill="${activeBg}" />`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
      <defs><clipPath id="pattern-clip"><rect width="${canvasW}" height="${canvasH}" /></clipPath></defs>
      ${bgRect}
      <g clip-path="url(#pattern-clip)" transform="rotate(${angle}, ${canvasW / 2}, ${canvasH / 2})">
        ${elements.join("\n")}
      </g>
    </svg>`;
  }, [selectedSvgs, layout, hSpacing, vSpacing, rowOffset, angle, elementSize, activeLogo, activeBg, transparentBg]);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editing ? (
            <Input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={updateName}
              onKeyDown={(e) => e.key === "Enter" && updateName()}
              className="h-8 w-48 rounded-lg text-sm"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors"
            >
              {project.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={copyShareLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail */}
        {collapsed ? (
          <div className="flex h-full w-11 flex-col items-center border-r bg-card pt-3">
            <button onClick={() => setCollapsed(false)} className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setCollapsed(true)} />
            <div className="fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r bg-card md:relative md:z-auto md:w-80 overflow-y-auto">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pattern Settings</p>
                <button onClick={() => setCollapsed(true)} className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>

              {/* File Selection */}
              <div className="border-b p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Logos</p>
                <div className="space-y-1.5">
                  {files.map(f => (
                    <label key={f.id} className="flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all hover:bg-accent/50">
                      <Checkbox
                        checked={selectedFileIds.has(f.id)}
                        onCheckedChange={() => toggleFileSelection(f.id)}
                      />
                      <span className="flex-1 truncate font-mono text-xs text-foreground">
                        {f.file_name.replace(/\.\w+$/, "")}
                      </span>
                    </label>
                  ))}
                  {files.length === 0 && (
                    <p className="text-xs text-muted-foreground">No SVG files uploaded. Upload SVGs in Logo Export first.</p>
                  )}
                </div>
              </div>

              {/* Layout */}
              <div className="border-b p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layout</p>
                <Select value={layout} onValueChange={(v) => setLayout(v as LayoutMode)}>
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="brick">Brick</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                    <SelectItem value="hex">Hexagonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Element Size */}
              <div className="border-b p-4">
                <SliderInput label="Element Size" value={elementSize} onChange={setElementSize} min={20} max={200} step={2} />
              </div>

              {/* Spacing */}
              <div className="border-b p-4 space-y-4">
                <SliderInput label="H Spacing" value={hSpacing} onChange={setHSpacing} min={0} max={200} step={2} />
                <SliderInput label="V Spacing" value={vSpacing} onChange={setVSpacing} min={0} max={200} step={2} />
              </div>

              {/* Row Offset - only for layouts with offset */}
              {hasOffset && (
                <div className="border-b p-4">
                  <SliderInput label="Row Offset" value={rowOffset} onChange={setRowOffset} min={0} max={100} step={1} suffix="%" />
                </div>
              )}

              {/* Angle */}
              <div className="border-b p-4">
                <SliderInput label="Rotation" value={angle} onChange={setAngle} min={-180} max={180} step={1} suffix="°" />
              </div>

              {/* Colors */}
              <div className="p-4">
                {logoColors.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logo Color</p>
                    <div className="flex flex-wrap gap-2">
                      {logoColors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedLogo(c.hex)}
                          className={`h-8 w-8 rounded-xl transition-all ${activeLogo === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"}`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setTransparentBg(true); setSelectedBg(null); }}
                      className={`h-8 w-8 rounded-xl border transition-all ${transparentBg ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"}`}
                      style={checkerStyle}
                      title="Transparent"
                    />
                    {bgColors.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setTransparentBg(false); setSelectedBg(c.hex); }}
                        className={`h-8 w-8 rounded-xl transition-all ${!transparentBg && activeBg === c.hex ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Center Stage */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
            {patternSvg ? (
              <div
                className="rounded-2xl overflow-hidden shadow-lg border"
                style={transparentBg ? checkerStyle : undefined}
              >
                <div dangerouslySetInnerHTML={{ __html: patternSvg }} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select at least one logo to generate a pattern</p>
            )}
          </div>

          {patternSvg && (
            <div className="flex justify-center border-t px-4 py-3">
              <button
                onClick={() => setExportOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-semibold text-background transition-all hover:opacity-90 hover:shadow-md"
              >
                <Download className="h-3.5 w-3.5" /> Export Pattern
              </button>
            </div>
          )}
          <AppFooter />
        </div>
      </div>

      {exportOpen && patternSvg && (
        <PatternExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          svgContent={patternSvg}
          projectName={`${project.name}-pattern`}
          bgColor={activeBg}
        />
      )}
    </div>
  );
}
