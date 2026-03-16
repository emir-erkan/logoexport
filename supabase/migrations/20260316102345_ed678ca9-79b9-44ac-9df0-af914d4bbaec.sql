
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do everything with projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project colors table
CREATE TABLE public.project_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hex TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'both' CHECK (role IN ('logo', 'background', 'both')),
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage project colors" ON public.project_colors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_colors.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_colors.project_id AND projects.user_id = auth.uid()));

-- Project files table (SVG metadata)
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage project files" ON public.project_files FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

-- Security definer function for client share access
CREATE OR REPLACE FUNCTION public.get_project_by_share_token(token UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  share_token UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.share_token, p.created_at, p.updated_at
  FROM public.projects p
  WHERE p.share_token = token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_project_colors_by_share_token(token UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  hex TEXT,
  role TEXT,
  label TEXT,
  sort_order INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.id, pc.project_id, pc.hex, pc.role, pc.label, pc.sort_order
  FROM public.project_colors pc
  JOIN public.projects p ON p.id = pc.project_id
  WHERE p.share_token = token
  ORDER BY pc.sort_order;
$$;

CREATE OR REPLACE FUNCTION public.get_project_files_by_share_token(token UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  file_name TEXT,
  storage_path TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pf.id, pf.project_id, pf.file_name, pf.storage_path
  FROM public.project_files pf
  JOIN public.projects p ON p.id = pf.project_id
  WHERE p.share_token = token;
$$;

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Authenticated users can update their logos" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can delete their logos" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Anyone can view logos" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');
