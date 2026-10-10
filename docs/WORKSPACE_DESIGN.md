# Editorial workspace design

Date: 2026-10-09

## Scope and visual specification

The existing /dashboard, /documents, and /documents/[id] routes retain their authenticated workflows. /document in the request refers to the existing /documents area; no route is renamed. The homepage's five decorative numbered section tags are removed; workflow step numbers remain.

Three imagegen concepts define the complete dashboard, document library and PDF detail screen. Native concept dimensions: 1586 × 992. Tokens: true white, Arial/Helvetica, near-black #18181b, muted #60616b, accessible coral #d33c26, restrained blue/yellow/green paper artwork, thin dividers, open count rail and full-width rows. No gradients, fake statistics, charts or new PDF capabilities.

Shared architecture: existing Next.js App Router and React Query hooks, semantic light-theme tokens, existing Button/Badge/Dialog primitives, navigation/sidebar, workspace CSS module, reusable upload/new-chat actions and document rows. Counts/file names come from APIs. Responsive Next Image uses new WebP illustrations, not concept screenshots. PDFViewer stays dynamically loaded, with local worker and authenticated endpoint.

## Inventory and copy lock

- Dashboard: shared shell; dynamic Welcome back, {first name}!; Your documents. Your next discovery.; Upload Document; Start New Chat; actual Total Documents, Ready for Chat, Processing, Chat Sessions; Recent Documents; View all; actual document rows.
- Library: Documents; All your PDFs. Ready for a closer look.; Upload Document; Search documents...; All/Ready/Processing/Failed filters; Document/Status/Actions; View/Reindex/Delete. Processing includes queued/pending documents. Empty/loading/error/zero-search states match the system.
- Detail: Back to documents; actual originalName/date/status; Start Chat/Reindex/Delete; actual summaries/dates/identifiers/warnings/metrics; real PDF pagination/zoom. Fictional concept ticket data is never seeded into the app.
- Navigation: DocuMind home; Dashboard/Documents; account menu; recent chats; accessible mobile menu retaining access to recent chats.

## Intentional refinements

Use existing Lucide outline icons instead of inconsistent generated glyphs. Share coral actions and semantic ready/processing/failed Badge variants. The library concept's blue View becomes coral to match homepage/dashboard. Separate production artwork retains materials/palette but can vary object arrangement. Controls adapt to app density and narrow screens. Real data/warnings/page labels/PDF content differ from illustrative fixtures. The shared light theme also applies to portaled dialogs/account UI; dark definitions remain. Retain Radix toast (sonner was deliberately removed earlier).

## Functional refinements within the visual work

### Source-file inventory

- `frontend/src/components/home/EditorialHome.tsx`, `home.module.css`: remove decorative numbered section tags.
- `frontend/src/app/(app)/dashboard/page.tsx`: editorial overview, real statistics and recent-document rows.
- `frontend/src/app/(app)/documents/page.tsx`: editorial library, full-width search/status filters, explicit loading/error/empty states.
- `frontend/src/app/(app)/documents/[id]/page.tsx`: matching detail header, actions, summaries and viewer.
- `frontend/src/app/(app)/layout.tsx`, `components/layout/Navbar.tsx`, `Sidebar.tsx`: shared responsive editorial shell and recent-chat navigation.
- `frontend/src/app/(app)/chat/[id]/page.tsx`: available-height correction for the new shell; no chat algorithm change.
- `frontend/src/components/workspace/WorkspaceActions.tsx`, `workspace.module.css`: reusable upload/chat dialogs and workspace layout primitives.
- `frontend/src/components/documents/DocumentCard.tsx`, `DocumentStatus.tsx`: reusable full/compact rows and semantic status badges.
- `frontend/src/components/documents/DocumentUpload.tsx`: accessible selection/drop interaction and honest pending state.
- `frontend/src/components/documents/DocumentAnalysis.tsx`, `PDFViewer.tsx`: matching reading/analysis UI and responsive PDF canvas.
- `frontend/src/components/chat/NewChatDialog.tsx`: preserve creation workflow and show API error descriptions.
- `frontend/src/components/ui/button.tsx`, `badge.tsx`, `dialog.tsx`, `frontend/src/app/globals.css`: shared tokens, variants, icon/control consistency and narrow-screen dialog sizing.
- Two new `frontend/public/editorial/*.webp` assets; three `docs/workspace/concepts/*.png`; this document and homepage design-note update.

The old 192px status-filter container clipped its buttons; the new full-width filter row fits and wraps responsively. Processing now includes pending/queued documents. Recent-chat plus opens the existing creation dialog instead of only linking to the dashboard. Upload selection is keyboard accessible through Choose PDF, and the input is always mounted so drag/drop or file removal does not break reselection. The old simulated percentage/timer is removed: Uploading is an honest pending state, not fabricated progress. Successful upload closes its dialog. Error states no longer silently resemble an empty library, and request errors have Retry. PDF pages fit the available width at 100%, retain scrollable zoom, and zoom arithmetic is rounded to avoid float-boundary problems. The chat page's old fixed 64px-header calculation is replaced with available height, preventing the new 82px desktop/72px mobile header from clipping its composer. These changes do not alter API schemas, OCR/RAG algorithms, auth enforcement, stored data, or environment files.

## Verification and fidelity ledger

Playwright/Chromium is used because the Browser plugin is not available. Full screens are captured at native concept dimensions (1586 × 992), plus 1440 × 1000, 768 × 1024, 390 × 844 and 320 × 740. Generated concepts and latest rendered screenshots are inspected with view_image.

| Comparison | Evidence and refinement |
|---|---|
| Copy/hierarchy | Dynamic greeting and document fields replace concept samples; all headings/action/filter labels follow the copy lock. No section tags remain. |
| Composition | Shared header/sidebar, compact two-column intro, open statistics rail and document rows match the concepts; mobile stacks them. |
| Typography | Bold large Arial headings match the homepage; row titles/metadata enlarged after first screenshot review. |
| Palette | True white, accessible coral and semantic statuses; old blue-gray borders/near-navy headings neutralized. No gradients or image overlays. |
| Artwork | Separate imagegen production art preserves paper texture, coral PDF tab, blue lens/tray, yellow highlights, green bookmark; responsive WebP/Next Image at quality 90. |
| Controls/icons | Existing Lucide family, consistent focus rings, larger icon buttons; same portaled dialog palette. |
| Responsive/data states | No horizontal page overflow at checked widths; accessible mobile menu with Escape/focus return; real loading/empty/error/pending states. |

Intentional differences from generated screenshots are recorded above: usable control density, consistent icons/status colors, actual API content, separate illustration composition, the actual PDF rather than imagegen's fictional ticket. No unrecorded above-the-fold copy additions. API mutations in UI QA are mocked and isolated; original uploads, database rows and external model calls are not exercised or changed by these tests. The public architecture PDF is used as a real PDF.js rendering fixture, not as a user's private document. Normal-state console errors/warnings: zero. Deliberately mocked 503 responses produce expected resource errors while testing request-error/retry states.

Final results: `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass. Playwright passes at all five listed viewports: page identity/nonblank/no overlay, loaded artwork, no overflow, live fixture counts, search/filters (including queued), invalid-file toast, mocked multipart upload/idempotency, reindex/idempotency, delete cancel/confirm, chat creation payload/navigation, real local-worker PDF rendering/pagination/zoom, metrics expansion, mobile menu/Escape/focus/navigation, mobile upload dialog bounds/keyboard selection, account menu, home-label regression, loading/empty/503-error/retry, and anonymous dashboard redirect. The existing nonblocking Tailwind config module-type build warning remains. Live Gemini/OCR, database and Redis processing were not retested in this frontend-only change. Final production frontend remains running at http://localhost:3000/.

## Generation

Built-in image_gen, no CLI/API fallback or key requested. Concepts: docs/workspace/concepts/. Art: frontend/public/editorial/workspace-welcome.webp and document-library.webp. PNG-to-WebP is format conversion only. Original generated files remain in Codex generated_images.

### Exact concept prompts

#### dashboard

Create a complete production-quality DocuMind authenticated app screen, landscape 1586x992. Image 1 is the existing editorial homepage STYLE REFERENCE, not an edit target. Match its pure white #ffffff backdrop, Arial-like bold near-black #18181b headlines, muted #60616b body, accessible coral #d33c26 buttons, thin #e4e5e9 rules, restrained blue/yellow/green accents and tactile cut-paper PDF artwork. No gradients, no numbered section tags like 01/READ, no eyebrows, no fake charts, no marketing wrapper, no card grid. Actual Next.js UI controls/text will be built in code; illustration separate. Shared shell: top header 82px, coral outlined brain mark + DocuMind at left, Dashboard and Documents navigation, account avatar D at right. White 224px left sidebar below header: Dashboard, Documents, Recent Chats with plus icon and 'Ticket questions'. Main area with 56px gutters. Use Lucide-style outline icons. Full dashboard with Dashboard selected. Main top section split left copy and right restrained paper illustration of organized PDF sheets, blue lens, yellow highlights and green quote tab. Exact headline 'Welcome back, Demo!' (sample name, actual dynamic), supporting 'Your documents. Your next discovery.' Buttons 'Upload Document' coral with upload icon and 'Start New Chat' outlined with chat icon. Compact 260px-high introduction. Below open four-column count rail bounded by thin rules: 'Total Documents' 3, 'Ready for Chat' 1, 'Processing' 1, 'Chat Sessions' 1 (sample real-state demo counts, never hardcode in app). Below 'Recent Documents' and coral 'View all' link. Three spacious full-width rows, not cards: coral outlined PDF icon, 'Travel ticket.pdf', '0.58 MB · Oct 9, 2026', green 'Ready' status, View arrow; 'Research notes.pdf', '1.24 MB · Oct 9, 2026', amber 'Processing', View arrow; 'Scanned receipt.pdf', '0.21 MB · Oct 9, 2026', red 'Failed', View arrow. Full screen readable, generous space, no additional sections.

#### documents

Create a complete production-quality DocuMind authenticated app screen, landscape 1586x992. Image 1 is the existing editorial homepage STYLE REFERENCE, not an edit target. Match its pure white #ffffff backdrop, Arial-like bold near-black #18181b headlines, muted #60616b body, accessible coral #d33c26 buttons, thin #e4e5e9 rules, restrained blue/yellow/green accents and tactile cut-paper PDF artwork. No gradients, no numbered section tags like 01/READ, no eyebrows, no fake charts, no marketing wrapper, no card grid. Actual Next.js UI controls/text will be built in code; illustration separate. Shared shell: top header 82px, coral outlined brain mark + DocuMind at left, Dashboard and Documents navigation, account avatar D at right. White 224px left sidebar below header: Dashboard, Documents, Recent Chats with plus icon and 'Ticket questions'. Main area with 56px gutters. Use Lucide-style outline icons. Full document library with Documents selected. At top left exact h1 'Documents', support 'All your PDFs. Ready for a closer look.' coral 'Upload Document' button below. At right compact tactile artwork of upright stacked PDF pages inside a blue paper document tray with a coral PDF tab and yellow highlights, pure white seamless ground; artwork height230px. Below header a full-width search input with icon and 'Search documents...' then horizontal text tabs 'All', 'Ready', 'Processing', 'Failed', with All coral underline; enough width no clipping. Thin rule then library as full-width spacious list rows, not cards, with column labels 'Document', 'Status', 'Actions'. Rows: 'Travel ticket.pdf' '0.58 MB · Oct 9, 2026' Ready; 'Research notes.pdf' '1.24 MB · Oct 9, 2026' Processing; 'Scanned receipt.pdf' '0.21 MB · Oct 9, 2026' Failed and short error 'Processing could not be completed.' Each row has outlined PDF icon, 'View' link, circular-arrow Reindex icon button, trash Delete icon button. Processing reindex disabled. No bulk actions or invented functionality. Readable sparse library.

#### detail

Create a complete production-quality DocuMind authenticated app screen, landscape 1586x992. Image 1 is the existing editorial homepage STYLE REFERENCE, not an edit target. Match its pure white #ffffff backdrop, Arial-like bold near-black #18181b headlines, muted #60616b body, accessible coral #d33c26 buttons, thin #e4e5e9 rules, restrained blue/yellow/green accents and tactile cut-paper PDF artwork. No gradients, no numbered section tags like 01/READ, no eyebrows, no fake charts, no marketing wrapper, no card grid. Actual Next.js UI controls/text will be built in code; illustration separate. Shared shell: top header 82px, coral outlined brain mark + DocuMind at left, Dashboard and Documents navigation, account avatar D at right. White 224px left sidebar below header: Dashboard, Documents, Recent Chats with plus icon and 'Ticket questions'. Main area with 56px gutters. Use Lucide-style outline icons. Full PDF detail screen Documents selected. Main top a small back link 'Back to documents', h1 'Travel ticket.pdf', muted date 'Oct 9, 2026' and green Ready status. Right actions 'Start Chat' coral, 'Reindex' outline, 'Delete' destructive outline. Below open analysis area h2 'Upload summary & OCR quality'; subtitle 'Extractive summary of every page · 124 lexical tokens. Highlighted dates and terms are source-text matches.' Sample identifier 'PNR: 1234567890 · Page 1'. Summary Page 1 'Travel ticket. Journey on 9 Oct 2026. PNR 1234567890.' Yellow highlighted date and PNR. Collapsible 'Per-page extraction metrics'. Below thin rule, PDF viewer titled toolbar Previous/Next arrows, 'Page 1 of 1', zoom buttons and '100%'. Pale neutral viewer canvas containing white sample ticket page readable lines and yellow source text highlight. No fake extra metrics or art inside actual document. White editorial layout generous typography, existing workflow preserved.

### Exact production-art prompts

#### workspace-welcome

Standalone production illustration ONLY, not UI screenshot, for DocuMind. Image 1 is the established homepage paper artwork STYLE REFERENCE. Match precisely tactile fine-grained white paper, cut-paper geometric objects, coral PDF tab, blue #286fc0, yellow highlights, green quote bookmark, soft realistic shadows. Pure #ffffff seamless background all edges, no tint, no gradient, no extra labels/controls. Landscape 1536x1024 with comfortable margins, objects fill central 85%, perspective slightly elevated front view, original composition.Organized fan of three white PDF sheets, one large blue paper magnifying glass in front, two yellow highlight strips, coral tab reading exactly 'PDF', small green quotation bookmark. Compact restrained welcoming reading scene, match dashboard reference art anatomy.

#### document-library

Standalone production illustration ONLY, not UI screenshot, for DocuMind. Image 1 is the established homepage paper artwork STYLE REFERENCE. Match precisely tactile fine-grained white paper, cut-paper geometric objects, coral PDF tab, blue #286fc0, yellow highlights, green quote bookmark, soft realistic shadows. Pure #ffffff seamless background all edges, no tint, no gradient, no extra labels/controls. Landscape 1536x1024 with comfortable margins, objects fill central 85%, perspective slightly elevated front view, original composition.Three upright white document pages inside a vivid blue shallow paper in-tray, central page bears two yellow highlighted strips and a coral tab reading exactly 'PDF', back page has green bookmark. Clean strong recognizable library silhouette matching the document screen concept. No magnifying lens, no scattered extra objects.
