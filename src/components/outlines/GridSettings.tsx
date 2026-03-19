import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  gridDensity: number;
  setGridDensity: (v: number) => void;
  showCenterLines: boolean;
  setShowCenterLines: (v: boolean) => void;
  showConstructionLines: boolean;
  setShowConstructionLines: (v: boolean) => void;
  showBoundingBoxes: boolean;
  setShowBoundingBoxes: (v: boolean) => void;
  showDimensions: boolean;
  setShowDimensions: (v: boolean) => void;
  gridColor: string;
  setGridColor: (v: string) => void;
  dimensionColor: string;
  setDimensionColor: (v: string) => void;
}

export default function GridSettings({
  showGrid, setShowGrid,
  gridDensity, setGridDensity,
  showCenterLines, setShowCenterLines,
  showConstructionLines, setShowConstructionLines,
  showBoundingBoxes, setShowBoundingBoxes,
  showDimensions, setShowDimensions,
  gridColor, setGridColor,
  dimensionColor, setDimensionColor,
}: Props) {
  return (
    <div className="space-y-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Construction Grid</p>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Base Grid</Label>
        <Switch checked={showGrid} onCheckedChange={setShowGrid} />
      </div>

      {showGrid && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Grid Density</Label>
            <span className="text-[11px] font-mono text-muted-foreground">{gridDensity}</span>
          </div>
          <Slider value={[gridDensity]} onValueChange={([v]) => setGridDensity(v)} min={4} max={32} step={1} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-xs">Center Lines</Label>
        <Switch checked={showCenterLines} onCheckedChange={setShowCenterLines} />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Construction Lines</Label>
        <Switch checked={showConstructionLines} onCheckedChange={setShowConstructionLines} />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Construction lines extend from element boundaries to show spatial relationships 
        between logo parts — distances, alignment, and proportions.
      </p>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Bounding Boxes</Label>
        <Switch checked={showBoundingBoxes} onCheckedChange={setShowBoundingBoxes} />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Show Dimensions</Label>
        <Switch checked={showDimensions} onCheckedChange={setShowDimensions} />
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-2">
        <Label className="text-xs">Grid Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={gridColor} onChange={e => setGridColor(e.target.value)} className="h-7 w-7 rounded-lg border border-border cursor-pointer bg-transparent" />
          <span className="text-[11px] font-mono text-muted-foreground">{gridColor}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Dimension Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={dimensionColor} onChange={e => setDimensionColor(e.target.value)} className="h-7 w-7 rounded-lg border border-border cursor-pointer bg-transparent" />
          <span className="text-[11px] font-mono text-muted-foreground">{dimensionColor}</span>
        </div>
      </div>
    </div>
  );
}
