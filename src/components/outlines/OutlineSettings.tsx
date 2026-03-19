import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AnchorShape = "circle" | "square" | "diamond";
export type AnchorFilter = "all" | "corners" | "edges" | "curves";

interface Props {
  strokeWidth: number;
  setStrokeWidth: (v: number) => void;
  strokeColor: string;
  setStrokeColor: (v: string) => void;
  showFill: boolean;
  setShowFill: (v: boolean) => void;
  showAnchors: boolean;
  setShowAnchors: (v: boolean) => void;
  anchorShape: AnchorShape;
  setAnchorShape: (v: AnchorShape) => void;
  anchorSize: number;
  setAnchorSize: (v: number) => void;
  anchorFilter: AnchorFilter;
  setAnchorFilter: (v: AnchorFilter) => void;
  maxAnchors: number;
  setMaxAnchors: (v: number) => void;
}

export default function OutlineSettings({
  strokeWidth, setStrokeWidth,
  strokeColor, setStrokeColor,
  showFill, setShowFill,
  showAnchors, setShowAnchors,
  anchorShape, setAnchorShape,
  anchorSize, setAnchorSize,
  anchorFilter, setAnchorFilter,
  maxAnchors, setMaxAnchors,
}: Props) {
  return (
    <div className="space-y-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Outline</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Stroke Width</Label>
          <span className="text-[11px] font-mono text-muted-foreground">{strokeWidth}px</span>
        </div>
        <Slider value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} min={0.25} max={5} step={0.25} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Stroke Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded-lg border border-border cursor-pointer bg-transparent" />
          <span className="text-[11px] font-mono text-muted-foreground">{strokeColor}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Show Original Fill</Label>
        <Switch checked={showFill} onCheckedChange={setShowFill} />
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between">
        <Label className="text-xs">Show Anchor Points</Label>
        <Switch checked={showAnchors} onCheckedChange={setShowAnchors} />
      </div>

      {showAnchors && (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Anchor Shape</Label>
            <Tabs value={anchorShape} onValueChange={(v) => setAnchorShape(v as AnchorShape)}>
              <TabsList className="w-full rounded-xl bg-muted h-8">
                <TabsTrigger value="circle" className="flex-1 rounded-lg text-[11px] h-6">Circle</TabsTrigger>
                <TabsTrigger value="square" className="flex-1 rounded-lg text-[11px] h-6">Square</TabsTrigger>
                <TabsTrigger value="diamond" className="flex-1 rounded-lg text-[11px] h-6">Diamond</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Anchor Size</Label>
              <span className="text-[11px] font-mono text-muted-foreground">{anchorSize}</span>
            </div>
            <Slider value={[anchorSize]} onValueChange={([v]) => setAnchorSize(v)} min={1} max={8} step={0.5} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Anchor Filter</Label>
            <Tabs value={anchorFilter} onValueChange={(v) => setAnchorFilter(v as AnchorFilter)}>
              <TabsList className="w-full rounded-xl bg-muted h-8">
                <TabsTrigger value="all" className="flex-1 rounded-lg text-[11px] h-6">All</TabsTrigger>
                <TabsTrigger value="corners" className="flex-1 rounded-lg text-[11px] h-6">Corners</TabsTrigger>
                <TabsTrigger value="edges" className="flex-1 rounded-lg text-[11px] h-6">Edges</TabsTrigger>
                <TabsTrigger value="curves" className="flex-1 rounded-lg text-[11px] h-6">Curves</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Max Anchors</Label>
              <span className="text-[11px] font-mono text-muted-foreground">{maxAnchors}</span>
            </div>
            <Slider value={[maxAnchors]} onValueChange={([v]) => setMaxAnchors(v)} min={4} max={200} step={1} />
          </div>
        </>
      )}
    </div>
  );
}
