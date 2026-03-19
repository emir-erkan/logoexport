import { useEffect, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LogOut, Folder, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;

export default function Projects() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    const { error } = await supabase.from("projects").insert({ name: newName.trim(), user_id: user.id });
    if (error) toast.error(error.message);
    else {
      setNewName("");
      setCreating(false);
      fetchProjects();
    }
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project and all its data?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) toast.error(error.message);
    else fetchProjects();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-5">
        <h1 className="text-xl font-bold tracking-tight">Chromatype</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Projects</h2>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 rounded-xl">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>

        <AnimatePresence>
          {creating && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={createProject}
              className="mb-4 flex gap-2"
            >
              <Input
                autoFocus
                placeholder="Project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-11 rounded-xl bg-card text-sm"
              />
              <Button type="submit" size="sm" className="h-11 rounded-xl px-6">Create</Button>
              <Button type="button" variant="ghost" size="sm" className="h-11 rounded-xl" onClick={() => setCreating(false)}>Cancel</Button>
            </motion.form>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60">
              <Folder className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No projects yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group relative cursor-pointer rounded-2xl border bg-card p-5 transition-all hover:border-foreground/10 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{project.name}</h3>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => deleteProject(project.id, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
