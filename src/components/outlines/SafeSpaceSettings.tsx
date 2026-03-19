import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  multiplier: number;
  setMultiplier: (v: number) => void;
  showDimensions: boolean;
  setShowDimensions: (v: boolean) => void;
  safeSpaceColor: string;
  setSafeSpaceColor: (v: string) => void;
}

export default function SafeSpaceSettings({
  multiplier, setMultiplier,
  showDimensions, setShowDimensions,
  safeSpaceColor, setSafeSpaceColor,
}: Props) {
  return (
    <div className="space-y-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Safe Space</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Clear Zone Multiplier</Label>
          <span className="text-[11px] font-mono text-muted-foreground">{multiplier}x</span>
        </div>
        <Slider value={[multiplier]} onValueChange={([v]) => setMultiplier(v)} min={0.5} max={5} step={0.25} />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        The clear zone is measured using the smallest bounding element of the logo (e.g. the icon or crest). 
        The element is placed at each corner to visualize the required spacing.
      </p>

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
