

# Chromatype — Revised Plan

## Key Change: Admin + Client Sharing Model

You are the sole creator. Clients receive a share link to view and download from a specific project — nothing else. No client accounts needed.

## Architecture

### Auth
- **You** log in with email/password via Supabase Auth
- **Clients** access projects via a public share URL (`/shared/:shareToken`) — no login required
- Each project gets a unique, unguessable share token (UUID)

### Database (Supabase)

```text
projects
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── name (text)
├── share_token (uuid, unique, auto-generated)
├── created_at, updated_at

project_colors
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── hex (text, e.g. "#FF5500")
├── role (text: 'logo' | 'background' | 'both')
├── label (text, optional)

project_files (SVG metadata; actual files in Supabase Storage)
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── file_name (text)
├── storage_path (text)
```

**RLS**: All tables restricted to `auth.uid() = user_id`. A security-definer function `get_project_by_share_token(token)` allows unauthenticated access to a single project's data for the client view.

**Storage**: A `logos` bucket. RLS allows your uploads; a public read policy scoped by project for shared access.

### Pages

1. **`/login`** — Email/password auth (admin only)
2. **`/projects`** — Dashboard (admin only, protected route)
3. **`/projects/:id`** — Workbench (admin only, full edit)
4. **`/shared/:shareToken`** — Client view (public, read-only)

### Client View (`/shared/:shareToken`)
- Sees the logo, palette, and matrix of combinations (read-only)
- No left rail editing, no SVG upload, no color editing
- Each combination card has a download button with options:
  - **Format**: SVG, PNG, JPG, PDF
  - **Background**: Solid color or Transparent (PNG/SVG only)
  - **Size**: preset dimensions (e.g., 512px, 1024px, 2048px, or custom)
- Can download individual combinations or batch-download selected ones as ZIP

### Admin Workbench (unchanged from original plan, plus)
- **Share button** in the header that copies the client share URL
- Download options also include transparent background + size picker
- Everything auto-saves to Supabase

### Export Options (both admin & client)
- **Format**: SVG | PNG | JPG | PDF
- **Background**: Solid color (the selected bg color) | Transparent
  - Transparent available for SVG and PNG only (JPG gets white matte, PDF gets white)
- **Size**: 512×512 | 1024×1024 | 2048×2048 | Custom (width input, height auto-scales)

## Implementation Order

1. **Supabase setup** — Connect Supabase, create tables, storage bucket, RLS policies, share-token function
2. **Auth + routing** — Login page, protected routes, auth context
3. **Projects dashboard** — CRUD for projects, industrial card grid
4. **Workbench: Left rail** — SVG upload to storage, color palette CRUD with role toggles
5. **Workbench: Center stage** — SVG re-coloring engine, manual pairing, matrix grid with contrast badges
6. **Workbench: Right rail** — Export queue with format/background/size options
7. **Export engine** — SVG recolor, canvas rasterization (PNG/JPG), jsPDF for PDF, JSZip for batch
8. **Client shared view** — Public route, read-only matrix, download with options
9. **Design polish** — Geist fonts, monochromatic theme, micro-bevels, motion

## Design System
Same as before: monochromatic grays, Geist Sans/Mono, 4px radii, matte surfaces. Brand colors are the only color on screen.

## Dependencies to Add
- `jspdf` — PDF export
- `jszip` + `file-saver` — batch ZIP download
- Supabase client (already available via Lovable integration)

