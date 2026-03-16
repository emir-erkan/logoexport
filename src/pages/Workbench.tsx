import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LeftRail } from "@/components/workbench/LeftRail";
import { CenterStage } from "@/components/workbench/CenterStage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;
type ProjectColor = Tables<"project_colors">;
type ProjectFile = Tables<"project_files">;

function getFileType(fileName: string): "svg" | "png" {
  return fileName.toLowerCase().endsWith(".svg") ? "svg" : "png";
}

export default function Workbench() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [colors, setColors] = useState<ProjectColor[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"svg" | "png">("svg");
  const [editing, setEditing] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    if (data) {
      setProject(data);
      setProjectName(data.name);
    }
  }, [id]);

  const fetchColors = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("project_colors")
      .select("*")
      .eq("project_id", id)
      .order("sort_order");
    setColors(data || []);
  }, [id]);

  const fetchFiles = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("project_files").select("*").eq("project_id", id);
    setFiles(data || []);
    // Auto-select first file if none selected
    if (data && data.length > 0 && !selectedFileId) {
      loadFileContent(data[0]);
      setSelectedFileId(data[0].id);
    } else if (data && data.length === 0) {
      setFileContent(null);
      setSelectedFileId(null);
    } else if (data && selectedFileId) {
      // Reload content if selected file still exists
      const selected = data.find((f) => f.id === selectedFileId);
      if (selected) {
        loadFileContent(selected);
      } else if (data.length > 0) {
        loadFileContent(data[0]);
        setSelectedFileId(data[0].id);
      }
    }
  }, [id, selectedFileId]);

  const loadFileContent = async (file: ProjectFile) => {
    const type = getFileType(file.file_name);
    setFileType(type);

    if (type === "svg") {
      const { data: fileData } = await supabase.storage.from("logos").download(file.storage_path);
      if (fileData) {
        setFileContent(await fileData.text());
      }
    } else {
      // PNG: use public URL
      const { data } = supabase.storage.from("logos").getPublicUrl(file.storage_path);
      setFileContent(data.publicUrl);
    }
  };

  const handleFileSelect = useCallback(async (fileId: string) => {
    setSelectedFileId(fileId);
    const file = files.find((f) => f.id === fileId);
    if (file) {
      await loadFileContent(file);
    }
  }, [files]);

  useEffect(() => {
    fetchProject();
    fetchColors();
    fetchFiles();
  }, [fetchProject, fetchColors, fetchFiles]);

  const updateName = async () => {
    if (!project || !projectName.trim()) return;
    await supabase.from("projects").update({ name: projectName.trim() }).eq("id", project.id);
    setEditing(false);
    fetchProject();
  };

  const copyShareLink = () => {
    if (!project) return;
    const url = `${window.location.origin}/shared/${project.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Share link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editing ? (
            <Input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={updateName}
              onKeyDown={(e) => e.key === "Enter" && updateName()}
              className="h-7 w-48 text-sm"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
            >
              {project.name}
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={copyShareLink}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Share"}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LeftRail
          projectId={project.id}
          colors={colors}
          files={files}
          selectedFileId={selectedFileId}
          fileContent={fileContent}
          onColorsChange={fetchColors}
          onFilesChange={fetchFiles}
          onFileSelect={handleFileSelect}
        />
        <CenterStage
          colors={colors}
          fileContent={fileContent}
          fileType={fileType}
          projectName={project.name}
        />
      </div>
    </div>
  );
}
