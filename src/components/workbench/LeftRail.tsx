import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { isValidHex } from "@/lib/color-utils";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;
type ProjectFile = Tables<"project_files">;

interface LeftRailProps {
  projectId: string;
  colors: ProjectColor[];
  files: ProjectFile[];
  svgContent: string | null;
  onColorsChange: () => void;
  onFilesChange: () => void;
  onSvgContentChange: (content: string | null) => void;
}

export function LeftRail({
  projectId,
  colors,
  files,
  svgContent,
  onColorsChange,
  onFilesChange,
  onSvgContentChange,
}: LeftRailProps) {
  const [uploading, setUploading] = useState(false);
  const [newHex, setNewHex] = useState("#");

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".svg")) {
      toast.error("Only SVG files are supported");
      return;
    }
    setUploading(true);
    try {
      const path = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file);
      if (uploadError) throw uploadError;

      // Delete old files for this project
      for (const f of files) {
        await supabase.storage.from("logos").remove([f.storage_path]);
        await supabase.from("project_files").delete().eq("id", f.id);
      }

      await supabase.from("project_files").insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: path,
      });

      // Read SVG content
      const text = await file.text();
      onSvgContentChange(text);
      onFilesChange();
      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }, [projectId, files, onFilesChange, onSvgContentChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const addColor = async () => {
    const hex = newHex.startsWith("#") ? newHex : `#${newHex}`;
    if (!isValidHex(hex)) {
      toast.error("Invalid hex color");
      return;
    }
    const { error } = await supabase.from("project_colors").insert({
      project_id: projectId,
      hex,
      role: "both",
      sort_order: colors.length,
    });
    if (error) toast.error(error.message);
    else {
      setNewHex("#");
      onColorsChange();
    }
  };

  const updateColorRole = async (id: string, role: string) => {
    await supabase.from("project_colors").update({ role }).eq("id", id);
    onColorsChange();
  };

  const updateColorHex = async (id: string, hex: string) => {
    if (!isValidHex(hex)) return;
    await supabase.from("project_colors").update({ hex }).eq("id", id);
    onColorsChange();
  };

  const deleteColor = async (id: string) => {
    await supabase.from("project_colors").delete().eq("id", id);
    onColorsChange();
  };

  const roleButton = (color: ProjectColor, role: string, label: string) => (
    <button
      onClick={() => updateColorRole(color.id, role)}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
        color.role === role || color.role === "both"
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full w-80 flex-col border-r bg-card">
      {/* SVG Upload */}
      <div className="border-b p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Source File</p>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors hover:border-foreground/20"
        >
          {svgContent ? (
            <div className="checker-bg flex h-full w-full items-center justify-center p-6">
              <div dangerouslySetInnerHTML={{ __html: svgContent }} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" />
            </div>
          ) : (
            <div className="dot-grid flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">Drop SVG here</span>
            </div>
          )}
          <input
            type="file"
            accept=".svg"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Upload className="h-5 w-5 animate-pulse text-muted-foreground" />
            </div>
          )}
        </div>
        {files[0] && (
          <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{files[0].file_name}</p>
        )}
      </div>

      {/* Palette */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Palette</p>
        <div className="space-y-2">
          {colors.map((color) => (
            <div key={color.id} className="flex items-center gap-2 rounded-lg border bg-background p-2">
              <div
                className="h-8 w-8 shrink-0 rounded"
                style={{ backgroundColor: color.hex }}
              />
              <Input
                defaultValue={color.hex}
                onBlur={(e) => updateColorHex(color.id, e.target.value)}
                className="h-7 flex-1 border-0 bg-transparent px-1 font-mono text-xs"
              />
              <div className="flex gap-1">
                {roleButton(color, "logo", "L")}
                {roleButton(color, "background", "B")}
                {roleButton(color, "both", "✦")}
              </div>
              <button onClick={() => deleteColor(color.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add color */}
        <div className="mt-3 flex gap-2">
          <Input
            value={newHex}
            onChange={(e) => setNewHex(e.target.value)}
            placeholder="#000000"
            className="h-8 flex-1 font-mono text-xs"
            onKeyDown={(e) => e.key === "Enter" && addColor()}
          />
          <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={addColor}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
