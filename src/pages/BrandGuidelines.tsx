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
                  Marka Kimliği<br />Kılavuzu
                </h1>
                <p className="mt-4 text-sm opacity-60" style={{ color: "#fff" }}>
                  {project.name} — {new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                </p>
              </div>
              {/* Decorative circles */}
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-10" style={{ background: "#fff" }} />
              <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full opacity-5" style={{ background: "#fff" }} />
            </section>

            {/* ABOUT */}
            <section className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Bu kılavuz hakkında</p>
              <h2 className="text-2xl font-bold tracking-tight">Hakkında</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Bu kılavuz, <strong className="text-foreground">{project.name}</strong> markasının görsel kimliğinin doğru ve tutarlı biçimde uygulanması için hazırlanmıştır.
                Logo kullanımından renk paletine, tipografiden uygulama örneklerine kadar tüm temel görsel unsurları kapsamaktadır.
                Bu kılavuzda yer alan kurallara tüm kullanım senaryolarında sadık kalınması önerilir. Aksi uygulamalar marka bütünlüğünü zedeleyebilir.
              </p>
            </section>

            {/* LOGOS */}
            <section id="logos" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">01</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Logolar</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Logo farklı varyasyonlarda sunulmaktadır. Her varyasyon, farklı kullanım senaryoları ve yerleşim alanları için tasarlanmıştır.
                  Ana logo her zaman ilk tercih olmalıdır; diğer varyasyonlar yalnızca alan kısıtı veya tasarım gereklilikleri doğrultusunda kullanılmalıdır.
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
                  <p className="text-sm text-muted-foreground">Henüz logo yüklenmedi. Logo Dışa Aktarma aracında SVG dosyaları yükleyin.</p>
                </div>
              )}
            </section>

            {/* SPACING */}
            <section id="spacing" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">02</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Logo Alanı & Minimum Boyutlar</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Logonun çevresinde her zaman yeterli boşluk bırakılmalıdır. Bu alan içerisinde herhangi bir grafik, metin veya tasarım unsuru yer almamalıdır.
                  Minimum boşluk mesafesi, ikon yüksekliği baz alınarak <strong className="text-foreground">2×</strong> olarak belirlenmiştir.
                </p>
              </div>

              {loadedSvgs[0] && (
                <div className="rounded-2xl border bg-card p-12">
                  <div className="relative mx-auto flex items-center justify-center" style={{ maxWidth: 400, minHeight: 260 }}>
                    {/* Dashed boundary */}
                    <div className="absolute inset-0 rounded-xl border-2 border-dashed border-muted-foreground/30" />
                    {/* Spacing labels */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">2x</div>
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">2x</div>
                    <div className="absolute -left-7 top-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">2x</div>
                    <div className="absolute -right-7 top-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">2x</div>
                    {/* Dimension lines */}
                    <div className="absolute top-0 left-1/2 h-[60px] w-px -translate-x-1/2 bg-muted-foreground/20" />
                    <div className="absolute bottom-0 left-1/2 h-[60px] w-px -translate-x-1/2 bg-muted-foreground/20" />
                    <div className="absolute left-0 top-1/2 h-px w-[60px] -translate-y-1/2 bg-muted-foreground/20" />
                    <div className="absolute right-0 top-1/2 h-px w-[60px] -translate-y-1/2 bg-muted-foreground/20" />
                    <div
                      className="w-[140px]"
                      dangerouslySetInnerHTML={{
                        __html: loadedSvgs[0].content
                          .replace(/width="[^"]*"/, 'width="140"')
                          .replace(/height="[^"]*"/, 'height="auto"')
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dijital</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Ana logo (dikey)</span><span className="font-mono font-semibold">min 220px yükseklik</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Yatay logo</span><span className="font-mono font-semibold">min 300px genişlik</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Yalnızca ikon</span><span className="font-mono font-semibold">min 80px yükseklik</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Yalnızca yazı tipi</span><span className="font-mono font-semibold">min 150px genişlik</span></div>
                  </div>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Baskı</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Ana logo (dikey)</span><span className="font-mono font-semibold">min 60mm yükseklik</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Yatay logo</span><span className="font-mono font-semibold">min 80mm genişlik</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Yalnızca ikon</span><span className="font-mono font-semibold">min 25mm yükseklik</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Yalnızca yazı tipi</span><span className="font-mono font-semibold">min 40mm genişlik</span></div>
                  </div>
                </div>
              </div>
            </section>

            {/* MISUSE */}
            <section id="misuse" className="space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">03</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Hatalı Kullanım</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Aşağıdaki kullanımlar marka bütünlüğünü zedeleyebilir ve kaçınılması önerilir.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Logonun oranlarını bozmayın", style: { transform: "scaleX(1.5) scaleY(0.7)" } },
                  { label: "Logoyu döndürmeyin veya eğmeyin", style: { transform: "rotate(15deg) skewX(10deg)" } },
                  { label: "Onaysız renkler kullanmayın", style: { filter: "hue-rotate(120deg) saturate(2)" } },
                  { label: "Logoya gölge veya efekt eklemeyin", style: { filter: "drop-shadow(4px 4px 6px rgba(0,0,0,0.5))" } },
                  { label: "Arka planla düşük kontrast oluşturmayın", style: { opacity: 0.15 } },
                  { label: "Minimum boyutun altında kullanmayın", style: { transform: "scale(0.25)" } },
                ].map((rule, i) => (
                  <div key={i} className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-card">
                      {loadedSvgs[0] ? (
                        <div
                          style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <div
                            style={rule.style}
                            dangerouslySetInnerHTML={{
                              __html: loadedSvgs[0].content
                                .replace(/width="[^"]*"/, 'width="60"')
                                .replace(/height="[^"]*"/, 'height="60"')
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted" />
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
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Renk Paleti</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Marka renkleri, <strong className="text-foreground">{project.name}</strong> görsel kimliğinin temel taşlarından birini oluşturmaktadır.
                  Bu renkler logo, tipografi ve tüm iletişim materyallerinde tutarlı biçimde uygulanmalıdır.
                  Dijital ortamlarda HEX veya RGB değerleri, baskı uygulamalarında ise CMYK değerleri kullanılması önerilir.
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
                  <p className="text-sm text-muted-foreground">Henüz renk tanımlanmadı. Logo Dışa Aktarma aracında renkler ekleyin.</p>
                </div>
              )}

              {/* Logo on color backgrounds */}
              {loadedSvgs[0] && colors.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Marka Renkleri Üzerinde Logo</h3>
                  <p className="text-sm text-muted-foreground">Maksimum görsel etki ve okunabilirlik için onaylı logo ve arka plan renk kombinasyonları.</p>
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
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Tipografi</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Tipografi, markanın kişiliğini ifade etmede kilit bir rol oynar. Net bir tipografik hiyerarşi, tüm materyallerde tutarlılık ve profesyonellik sağlar.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border p-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Başlıklar</p>
                  <div className="space-y-3">
                    <p className="text-3xl font-bold tracking-tight">Aa Bb Cc Çç Dd</p>
                    <p className="text-xl font-semibold">Ee Ff Gg Ğğ Hh</p>
                    <p className="text-base font-medium">Iı İi Jj Kk Ll</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Başlıklar, hero bölümleri ve yüksek etkili iletişim için kullanılır.</p>
                </div>
                <div className="rounded-2xl border p-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gövde / Arayüz</p>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">SemiBold — Alt başlıklar</p>
                    <p className="text-sm font-medium">Medium — Etiketler, vurgu</p>
                    <p className="text-sm">Regular — Gövde metni, açıklamalar</p>
                    <p className="text-sm font-light text-muted-foreground">Light — Destekleyici metin</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Gövde metni, arayüz unsurları ve genel amaçlı iletişim için kullanılır.</p>
                </div>
              </div>

              <div className="rounded-2xl border p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Yazı Tipi Ölçeği</p>
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
