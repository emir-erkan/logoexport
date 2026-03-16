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

export default function SharedView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [colors, setColors] = useState<ProjectColor[]>([]);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareToken) return;

    const load = async () => {
      // Fetch project
      const { data: projects } = await supabase.rpc("get_project_by_share_token", { token: shareToken });
      if (!projects || projects.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const proj = projects[0];
      setProject(proj);

      // Fetch colors
      const { data: colorsData } = await supabase.rpc("get_project_colors_by_share_token", { token: shareToken });
      setColors((colorsData as ProjectColor[]) || []);

      // Fetch files
      const { data: filesData } = await supabase.rpc("get_project_files_by_share_token", { token: shareToken });
      if (filesData && filesData.length > 0) {
        const { data: fileBlob } = await supabase.storage.from("logos").download(filesData[0].storage_path);
        if (fileBlob) {
          const text = await fileBlob.text();
          setSvgContent(text);
        }
      }

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
        {/* Client view: colors sidebar (read-only) */}
        <div className="w-64 border-r bg-card p-4">
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
          svgContent={svgContent}
          projectName={project.name}
          readOnly
        />
      </div>
    </div>
  );
}
