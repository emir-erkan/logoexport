import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LeftRail } from "@/components/workbench/LeftRail";
import { CenterStage, type LoadedFile } from "@/components/workbench/CenterStage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
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

  const loadAllFileContents = useCallback(async (fileList: ProjectFile[]) => {
    const results: LoadedFile[] = [];
    for (const file of fileList) {
      const type = getFileType(file.file_name);
      if (type === "svg") {
        const { data: fileData } = await supabase.storage.from("logos").download(file.storage_path);
        if (fileData) {
          results.push({ file, content: await fileData.text(), type });
        }
      } else {
        const { data } = supabase.storage.from("logos").getPublicUrl(file.storage_path);
        results.push({ file, content: data.publicUrl, type });
      }
    }
    setLoadedFiles(results);
  }, []);

  const fetchFiles = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("project_files").select("*").eq("project_id", id);
    const fileList = data || [];
    setFiles(fileList);
    await loadAllFileContents(fileList);
    if (fileList.length > 0 && !selectedFileId) {
      setSelectedFileId(fileList[0].id);
      await loadSingleFileContent(fileList[0]);
    } else if (fileList.length === 0) {
      setFileContent(null);
      setSelectedFileId(null);
    } else if (selectedFileId) {
      const selected = fileList.find((f) => f.id === selectedFileId);
      if (selected) {
        await loadSingleFileContent(selected);
      } else if (fileList.length > 0) {
        setSelectedFileId(fileList[0].id);
        await loadSingleFileContent(fileList[0]);
      }
    }
  }, [id, selectedFileId, loadAllFileContents]);

  const loadSingleFileContent = async (file: ProjectFile) => {
    const type = getFileType(file.file_name);
    setFileType(type);
    if (type === "svg") {
      const { data: fileData } = await supabase.storage.from("logos").download(file.storage_path);
      if (fileData) {
        setFileContent(await fileData.text());
      }
    } else {
      const { data } = supabase.storage.from("logos").getPublicUrl(file.storage_path);
      setFileContent(data.publicUrl);
    }
  };

  const handleFileSelect = useCallback(async (fileId: string) => {
    setSelectedFileId(fileId);
    const file = files.find((f) => f.id === fileId);
    if (file) {
      await loadSingleFileContent(file);
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
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editing ? (
            <Input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={updateName}
              onKeyDown={(e) => e.key === "Enter" && updateName()}
              className="h-8 w-48 rounded-lg text-sm"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors"
            >
              {project.name}
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={copyShareLink}>
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
          loadedFiles={loadedFiles}
          projectName={project.name}
        />
      </div>
    </div>
  );
}
