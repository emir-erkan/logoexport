import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CenterStage } from "@/components/workbench/CenterStage";
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
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"svg" | "png">("svg");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadFileContent = async (file: SharedFile) => {
    const type = getFileType(file.file_name);
    setFileType(type);
    if (type === "svg") {
      const { data: fileBlob } = await supabase.storage.from("logos").download(file.storage_path);
      if (fileBlob) setFileContent(await fileBlob.text());
    } else {
      const { data } = supabase.storage.from("logos").getPublicUrl(file.storage_path);
      setFileContent(data.publicUrl);
    }
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
      if (files.length > 0) {
        setSelectedFileId(files[0].id);
        await loadFileContent(files[0]);
      }
      setLoading(false);
    };
    load();
  }, [shareToken]);

  const handleFileSelect = async (fileId: string) => {
    setSelectedFileId(fileId);
    const file = allFiles.find((f) => f.id === fileId);
    if (file) await loadFileContent(file);
  };

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
        {/* Client sidebar: read-only palette + file selector */}
        <div className="w-64 border-r bg-card p-4 overflow-y-auto">
          {/* File selector */}
          {allFiles.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Logos</p>
              <div className="space-y-1">
                {allFiles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFileSelect(f.id)}
                    className={`w-full text-left rounded-lg border p-2 text-xs font-mono transition-colors ${
                      selectedFileId === f.id
                        ? "border-foreground/30 bg-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    {f.file_name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
          fileContent={fileContent}
          fileType={fileType}
          projectName={project.name}
          readOnly
        />
      </div>
    </div>
  );
}
