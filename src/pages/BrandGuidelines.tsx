import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppFooter } from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;
type ProjectColor = Tables<"project_colors">;
type ProjectFile = Tables<"project_files">;

interface LoadedSvg {
  file: ProjectFile;
  content: string;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function hexToHsl(hex: string): string {
  const h = hex.replace("#", "");
  let r = parseInt(h.substring(0, 2), 16) / 255;
  let g = parseInt(h.substring(2, 4), 16) / 255;
  let b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(hue * 360)}°, ${Math.round(sat * 100)}%, ${Math.round(l * 100)}%`;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const rs = parseInt(h.substring(0, 2), 16) / 255;
  const gs = parseInt(h.substring(2, 4), 16) / 255;
  const bs = parseInt(h.substring(4, 6), 16) / 255;
  const r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.5;
}

const NAV_ITEMS = [
  { id: "cover", label: "Kapak" },
  { id: "logos", label: "Logolar" },
  { id: "spacing", label: "Boşluk & Boyut" },
  { id: "misuse", label: "Hatalı Kullanım" },
  { id: "colors", label: "Renkler" },
  { id: "typography", label: "Tipografi" },
];

export default function BrandGuidelines() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [colors, setColors] = useState<ProjectColor[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loadedSvgs, setLoadedSvgs] = useState<LoadedSvg[]>([]);
  const [editing, setEditing] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState("cover");

  const fetchProject = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    if (data) { setProject(data); setProjectName(data.name); }
  }, [id]);

  const fetchColors = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("project_colors").select("*").eq("project_id", id).order("sort_order");
    setColors(data || []);
  }, [id]);

  const fetchFiles = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("project_files").select("*").eq("project_id", id);
    const fileList = data || [];
    setFiles(fileList);
    const svgs: LoadedSvg[] = [];
    for (const file of fileList) {
      if (file.file_name.toLowerCase().endsWith(".svg")) {
        const { data: fileData } = await supabase.storage.from("logos").download(file.storage_path);
        if (fileData) svgs.push({ file, content: await fileData.text() });
      }
    }
    setLoadedSvgs(svgs);
  }, [id]);

  useEffect(() => { fetchProject(); fetchColors(); fetchFiles(); }, [fetchProject, fetchColors, fetchFiles]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0.1 }
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [project]);

  const updateName = async () => {
    if (!project || !projectName.trim()) return;
    await supabase.from("projects").update({ name: projectName.trim() }).eq("id", project.id);
    setEditing(false);
    fetchProject();
  };

  const copyShareLink = () => {
    if (!project) return;
    navigator.clipboard.writeText(`https://logoexport.lovable.app/shared/${project.share_token}`);
    setCopied(true);
    toast.success("Share link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollTo = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20" />
      </div>
    );
  }

  const primaryColor = colors.find(c => c.role === "foreground" || c.role === "both");
  const brandDark = primaryColor?.hex || "#0F1218";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editing ? (
            <Input
              autoFocus value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={updateName}
              onKeyDown={(e) => e.key === "Enter" && updateName()}
              className="h-8 w-48 rounded-lg text-sm"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors">
              {project.name}
            </button>
          )}
          <span className="text-xs text-muted-foreground">/ Marka Kimliği Kılavuzu</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={copyShareLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Side navigation */}
        <aside className="hidden w-52 shrink-0 border-r lg:block">
          <nav className="flex flex-col gap-0.5 p-3 pt-6">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  activeSection === item.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-4xl px-6 py-12 space-y-24">

            {/* COVER */}
            <section id="cover" className="relative overflow-hidden rounded-3xl p-12 md:p-20" style={{ background: brandDark, minHeight: 420 }}>
              <div className="relative z-10 flex flex-col justify-end h-full min-h-[280px]">
                {loadedSvgs[0] && (
                  <div className="mb-8 w-24 h-24 opacity-90" dangerouslySetInnerHTML={{
                    __html: loadedSvgs[0].content.replace(/fill="[^"]*"/g, 'fill="white"').replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"')
                  }} />
                )}
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight" style={{ color: "#fff" }}>
                  Brand Identity<br />Guidelines
                </h1>
                <p className="mt-4 text-sm opacity-60" style={{ color: "#fff" }}>
                  {project.name} — {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
              {/* Decorative circles */}
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-10" style={{ background: "#fff" }} />
              <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full opacity-5" style={{ background: "#fff" }} />
            </section>

            {/* ABOUT */}
            <section className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About this guide</p>
              <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                This guide ensures the consistent and correct application of <strong className="text-foreground">{project.name}</strong>'s visual identity.
                From logo usage to color palettes, typography to application examples, it covers all fundamental visual elements.
                Adhering to these guidelines across all use cases is recommended. Inconsistent applications may undermine brand integrity.
              </p>
            </section>

            {/* LOGOS */}
            <section id="logos" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">01</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Logo Variants</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  The logo is presented in multiple variants. Each variant is designed for different use cases and layout spaces.
                  The primary logo should always be the first choice; other variants should only be used when layout constraints require them.
                </p>
              </div>

              {loadedSvgs.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {loadedSvgs.map((svg, i) => {
                    const label = svg.file.file_name.replace(/\.svg$/i, "").replace(/[-_]/g, " ");
                    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
                    return (
                      <div key={svg.file.id} className="group rounded-2xl border bg-card overflow-hidden">
                        <div className="flex items-center justify-center p-8 checker-bg min-h-[180px]">
                          <div
                            className="max-w-[200px] max-h-[120px]"
                            dangerouslySetInnerHTML={{
                              __html: svg.content
                                .replace(/width="[^"]*"/, 'width="100%"')
                                .replace(/height="[^"]*"/, 'height="100%"')
                            }}
                          />
                        </div>
                        <div className="border-t p-4">
                          <p className="text-xs font-semibold text-muted-foreground">{letters[i] || String(i + 1)}</p>
                          <p className="mt-0.5 text-sm font-semibold capitalize">{label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-12 text-center">
                  <p className="text-sm text-muted-foreground">No logos uploaded yet. Upload SVG files in the Logo Export tool.</p>
                </div>
              )}
            </section>

            {/* SPACING */}
            <section id="spacing" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">02</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Clear Space & Minimum Sizes</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Sufficient clear space must always be maintained around the logo. No graphics, text, or design elements should appear within this area.
                  The minimum clear space is defined as <strong className="text-foreground">2×</strong> the height of the icon element on all sides.
                </p>
              </div>

              {loadedSvgs[0] && (
                <div className="rounded-2xl border bg-card p-8">
                  <div className="relative mx-auto flex items-center justify-center" style={{ maxWidth: 360 }}>
                    {/* Dashed boundary */}
                    <div className="absolute inset-0 rounded-xl border-2 border-dashed border-muted-foreground/20" />
                    {/* Spacing labels */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground">2x</div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground">2x</div>
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">2x</div>
                    <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">2x</div>
                    <div
                      className="m-12 max-w-[180px]"
                      dangerouslySetInnerHTML={{
                        __html: loadedSvgs[0].content
                          .replace(/width="[^"]*"/, 'width="100%"')
                          .replace(/height="[^"]*"/, 'height="100%"')
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Digital</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Primary logo</span><span className="font-mono font-semibold">min 220px height</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Horizontal logo</span><span className="font-mono font-semibold">min 300px width</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Icon only</span><span className="font-mono font-semibold">min 80px height</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Wordmark only</span><span className="font-mono font-semibold">min 150px width</span></div>
                  </div>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Print</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Primary logo</span><span className="font-mono font-semibold">min 60mm height</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Horizontal logo</span><span className="font-mono font-semibold">min 80mm width</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Icon only</span><span className="font-mono font-semibold">min 25mm height</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Wordmark only</span><span className="font-mono font-semibold">min 40mm width</span></div>
                  </div>
                </div>
              </div>
            </section>

            {/* MISUSE */}
            <section id="misuse" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">03</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Incorrect Usage</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  The following uses may damage brand integrity and should be avoided at all times.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Don't distort proportions", transform: "scaleX(1.4)" },
                  { label: "Don't rotate or skew", transform: "rotate(15deg)" },
                  { label: "Don't use unapproved colors", filter: "hue-rotate(120deg)" },
                  { label: "Don't add shadows or effects", filter: "drop-shadow(4px 4px 6px rgba(0,0,0,0.5))" },
                  { label: "Don't use low contrast", opacity: "0.2" },
                  { label: "Don't go below minimum size", transform: "scale(0.3)" },
                ].map((rule, i) => (
                  <div key={i} className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="mb-3 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-background">
                      {loadedSvgs[0] && (
                        <div
                          className="max-w-[60px]"
                          style={{
                            transform: rule.transform,
                            filter: rule.filter,
                            opacity: rule.opacity,
                          }}
                          dangerouslySetInnerHTML={{
                            __html: loadedSvgs[0].content
                              .replace(/width="[^"]*"/, 'width="100%"')
                              .replace(/height="[^"]*"/, 'height="100%"')
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">✕</span>
                      <p className="text-xs leading-snug text-muted-foreground">{rule.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* COLORS */}
            <section id="colors" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">04</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Color Palette</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Brand colors form a core pillar of <strong className="text-foreground">{project.name}</strong>'s visual identity.
                  These colors should be applied consistently across logo, typography, and all communication materials.
                  Use HEX or RGB values for digital; CMYK for print.
                </p>
              </div>

              {colors.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {colors.map((color) => (
                    <div key={color.id} className="rounded-2xl border bg-card overflow-hidden">
                      <div className="h-28" style={{ background: color.hex }} />
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{color.label || color.role}</p>
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{color.role}</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground font-mono">
                          <p>HEX {color.hex.toUpperCase()}</p>
                          <p>RGB {hexToRgb(color.hex)}</p>
                          <p>HSL {hexToHsl(color.hex)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-12 text-center">
                  <p className="text-sm text-muted-foreground">No colors defined. Add colors in the Logo Export tool.</p>
                </div>
              )}

              {/* Logo on color backgrounds */}
              {loadedSvgs[0] && colors.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Logo on Brand Colors</h3>
                  <p className="text-sm text-muted-foreground">Approved logo and background color combinations for maximum visual impact and readability.</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colors.map((color) => {
                      const light = isLightColor(color.hex);
                      const logoColor = light ? "#000000" : "#FFFFFF";
                      return (
                        <div key={color.id} className="flex h-36 items-center justify-center rounded-2xl border" style={{ background: color.hex }}>
                          <div
                            className="max-w-[100px]"
                            dangerouslySetInnerHTML={{
                              __html: loadedSvgs[0].content
                                .replace(/fill="[^"]*"/g, `fill="${logoColor}"`)
                                .replace(/width="[^"]*"/, 'width="100%"')
                                .replace(/height="[^"]*"/, 'height="100%"')
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* TYPOGRAPHY */}
            <section id="typography" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">05</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Typography</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Typography plays a key role in expressing the brand's personality. A clear typographic hierarchy ensures consistency and professionalism across all materials.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border p-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Display / Headlines</p>
                  <div className="space-y-3">
                    <p className="text-3xl font-bold tracking-tight">Aa Bb Cc Dd</p>
                    <p className="text-xl font-semibold">Ee Ff Gg Hh Ii</p>
                    <p className="text-base font-medium">Jj Kk Ll Mm Nn</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Used for headlines, hero sections, and high-impact communication.</p>
                </div>
                <div className="rounded-2xl border p-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Body / UI</p>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">SemiBold — Subheadings</p>
                    <p className="text-sm font-medium">Medium — Labels, emphasis</p>
                    <p className="text-sm">Regular — Body text, descriptions</p>
                    <p className="text-sm font-light text-muted-foreground">Light — Supporting text</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Used for body text, UI elements, and all general-purpose communication.</p>
                </div>
              </div>

              <div className="rounded-2xl border p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Type Scale</p>
                <div className="space-y-3">
                  {[
                    { name: "Display", size: "48px", weight: "Bold", cls: "text-5xl font-bold" },
                    { name: "H1", size: "36px", weight: "Bold", cls: "text-4xl font-bold" },
                    { name: "H2", size: "28px", weight: "SemiBold", cls: "text-3xl font-semibold" },
                    { name: "H3", size: "22px", weight: "SemiBold", cls: "text-xl font-semibold" },
                    { name: "Body", size: "16px", weight: "Regular", cls: "text-base" },
                    { name: "Small", size: "14px", weight: "Regular", cls: "text-sm" },
                    { name: "Caption", size: "12px", weight: "Medium", cls: "text-xs font-medium" },
                  ].map((item) => (
                    <div key={item.name} className="flex items-baseline gap-4 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{item.size}</span>
                      <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">{item.weight}</span>
                      <span className={item.cls}>{project.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Footer */}
            <section className="border-t pt-8 pb-4 text-center">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} {project.name}. All rights reserved.
              </p>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
