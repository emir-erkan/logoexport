import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ElementBBox } from "@/lib/svg-anchor-utils";

interface Props {
  multiplier: number;
  setMultiplier: (v: number) => void;
  showDimensions: boolean;
  setShowDimensions: (v: boolean) => void;
  safeSpaceColor: string;
  setSafeSpaceColor: (v: string) => void;
  elementBBoxes: ElementBBox[];
  selectedElementIndex: number;
  setSelectedElementIndex: (v: number) => void;
}

export default function SafeSpaceSettings({
  multiplier, setMultiplier,
  showDimensions, setShowDimensions,
  safeSpaceColor, setSafeSpaceColor,
  elementBBoxes, selectedElementIndex, setSelectedElementIndex,
}: Props) {
  const selectedBox = elementBBoxes[selectedElementIndex];

  return (
    <div className="space-y-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Safe Space</p>

      {elementBBoxes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Reference Element</Label>
          <Select
            value={String(selectedElementIndex)}
            onValueChange={(v) => setSelectedElementIndex(Number(v))}
          >
            <SelectTrigger className="h-8 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {elementBBoxes.map((box, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">
                  {box.label} ({Math.round(box.width)}×{Math.round(box.height)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This element is used as the measurement unit. The safe space equals {multiplier}× its size placed around the logo.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Clear Zone Multiplier</Label>
          <span className="text-[11px] font-mono text-muted-foreground">{multiplier}x</span>
        </div>
        <Slider value={[multiplier]} onValueChange={([v]) => setMultiplier(v)} min={0.5} max={5} step={0.25} />
      </div>

      {selectedBox && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <p className="text-[10px] text-muted-foreground">Unit size: <span className="font-mono font-medium text-foreground">{Math.round(Math.min(selectedBox.width, selectedBox.height))}</span> → Space: <span className="font-mono font-medium text-foreground">{Math.round(Math.min(selectedBox.width, selectedBox.height) * multiplier)}</span></p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Guide Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={safeSpaceColor} onChange={e => setSafeSpaceColor(e.target.value)} className="h-7 w-7 rounded-lg border border-border cursor-pointer bg-transparent" />
          <span className="text-[11px] font-mono text-muted-foreground">{safeSpaceColor}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Show Dimensions</Label>
        <Switch checked={showDimensions} onCheckedChange={setShowDimensions} />
      </div>
    </div>
  );
}
