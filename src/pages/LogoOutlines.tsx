import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, PanelLeftClose, PanelLeft, Download } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Tables } from "@/integrations/supabase/types";

type ProjectFile = Tables<"project_files">;

type ViewMode = "outline" | "safespace" | "grid";

export default function LogoOutlines() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  // Settings
  const [viewMode, setViewMode] = useState<ViewMode>("outline");
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [strokeColor, setStrokeColor] = useState("#1a1a1a");
  const [showFill, setShowFill] = useState(false);
  const [safeSpaceMultiplier, setSafeSpaceMultiplier] = useState(1);
  const [safeSpaceUnit, setSafeSpaceUnit] = useState<"x" | "percent">("x");
  const [showGrid, setShowGrid] = useState(true);
  const [gridDensity, setGridDensity] = useState(8);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showCenterLines, setShowCenterLines] = useState(true);
  const [bgColor, setBgColor] = useState("#ffffff");

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [{ data: proj }, { data: fileData }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", id).single(),
      supabase.from("project_files").select("*").eq("project_id", id),
    ]);
    if (proj) setProjectName(proj.name);
    const fileList = fileData || [];
    setFiles(fileList);
    const svgFiles = fileList.filter(f => f.file_name.toLowerCase().endsWith(".svg"));
    if (svgFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(svgFiles[0].id);
      await loadSvg(svgFiles[0]);
    }
  }, [id]);

  const loadSvg = async (file: ProjectFile) => {
    const { data } = await supabase.storage.from("logos").download(file.storage_path);
    if (data) setSvgContent(await data.text());
  };

  const handleFileSelect = useCallback(async (fileId: string) => {
    setSelectedFileId(fileId);
    const file = files.find(f => f.id === fileId);
    if (file) await loadSvg(file);
  }, [files]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const svgFiles = useMemo(() => files.filter(f => f.file_name.toLowerCase().endsWith(".svg")), [files]);

  const processedSvg = useMemo(() => {
    if (!svgContent) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    const viewBox = svg.getAttribute("viewBox");
    const vbParts = viewBox?.split(/[\s,]+/).map(Number) || [0, 0, 100, 100];
    const [vbX, vbY, vbW, vbH] = vbParts;

    // Clone for outline processing
    const outlineSvg = svg.cloneNode(true) as SVGSVGElement;

    if (!showFill) {
      // Convert fills to strokes
      const allElements = outlineSvg.querySelectorAll("path, circle, ellipse, rect, polygon, polyline, line, g");
      allElements.forEach((el) => {
        if (el.tagName === "g") return;
        const elem = el as SVGElement;
        elem.setAttribute("fill", "none");
        elem.setAttribute("stroke", strokeColor);
        elem.setAttribute("stroke-width", String(strokeWidth));
        elem.style.fill = "none";
        elem.style.stroke = strokeColor;
        elem.style.strokeWidth = String(strokeWidth);
      });
    }

    const outlineHtml = outlineSvg.outerHTML;

    return { outlineHtml, vbX, vbY, vbW, vbH };
  }, [svgContent, strokeWidth, strokeColor, showFill]);

  const renderSafeSpaceOverlay = () => {
    if (!processedSvg || viewMode !== "safespace") return null;
    const { vbW, vbH } = processedSvg;

    // Safe space is based on the smaller dimension
    const unit = Math.min(vbW, vbH);
    const space = safeSpaceUnit === "x"
      ? unit * safeSpaceMultiplier * 0.1
      : (unit * safeSpaceMultiplier) / 100;

    return (
      <svg className="absolute inset-0 w-full h-full" viewBox={`${processedSvg.vbX - space} ${processedSvg.vbY - space} ${vbW + space * 2} ${vbH + space * 2}`} preserveAspectRatio="xMidYMid meet">
        {/* Outer boundary */}
        <rect
          x={processedSvg.vbX - space}
          y={processedSvg.vbY - space}
          width={vbW + space * 2}
          height={vbH + space * 2}
          fill="none"
          stroke="hsl(217, 80%, 56%)"
          strokeWidth={vbW * 0.003}
          strokeDasharray={`${vbW * 0.01} ${vbW * 0.006}`}
        />
        {/* Inner logo boundary */}
        <rect
          x={processedSvg.vbX}
          y={processedSvg.vbY}
          width={vbW}
          height={vbH}
          fill="none"
          stroke="hsl(217, 80%, 56%)"
          strokeWidth={vbW * 0.002}
          opacity={0.5}
        />
        {/* Space indicators */}
        {/* Top */}
        <line x1={processedSvg.vbX + vbW / 2} y1={processedSvg.vbY - space} x2={processedSvg.vbX + vbW / 2} y2={processedSvg.vbY} stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.002} />
        {/* Bottom */}
        <line x1={processedSvg.vbX + vbW / 2} y1={processedSvg.vbY + vbH} x2={processedSvg.vbX + vbW / 2} y2={processedSvg.vbY + vbH + space} stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.002} />
        {/* Left */}
        <line x1={processedSvg.vbX - space} y1={processedSvg.vbY + vbH / 2} x2={processedSvg.vbX} y2={processedSvg.vbY + vbH / 2} stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.002} />
        {/* Right */}
        <line x1={processedSvg.vbX + vbW} y1={processedSvg.vbY + vbH / 2} x2={processedSvg.vbX + vbW + space} y2={processedSvg.vbY + vbH / 2} stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.002} />
        {/* Labels */}
        <text x={processedSvg.vbX + vbW / 2 + vbW * 0.02} y={processedSvg.vbY - space / 2} fill="hsl(0, 68%, 55%)" fontSize={vbW * 0.025} fontFamily="DM Sans">
          {safeSpaceUnit === "x" ? `${safeSpaceMultiplier}x` : `${safeSpaceMultiplier}%`}
        </text>
      </svg>
    );
  };

  const renderGridOverlay = () => {
    if (!processedSvg || viewMode !== "grid") return null;
    const { vbX, vbY, vbW, vbH } = processedSvg;

    const lines: React.ReactNode[] = [];
    const stepX = vbW / gridDensity;
    const stepY = vbH / gridDensity;

    if (showGrid) {
      for (let i = 0; i <= gridDensity; i++) {
        lines.push(
          <line key={`gx-${i}`} x1={vbX + i * stepX} y1={vbY} x2={vbX + i * stepX} y2={vbY + vbH} stroke="hsl(217, 80%, 56%)" strokeWidth={vbW * 0.001} opacity={0.3} />,
          <line key={`gy-${i}`} x1={vbX} y1={vbY + i * stepY} x2={vbX + vbW} y2={vbY + i * stepY} stroke="hsl(217, 80%, 56%)" strokeWidth={vbW * 0.001} opacity={0.3} />
        );
      }
    }

    if (showCenterLines) {
      lines.push(
        <line key="cx" x1={vbX + vbW / 2} y1={vbY} x2={vbX + vbW / 2} y2={vbY + vbH} stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.002} strokeDasharray={`${vbW * 0.008} ${vbW * 0.004}`} />,
        <line key="cy" x1={vbX} y1={vbY + vbH / 2} x2={vbX + vbW} y2={vbY + vbH / 2} stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.002} strokeDasharray={`${vbW * 0.008} ${vbW * 0.004}`} />
      );
    }

    if (showAnchors) {
      const anchorSize = vbW * 0.012;
      const anchors = [
        [vbX, vbY], [vbX + vbW, vbY], [vbX, vbY + vbH], [vbX + vbW, vbY + vbH],
        [vbX + vbW / 2, vbY], [vbX + vbW / 2, vbY + vbH],
        [vbX, vbY + vbH / 2], [vbX + vbW, vbY + vbH / 2],
        [vbX + vbW / 2, vbY + vbH / 2],
      ];
      anchors.forEach(([cx, cy], i) => {
        lines.push(
          <circle key={`a-${i}`} cx={cx} cy={cy} r={anchorSize} fill="hsl(0, 68%, 55%)" opacity={0.8} />,
          <circle key={`ao-${i}`} cx={cx} cy={cy} r={anchorSize * 2} fill="none" stroke="hsl(0, 68%, 55%)" strokeWidth={vbW * 0.001} opacity={0.4} />
        );
      });
    }

    return (
      <svg className="absolute inset-0 w-full h-full" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
        {lines}
      </svg>
    );
  };

  const handleExportSvg = () => {
    if (!processedSvg || !svgContent) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return;
    const { vbX, vbY, vbW, vbH } = processedSvg;

    // Build a combined SVG
    const ns = "http://www.w3.org/2000/svg";
    const exportSvg = document.createElementNS(ns, "svg");
    const padding = viewMode === "safespace"
      ? (() => {
          const unit = Math.min(vbW, vbH);
          return safeSpaceUnit === "x" ? unit * safeSpaceMultiplier * 0.1 : (unit * safeSpaceMultiplier) / 100;
        })()
      : 0;

    exportSvg.setAttribute("viewBox", `${vbX - padding} ${vbY - padding} ${vbW + padding * 2} ${vbH + padding * 2}`);
    exportSvg.setAttribute("xmlns", ns);
    exportSvg.setAttribute("width", String(vbW + padding * 2));
    exportSvg.setAttribute("height", String(vbH + padding * 2));

    // Add bg
    const bgRect = document.createElementNS(ns, "rect");
    bgRect.setAttribute("x", String(vbX - padding));
    bgRect.setAttribute("y", String(vbY - padding));
    bgRect.setAttribute("width", String(vbW + padding * 2));
    bgRect.setAttribute("height", String(vbH + padding * 2));
    bgRect.setAttribute("fill", bgColor);
    exportSvg.appendChild(bgRect);

    // Add the outline svg content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = processedSvg.outlineHtml;
    const innerSvg = tempDiv.querySelector("svg");
    if (innerSvg) {
      Array.from(innerSvg.children).forEach(child => {
        exportSvg.appendChild(child.cloneNode(true));
      });
    }

    const blob = new Blob([exportSvg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-${viewMode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{projectName}</span>
          <span className="text-xs text-muted-foreground">/ Outlines</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={handleExportSvg}>
            <Download className="h-3.5 w-3.5" /> Export SVG
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail */}
        {collapsed ? (
          <div className="flex h-full w-11 flex-col items-center border-r bg-card pt-3">
            <button onClick={() => setCollapsed(false)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex h-full w-72 flex-col border-r bg-card md:w-80">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
              <button onClick={() => setCollapsed(true)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* File Selector */}
              <div className="border-b p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">SVG File</p>
                {svgFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No SVG files in project. Upload SVGs in Logo Export first.</p>
                ) : (
                  <div className="space-y-1.5">
                    {svgFiles.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleFileSelect(f.id)}
                        className={`w-full flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all text-xs ${
                          selectedFileId === f.id
                            ? "border-foreground/20 bg-accent shadow-sm"
                            : "border-transparent hover:bg-accent/50"
                        }`}
                      >
                        <span className="truncate font-mono">{f.file_name.replace(/\.\w+$/, "")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Mode */}
              <div className="border-b p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">View Mode</p>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <TabsList className="w-full rounded-xl bg-muted">
                    <TabsTrigger value="outline" className="flex-1 rounded-lg text-xs">Outline</TabsTrigger>
                    <TabsTrigger value="safespace" className="flex-1 rounded-lg text-xs">Safe Space</TabsTrigger>
                    <TabsTrigger value="grid" className="flex-1 rounded-lg text-xs">Grid</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Outline Settings */}
              {viewMode === "outline" && (
                <div className="border-b p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outline</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Stroke Width</Label>
                      <span className="text-xs font-mono text-muted-foreground">{strokeWidth}px</span>
                    </div>
                    <Slider value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} min={0.5} max={5} step={0.25} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Stroke Color</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-8 w-8 rounded-lg border cursor-pointer" />
                      <span className="text-xs font-mono text-muted-foreground">{strokeColor}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Fill</Label>
                    <Switch checked={showFill} onCheckedChange={setShowFill} />
                  </div>
                </div>
              )}

              {/* Safe Space Settings */}
              {viewMode === "safespace" && (
                <div className="border-b p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Safe Space</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Multiplier</Label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {safeSpaceUnit === "x" ? `${safeSpaceMultiplier}x` : `${safeSpaceMultiplier}%`}
                      </span>
                    </div>
                    <Slider
                      value={[safeSpaceMultiplier]}
                      onValueChange={([v]) => setSafeSpaceMultiplier(v)}
                      min={safeSpaceUnit === "x" ? 0.5 : 5}
                      max={safeSpaceUnit === "x" ? 5 : 50}
                      step={safeSpaceUnit === "x" ? 0.25 : 5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Unit</Label>
                    <Tabs value={safeSpaceUnit} onValueChange={(v) => setSafeSpaceUnit(v as "x" | "percent")}>
                      <TabsList className="w-full rounded-xl bg-muted">
                        <TabsTrigger value="x" className="flex-1 rounded-lg text-xs">Multiplier (x)</TabsTrigger>
                        <TabsTrigger value="percent" className="flex-1 rounded-lg text-xs">Percent (%)</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              )}

              {/* Grid Settings */}
              {viewMode === "grid" && (
                <div className="border-b p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Construction Grid</p>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Grid</Label>
                    <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                  </div>
                  {showGrid && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Grid Density</Label>
                        <span className="text-xs font-mono text-muted-foreground">{gridDensity}</span>
                      </div>
                      <Slider value={[gridDensity]} onValueChange={([v]) => setGridDensity(v)} min={4} max={24} step={1} />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Center Lines</Label>
                    <Switch checked={showCenterLines} onCheckedChange={setShowCenterLines} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Anchor Points</Label>
                    <Switch checked={showAnchors} onCheckedChange={setShowAnchors} />
                  </div>
                </div>
              )}

              {/* Background */}
              <div className="p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background</p>
                <div className="flex gap-2 items-center">
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-8 w-8 rounded-lg border cursor-pointer" />
                  <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center Stage */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-8" style={{ backgroundColor: bgColor }}>
          {processedSvg ? (
            <div className="relative w-full max-w-2xl aspect-square">
              <div
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: processedSvg.outlineHtml }}
              />
              {renderSafeSpaceOverlay()}
              {renderGridOverlay()}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Select an SVG file to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
