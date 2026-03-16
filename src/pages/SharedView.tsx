import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CenterStage, type LoadedFile } from "@/components/workbench/CenterStage";
import type { Tables } from "@/integrations/supabase/types";

type ProjectColor = Tables<"project_colors">;

interface SharedProject {
  id: string;
  name: string;
  share_token: string;
}

interface SharedFile {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
}

function getFileType(fileName: string): "svg" | "png" {
  return fileName.toLowerCase().endsWith(".svg") ? "svg" : "png";
}

export default function SharedView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [colors, setColors] = useState<ProjectColor[]>([]);
  const [allFiles, setAllFiles] = useState<SharedFile[]>([]);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadAllFiles = async (files: SharedFile[]) => {
    const results: LoadedFile[] = [];
    for (const file of files) {
      const type = getFileType(file.file_name);
      if (type === "svg") {
        const { data: fileBlob } = await supabase.storage.from("logos").download(file.storage_path);
        if (fileBlob) {
          results.push({
            file: { ...file, created_at: "" } as any,
            content: await fileBlob.text(),
            type,
          });
        }
      } else {
        const { data } = supabase.storage.from("logos").getPublicUrl(file.storage_path);
        results.push({
          file: { ...file, created_at: "" } as any,
          content: data.publicUrl,
          type,
        });
      }
    }
    setLoadedFiles(results);
  };

  useEffect(() => {
    if (!shareToken) return;
    const load = async () => {
      const { data: projects } = await supabase.rpc("get_project_by_share_token", { token: shareToken });
      if (!projects || projects.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProject(projects[0]);

      const { data: colorsData } = await supabase.rpc("get_project_colors_by_share_token", { token: shareToken });
      setColors((colorsData as ProjectColor[]) || []);

      const { data: filesData } = await supabase.rpc("get_project_files_by_share_token", { token: shareToken });
      const files = (filesData as SharedFile[]) || [];
      setAllFiles(files);
      await loadAllFiles(files);
      setLoading(false);
    };
    load();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-lg font-medium text-foreground">Project not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">This share link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Chromatype</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-sm font-medium text-foreground">{project.name}</span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Client sidebar: read-only palette */}
        <div className="w-64 border-r bg-card p-4 overflow-y-auto">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Palette</p>
          <div className="space-y-2">
            {colors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                <div className="h-6 w-6 shrink-0 rounded" style={{ backgroundColor: c.hex }} />
                <span className="font-mono text-xs text-muted-foreground">{c.hex}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase">{c.role}</span>
              </div>
            ))}
          </div>
        </div>
        <CenterStage
          colors={colors}
          loadedFiles={loadedFiles}
          projectName={project.name}
          readOnly
        />
      </div>
    </div>
  );
}
