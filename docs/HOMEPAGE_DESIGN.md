# Editorial homepage design

Date: 2026-10-09

Update: the visible numbered section tags (01 / READ through 05 / PROTECT) were removed at the user's request. The historical image-generation prompts below are retained verbatim, not current UI copy. The four numbered workflow steps remain because they describe a sequence, not decorative section tags.

## Content authority

The homepage is based on `docs/PRODUCTION_ARCHITECTURE.md` (2026-10-08), cross-checked with frontend routes/configuration and the document's source references. It introduces implemented workflows, not Smallpdf's editing/conversion features. Smallpdf's public homepage (https://smallpdf.com/, inspected 2026-10-09) supplied inspiration for simple task-oriented navigation and explanation sections; its branding, claims, copy, and images were not reused.

## Design system and surface

True white background; Arial/Helvetica sans-serif; near-black #18181b headings; #60616b supporting copy; coral actions; restrained blue, yellow and green accents. Open two-column editorial layouts, alternating image positions, an unboxed application rail, four numbered workflow steps, and thin dividers. No dark band, hero eyebrow, fake metrics, pricing, certifications or nonworking mock controls.

Desktop native concept size: 1586 × 992. Content gutters scale between 24px and 88px. Mobile stacks text before images, uses a button-operated navigation with Escape dismissal and retains authentic app links. Headings, UI copy, controls, icons and workflow steps are real HTML/SVG; generated illustration objects remain raster artwork. Images are optimized WebP, served through Next Image with responsive sizes; only the hero is prioritized. Most homepage content is server-rendered; only mobile navigation needs client state.

## Section/asset inventory

| Section | Concept | Production art | Purpose |
|---|---|---|---|
| Hero and applications | homepage/concepts/hero.png | frontend/public/editorial/hero.webp | Introduce readable PDFs, insights, source-grounded answers |
| Reading | homepage/concepts/reading.png | frontend/public/editorial/reading.webp | Native/neural extraction and quality diagnostics |
| Discover | homepage/concepts/knowledge.png | frontend/public/editorial/insights.webp | Every-page extractive summaries and lexical detail discovery |
| Ask | homepage/concepts/knowledge.png | frontend/public/editorial/answers.webp | Selected-document retrieval, reranking and citations |
| Orchestrate | homepage/concepts/orchestration.png | frontend/public/editorial/queue.webp | Priority/estimated SJF, aging, cache and traceability |
| Protect and stack | homepage/concepts/trust.png | frontend/public/editorial/security.webp | Owner scope, encryption boundaries and service roles |

## Copy lock and intentional implementation refinements

Above the fold: DocuMind; Applications; How it works; Under the hood; Log in; Open workspace; Less searching.; More understanding.; Turn your PDFs into readable pages, useful insights, and answers you can trace back to the source.; Explore your PDFs; See how it works; One workspace. A clearer picture.; Read & extract; Summarize & discover; Ask with sources. Application descriptions and links use the hero concept copy.

The generated secondary concept headers were inconsistent/invented; the implementation uses one consistent header from the hero. Only the hero has a header, not a repeated header on every section. Decorative numbered section labels were removed in the later workspace restyle; the original concept screenshots and prompts remain historical references. Existing Lucide icons are used consistently, rather than redrawing image-generated icon approximations. Reading-detail descriptions were made more specific to geometry/confidence diagnostics; cache copy mentions provider budgets/fallback. A closing account-creation link is added so new users have a real onboarding path. The separate architecture resource is required to make the 'Read the architecture' action genuine: frontend/public/guides/project-architecture.pdf is a publication copy of output/pdf/PRODUCTION_ARCHITECTURE.pdf and must be refreshed when that source publication changes. No fake live demo is used. Artwork is separately regenerated in the same paper-cut world, not cropped from concept UI; small object arrangements vary intentionally. Action coral is darkened from #e6462d to #d33c26 so normal white button text has a 4.73:1 contrast ratio; text-link coral is #ce3822 (4.98:1 against white).

## Factual boundaries preserved

- cGAN enhancement requires an administrator-supplied trained checkpoint; default docTR is not evidence of active GAN restoration.
- Upload summaries are per-page extractive passages, not a Gemini-generated whole-document narrative.
- PNR lookup reads selected PDFs, not live railway status.
- Scheduling is priority-based non-preemptive estimated SJF with aging; it is not preemptive SJTF.
- Redis coordinates budgets/caches; PostgreSQL owns the durable job queue.
- Remote API effects are not distributed ACID or exactly-once billing.
- Encrypted jobs/Redis values do not mean all files, normal database fields or vector payloads are encrypted.
- Public production still needs TLS, managed secrets and workload isolation.

## Generation method and exact prompt set

All five concepts and six final illustrations were generated using the built-in image_gen tool, not the CLI/API fallback. No provider key was requested. Original generated files remain in Codex's generated_images location; project-bound copies are retained at the paths above. Production PNG-to-WebP conversion changes format only, without replacing the artwork.

### Shared concept brief

Use case: ui-mockup. A polished readable desktop website section screenshot for DocuMind, an existing Smart PDF Orchestrator. True white #ffffff background, near-black #18181b sans-serif headings (Arial/Inter), muted gray body #60616b, coral #e6462d action buttons, open editorial layout, 1120px centered content, large whitespace, subtle horizontal dividers. Existing brand is a simple outlined brain icon beside DocuMind, not Smallpdf branding. Illustrations: sophisticated tactile paper-cut still-life with white document sheets, restrained blue/coral/yellow/green cut-paper geometric tabs, crisp soft shadows, no glow or gradients, not cartoon characters. Entire screenshot 1440px wide, about 900px high. All real UI copy/controls will be rebuilt in HTML, artwork extracted separately using imagegen, not screenshot-as-UI. No invented stats, prices, claims, eyebrow above hero, certifications or unrelated PDF editing/conversion tools. Part of a coordinated full homepage: hero & applications, OCR reading, summaries & sourced answers, orchestration, security & technical stack/footer. Mobile will stack elegantly. 

### Concept: hero

Header: brand left; Applications, How it works, Under the hood links; right Log in text and Open workspace coral button. Hero left huge heading 'Less searching.\nMore understanding.' below 'Turn your PDFs into readable pages, useful insights, and answers you can trace back to the source.' Coral 'Explore your PDFs' button and text 'See how it works' arrow link. Right spacious sculptural paper illustration of three overlapping white PDF pages, one magnifying blue lens, yellow highlighted lines, coral PDF tab and green citation marker. Beneath hero a small sentence 'One workspace. A clearer picture.' and an open three-column applications rail with outlined icons and headings 'Read & extract', 'Summarize & discover', 'Ask with sources', each a short description and arrow anchor. Do not put hero copy into art.

### Concept: reading

Full single OCR section with white background. Small blue section number '01 / READ' above left heading 'Every page deserves\na clear reading.' body 'Native text and neural OCR work together to read digital, scanned, and mixed PDFs. Inspect the words, layout, and extraction quality—not just the final answer.' Below three compact border-separated rows 'Native + scanned pages', 'Layout-aware extraction', 'Quality you can inspect', each one-line description. Bottom plain note 'Optional cGAN enhancement needs a trained checkpoint. Original readings are retained and checked.' Link 'Explore document reading' arrow. Right a large standalone paper-cut illustration messy faded document transitioning to clean page with blue rectangular word bounds, small blue lens and green check; crisp refined paper, white backdrop, no UI controls baked into the artwork.

### Concept: knowledge

Two complete editorial explanation segments in this readable website screenshot, both white, consistent big typography and whitespace. Upper half: left colorful yellow paper-cut page with highlighted date/term lines, small paper summary cards. Right yellow small label '02 / DISCOVER', heading 'Find the details.\nKeep the bigger picture.' body 'Every-page summaries, important terms, dates, and labeled PNR values make a long PDF easier to explore.' Small note 'Extractive summaries keep selected passages from the document. PNR lookup reads the PDF; it does not check live train status.' Link 'See document insights'. Lower half separated by thin gray horizontal divider: left green label '03 / ASK', heading 'An answer is better\nwith a source.' body 'Ask across selected documents. Relevant passages are retrieved, reranked, and sent to Gemini with recent conversation context. Page citations help you return to the evidence.' link 'Start a document chat'. Right refined paper-cut green speech bubble connected to two white source pages with green source markers. No fake live demo or fabricated results.

### Concept: orchestration

Single complete white editorial orchestration section. Top small coral '04 / ORCHESTRATE'. Heading 'Small questions.\nThoughtful orchestration.' body 'Behind a simple workspace: durable jobs, owner-scoped request keys, and shared API budgets.' Open horizontal four-step line with numbered steps 'Upload', 'Read & analyze', 'Index', 'Ask & verify', each very short explanation, thin line between steps, no cards. Lower area: left a sophisticated large paper-cut illustration of white document stacks of different heights along coral queue rails, blue cache drawer and a small clock, no false technical labels. Right three border-separated entries 'Priority, then shortest estimate' description 'Chat jobs are prioritized; smaller estimated jobs run first within each tier. Aging promotes waiting work.' 'Cache before another API call' description 'Owner-scoped encrypted Redis caches reduce repeated work.' 'A request you can trace' description 'Idempotency keys, source checks, and fenced completion track each job.' Bottom factual note 'Running jobs are not interrupted. Remote API calls are not a distributed ACID transaction.'

### Concept: trust

Final two complete homepage editorial sections and closing footer in one readable screenshot. Upper: small green '05 / PROTECT', left heading 'Clear boundaries.\nNot blanket promises.' body 'Owner checks, authenticated PDF access, rate limits, and encrypted workflow data protect the processing path.' note 'Jobs and Redis values are encrypted. Original files and all database/vector content are not encrypted by the application. Public deployment still needs TLS, managed secrets, and workload isolation.' Right tasteful paper-cut white document folder with green shield and small coral key, not certification seal. Below divider compact section heading 'Built as a connected system.' open three-column technical stack list 'Interface / Next.js · React · TypeScript', 'Application / Express · PostgreSQL · Drizzle', 'Intelligence / FastAPI · docTR · Gemini · Qdrant', and separate note 'Redis coordinates caches and budgets; PostgreSQL owns durable jobs.' A plain link 'Read the architecture'. Closing white CTA 'Make room for understanding.' with coral 'Open your workspace' button. Footer brand DocuMind, 'Smart PDF Orchestrator', links Applications, Architecture, Log in. No dark band, no fake privacy policy links.


### Shared asset brief

Use case: stylized-concept. Asset type: standalone production illustration for DocuMind's white editorial PDF homepage. Sophisticated tactile cut-paper still life, premium crisp paper fibers, real soft cast shadows, controlled depth, white document sheets, clean cut-paper geometric shapes, restrained bright blue #397ac6, coral #e6462d, warm yellow #ffdc6d, forest/soft green. True pure white background #ffffff, no backdrop scene, no frame, no UI, no website screenshot, no controls, no glow, no gradients, no unrelated decoration, no watermarks. Centered balanced wide landscape composition approximately 3:2 with comfortable white padding. 

### Asset: hero.webp

Three overlapping white PDF sheets with gray printed line shapes, a large blue magnifying lens over yellow highlighted lines, a coral paper tab with exact text 'PDF', a green citation bookmark with white quotation marks, small yellow semicircle and blue half-circle geometric paper accents. A handsome tactile editorial object composition, lively but restrained.

### Asset: reading.webp

A worn faded scanned document on the left transitions via a small dark directional arrow to a clean white document stack on the right. The clean pages have blue word bounding boxes over gray text lines; a large blue lens at bottom right magnifies blue bounding boxes. A small green circular check is attached to clean page, blue/yellow/coral tabs only. No invented readable body text. Not a promise of perfect restoration.

### Asset: insights.webp

A white folded-corner page on a large warm-yellow paper backing, gray text lines and two yellow highlighted passages. Highlight labels exactly '12 Mar 2024' and 'Mumbai Central' only, synthetic illustrative text. Thin connecting lines lead to three small white paper slips titled exactly 'Summary', 'Key dates', 'Important terms' with gray lines. Small blue and coral page tabs. No UI buttons.

### Asset: answers.webp

A large soft-green cut-paper speech bubble at top with dark green abstract answer lines and a small white circular quotation symbol. Two slim green connecting paths lead to two white paper source pages below, gray lines and green highlight strips. Small pale-green tags on pages read exactly 'Source 1 / p. 4' and 'Source 2 / p. 12'. White pure background, sophisticated sparse editorial still life.

### Asset: queue.webp

Three clean white document stacks of distinctly different heights progressing along a narrow coral paper queue rail, shorter stack nearest foreground exit. A blue paper drawer suggests a cache, a small yellow analog clock suggests waiting. Clear minimal balanced arrangement, no words, no technical labels, no busy server racks. Premium tactile paper-cut sculpture for shortest estimated job scheduling and cached work.

### Asset: security.webp

A white document folder with several white sheets and small blue tabs, a large forest-green cut-paper shield with a white keyhole in front, a tiny coral paper key resting beside the folder. Premium tactile folded paper, crisp soft shadow, no seal, no certification text, no locks implying universal encryption, no words or logos.
