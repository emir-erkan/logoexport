import { useEffect, useState, useCallback } from "react";
import { AppFooter } from "@/components/AppFooter";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Palette, PenTool, BookOpen, LayoutGrid, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;

const tools = [
  {
    id: "export",
    title: "Logo Export",
    description: "Stress-test your logo across color combinations. Export as PNG, PDF, or batch ZIP.",
    icon: Palette,
    path: "export",
    color: "from-rose-500/10 to-orange-500/10 dark:from-rose-500/20 dark:to-orange-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "outlines",
    title: "Logo Outlines",
    description: "Generate outline views, safe space guides, anchor grids, and construction overlays.",
    icon: PenTool,
    path: "outlines",
    color: "from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    comingSoon: true,
  },
  {
    id: "patterns",
    title: "Pattern Generator",
    description: "Create infinitely repeating patterns from your logos with grid, brick, and hex layouts.",
    icon: LayoutGrid,
    path: "patterns",
    color: "from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "guidelines",
    title: "Brand Guidelines",
    description: "Generate comprehensive brand documentation from editable templates.",
    icon: BookOpen,
    path: "guidelines",
    color: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    comingSoon: true,
  },
];

export default function ProjectHub() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
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

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateName = async () => {
    if (!project || !projectName.trim()) return;
    await supabase.from("projects").update({ name: projectName.trim() }).eq("id", project.id);
    setEditing(false);
    fetchProject();
  };

  const copyShareLink = () => {
    if (!project) return;
    const url = `https://logoexport.lovable.app/shared/${project.share_token}`;
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
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate("/projects")}>
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={copyShareLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-8">
          <h2 className="text-lg font-bold tracking-tight">Tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a tool to work with your brand assets.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => !tool.comingSoon && navigate(`/projects/${id}/${tool.path}`)}
              className={`group relative cursor-pointer rounded-2xl border bg-card p-6 transition-all ${
                tool.comingSoon
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-foreground/10 hover:-translate-y-1 hover:shadow-lg"
              }`}
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.color}`}>
                <tool.icon className={`h-5 w-5 ${tool.iconColor}`} />
              </div>
              <h3 className="text-sm font-semibold">{tool.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{tool.description}</p>
              {tool.comingSoon && (
                <span className="absolute right-4 top-4 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Soon
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
