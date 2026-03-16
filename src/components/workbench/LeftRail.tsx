import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Upload, Image as ImageIcon, FileImage, Check } from "lucide-react";
import { toast } from "sonner";
import { isValidHex } from "@/lib/color-utils";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;
type ProjectFile = Tables<"project_files">;

interface LeftRailProps {
  projectId: string;
  colors: ProjectColor[];
  files: ProjectFile[];
  selectedFileId: string | null;
  fileContent: string | null;
  onColorsChange: () => void;
  onFilesChange: () => void;
  onFileSelect: (fileId: string) => void;
}

const ACCEPTED_TYPES = ".svg,.png";
const ACCEPTED_MIME = ["image/svg+xml", "image/png"];

function getFileType(fileName: string): "svg" | "png" {
  return fileName.toLowerCase().endsWith(".svg") ? "svg" : "png";
}

export function LeftRail({
  projectId,
  colors,
  files,
  selectedFileId,
  fileContent,
  onColorsChange,
  onFilesChange,
  onFileSelect,
}: LeftRailProps) {
  const [uploading, setUploading] = useState(false);
  const [newHex, setNewHex] = useState("#");

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;
  const selectedFileType = selectedFile ? getFileType(selectedFile.file_name) : null;

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "svg" && ext !== "png") {
      toast.error("Only SVG and PNG files are supported");
      return;
    }
    setUploading(true);
    try {
      const path = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: inserted } = await supabase.from("project_files").insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: path,
      }).select().single();

      onFilesChange();
      if (inserted) {
        onFileSelect(inserted.id);
      }
      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }, [projectId, onFilesChange, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const deleteFile = async (fileId: string, storagePath: string) => {
    await supabase.storage.from("logos").remove([storagePath]);
    await supabase.from("project_files").delete().eq("id", fileId);
    onFilesChange();
    toast.success("File deleted");
  };

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
      {/* Logo Files */}
      <div className="border-b p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Logo Files</p>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-3 space-y-1">
            {files.map((f) => (
              <div
                key={f.id}
                className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${
                  selectedFileId === f.id
                    ? "border-foreground/30 bg-accent"
                    : "border-transparent hover:bg-accent/50"
                }`}
                onClick={() => onFileSelect(f.id)}
              >
                <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-xs text-foreground">{f.file_name}</span>
                <span className="text-[10px] uppercase text-muted-foreground/50">
                  {getFileType(f.file_name)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFile(f.id, f.storage_path); }}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Preview of selected file */}
        {selectedFile && fileContent && (
          <div className="mb-3 overflow-hidden rounded-lg border">
            <div className="checker-bg flex aspect-[3/2] w-full items-center justify-center p-4">
              {selectedFileType === "svg" ? (
                <div dangerouslySetInnerHTML={{ __html: fileContent }} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" />
              ) : (
                <img src={fileContent} alt={selectedFile.file_name} className="h-full w-full object-contain" />
              )}
            </div>
          </div>
        )}

        {/* Upload dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative flex h-20 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed transition-colors hover:border-foreground/20"
        >
          <div className="dot-grid flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/40">
            <ImageIcon className="h-5 w-5" />
            <span className="text-[10px]">Drop SVG or PNG</span>
          </div>
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
              <Upload className="h-5 w-5 animate-pulse text-muted-foreground" />
            </div>
          )}
        </div>
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
