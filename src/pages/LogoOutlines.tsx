import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, PanelLeftClose, PanelLeft, Download } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Tables } from "@/integrations/supabase/types";
import OutlineSettings, { type AnchorShape, type AnchorFilterType } from "@/components/outlines/OutlineSettings";
import SafeSpaceSettings from "@/components/outlines/SafeSpaceSettings";
import GridSettings from "@/components/outlines/GridSettings";
import AnchorOverlay from "@/components/outlines/AnchorOverlay";
import SafeSpaceOverlay from "@/components/outlines/SafeSpaceOverlay";
import GridOverlay from "@/components/outlines/GridOverlay";
import { extractAllAnchors, extractElementBBoxes, type AnchorPoint, type ElementBBox } from "@/lib/svg-anchor-utils";

type ProjectFile = Tables<"project_files">;
type ViewMode = "outline" | "safespace" | "grid";

export default function LogoOutlines() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hiddenSvgRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("outline");
  const [bgColor, setBgColor] = useState("#ffffff");

  // Outline settings
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [strokeColor, setStrokeColor] = useState("#1a1a1a");
  const [fillColor, setFillColor] = useState("#000000");
  const [showFill, setShowFill] = useState(false);
  const [showAnchors, setShowAnchors] = useState(true);
  const [anchorShape, setAnchorShape] = useState<AnchorShape>("circle");
  const [anchorSize, setAnchorSize] = useState(3);
  const [anchorFilters, setAnchorFilters] = useState<AnchorFilterType[]>(["corners", "edges", "curves"]);
  const [maxAnchors, setMaxAnchors] = useState(80);

  // Safe space
  const [safeSpaceMultiplier, setSafeSpaceMultiplier] = useState(2);
  const [showSSDimensions, setShowSSDimensions] = useState(true);
  const [safeSpaceColor, setSafeSpaceColor] = useState("#3b82f6");
  const [ssElementIndex, setSsElementIndex] = useState(0);

  // Grid
  const [showGrid, setShowGrid] = useState(true);
  const [gridDensity, setGridDensity] = useState(8);
  const [showCenterLines, setShowCenterLines] = useState(true);
  const [showConstructionLines, setShowConstructionLines] = useState(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showGridDimensions, setShowGridDimensions] = useState(true);
  const [gridColor, setGridColor] = useState("#3b82f6");
  const [dimensionColor, setDimensionColor] = useState("#ef4444");

  // Extracted data
  const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
  const [elementBBoxes, setElementBBoxes] = useState<ElementBBox[]>([]);

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

  // Process SVG: extract outlines
  const processedSvg = useMemo(() => {
    if (!svgContent) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    const viewBox = svg.getAttribute("viewBox");
    const vbParts = viewBox?.split(/[\s,]+/).map(Number) || [0, 0, 100, 100];
    const [vbX, vbY, vbW, vbH] = vbParts;

    // Ensure preserveAspectRatio matches overlays
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const outlineSvg = svg.cloneNode(true) as SVGSVGElement;
    outlineSvg.querySelectorAll("path, circle, ellipse, rect, polygon, polyline, line").forEach((el) => {
      const elem = el as SVGElement;
      if (showFill) {
        elem.setAttribute("fill", fillColor);
        elem.style.fill = fillColor;
      } else {
        elem.setAttribute("fill", "none");
        elem.style.fill = "none";
      }
      elem.setAttribute("stroke", strokeColor);
      elem.setAttribute("stroke-width", String(strokeWidth));
      elem.style.stroke = strokeColor;
      elem.style.strokeWidth = String(strokeWidth);
    });

    return { outlineHtml: outlineSvg.outerHTML, vbX, vbY, vbW, vbH };
  }, [svgContent, strokeWidth, strokeColor, showFill, fillColor]);

  // Extract anchors and bboxes using a hidden rendered SVG
  useEffect(() => {
    if (!svgContent || !hiddenSvgRef.current) return;
    hiddenSvgRef.current.innerHTML = svgContent;
    const svg = hiddenSvgRef.current.querySelector("svg");
    if (!svg) return;

    requestAnimationFrame(() => {
      setAnchors(extractAllAnchors(svg));
      setElementBBoxes(extractElementBBoxes(svg));
    });
  }, [svgContent]);

  const handleExportSvg = () => {
    if (!processedSvg || !svgContent) return;
    const { vbX, vbY, vbW, vbH } = processedSvg;
    const ns = "http://www.w3.org/2000/svg";
    const exportSvg = document.createElementNS(ns, "svg");
    const padding = viewMode === "safespace"
      ? Math.min(vbW, vbH) * 0.15 * safeSpaceMultiplier
      : 0;

    exportSvg.setAttribute("viewBox", `${vbX - padding} ${vbY - padding} ${vbW + padding * 2} ${vbH + padding * 2}`);
    exportSvg.setAttribute("xmlns", ns);
    exportSvg.setAttribute("width", String(vbW + padding * 2));
    exportSvg.setAttribute("height", String(vbH + padding * 2));

    const bgRect = document.createElementNS(ns, "rect");
    bgRect.setAttribute("x", String(vbX - padding));
    bgRect.setAttribute("y", String(vbY - padding));
    bgRect.setAttribute("width", String(vbW + padding * 2));
    bgRect.setAttribute("height", String(vbH + padding * 2));
    bgRect.setAttribute("fill", bgColor);
    exportSvg.appendChild(bgRect);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = processedSvg.outlineHtml;
    const innerSvg = tempDiv.querySelector("svg");
    if (innerSvg) {
      Array.from(innerSvg.children).forEach(child => exportSvg.appendChild(child.cloneNode(true)));
    }

    const blob = new Blob([exportSvg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-${viewMode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Hidden SVG for bbox extraction */}
      <div ref={hiddenSvgRef} className="absolute -left-[9999px] w-0 h-0 overflow-hidden" aria-hidden="true" />

      <header className="flex h-12 items-center justify-between border-b border-border/60 px-4">
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
          <div className="flex h-full w-11 flex-col items-center border-r border-border/60 bg-card pt-3">
            <button onClick={() => setCollapsed(false)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex h-full w-72 flex-col border-r border-border/60 bg-card md:w-80">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Settings</p>
              <button onClick={() => setCollapsed(true)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* File Selector */}
              <div className="border-b border-border/60 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">SVG File</p>
                {svgFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No SVG files. Upload SVGs in Logo Export first.</p>
                ) : (
                  <div className="space-y-1">
                    {svgFiles.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleFileSelect(f.id)}
                        className={`w-full flex items-center gap-2 rounded-xl border p-2 text-left transition-all text-xs ${
                          selectedFileId === f.id
                            ? "border-primary/30 bg-accent shadow-sm"
                            : "border-transparent hover:bg-accent/50"
                        }`}
                      >
                        <span className="truncate font-mono text-[11px]">{f.file_name.replace(/\.\w+$/, "")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Mode */}
              <div className="border-b border-border/60 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">View Mode</p>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <TabsList className="w-full rounded-xl bg-muted h-9">
                    <TabsTrigger value="outline" className="flex-1 rounded-lg text-xs">Outline</TabsTrigger>
                    <TabsTrigger value="safespace" className="flex-1 rounded-lg text-xs">Safe Space</TabsTrigger>
                    <TabsTrigger value="grid" className="flex-1 rounded-lg text-xs">Grid</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Mode-specific settings */}
              <div className="border-b border-border/60 p-4">
                {viewMode === "outline" && (
                  <OutlineSettings
                    strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
                    strokeColor={strokeColor} setStrokeColor={setStrokeColor}
                    fillColor={fillColor} setFillColor={setFillColor}
                    showFill={showFill} setShowFill={setShowFill}
                    showAnchors={showAnchors} setShowAnchors={setShowAnchors}
                    anchorShape={anchorShape} setAnchorShape={setAnchorShape}
                    anchorSize={anchorSize} setAnchorSize={setAnchorSize}
                    anchorFilters={anchorFilters} setAnchorFilters={setAnchorFilters}
                    maxAnchors={maxAnchors} setMaxAnchors={setMaxAnchors}
                  />
                )}
                {viewMode === "safespace" && (
                  <SafeSpaceSettings
                    multiplier={safeSpaceMultiplier} setMultiplier={setSafeSpaceMultiplier}
                    showDimensions={showSSDimensions} setShowDimensions={setShowSSDimensions}
                    safeSpaceColor={safeSpaceColor} setSafeSpaceColor={setSafeSpaceColor}
                    elementBBoxes={elementBBoxes}
                    selectedElementIndex={ssElementIndex}
                    setSelectedElementIndex={setSsElementIndex}
                  />
                )}
                {viewMode === "grid" && (
                  <GridSettings
                    showGrid={showGrid} setShowGrid={setShowGrid}
                    gridDensity={gridDensity} setGridDensity={setGridDensity}
                    showCenterLines={showCenterLines} setShowCenterLines={setShowCenterLines}
                    showConstructionLines={showConstructionLines} setShowConstructionLines={setShowConstructionLines}
                    showBoundingBoxes={showBoundingBoxes} setShowBoundingBoxes={setShowBoundingBoxes}
                    showDimensions={showGridDimensions} setShowDimensions={setShowGridDimensions}
                    gridColor={gridColor} setGridColor={setGridColor}
                    dimensionColor={dimensionColor} setDimensionColor={setDimensionColor}
                  />
                )}
              </div>

              {/* Background */}
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Background</p>
                <div className="flex gap-2 items-center">
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-7 w-7 rounded-lg border border-border cursor-pointer bg-transparent" />
                  <span className="text-[11px] font-mono text-muted-foreground">{bgColor}</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {["#ffffff", "#f5f5f4", "#1a1a1a", "#0a0a0a", "#1e293b"].map(c => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className={`h-6 w-6 rounded-lg border transition-all ${bgColor === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border hover:scale-110"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center Stage */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-8" style={{ backgroundColor: bgColor }}>
          {processedSvg ? (
            <div className="relative w-full max-w-2xl aspect-square flex items-center justify-center">
              <div
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: processedSvg.outlineHtml }}
              />
              {viewMode === "outline" && showAnchors && (
                <AnchorOverlay
                  anchors={anchors}
                  vbX={processedSvg.vbX} vbY={processedSvg.vbY}
                  vbW={processedSvg.vbW} vbH={processedSvg.vbH}
                  anchorShape={anchorShape} anchorSize={anchorSize}
                  anchorFilters={anchorFilters} maxAnchors={maxAnchors}
                  strokeColor={strokeColor}
                />
              )}
              {viewMode === "safespace" && (
                <SafeSpaceOverlay
                  vbX={processedSvg.vbX} vbY={processedSvg.vbY}
                  vbW={processedSvg.vbW} vbH={processedSvg.vbH}
                  multiplier={safeSpaceMultiplier}
                  showDimensions={showSSDimensions}
                  safeSpaceColor={safeSpaceColor}
                  referenceElement={elementBBoxes[ssElementIndex] || null}
                />
              )}
              {viewMode === "grid" && (
                <GridOverlay
                  vbX={processedSvg.vbX} vbY={processedSvg.vbY}
                  vbW={processedSvg.vbW} vbH={processedSvg.vbH}
                  showGrid={showGrid} gridDensity={gridDensity}
                  showCenterLines={showCenterLines}
                  showConstructionLines={showConstructionLines}
                  showBoundingBoxes={showBoundingBoxes}
                  showDimensions={showGridDimensions}
                  gridColor={gridColor} dimensionColor={dimensionColor}
                  elementBBoxes={elementBBoxes}
                />
              )}
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
