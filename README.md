# 🧠 DocuMind — AI PDF Knowledge Retrieval Platform

A three-service PDF retrieval application. Upload PDFs, ask questions, and view answers with source citations. Local readiness is verified; public deployment still requires the controls described in SECURITY_OVERVIEW.md.

### API connectivity and local port conflicts

Login/register and workspace navigation show an API connection indicator. The browser calls `GET /api/v1/health/ping` every 30 seconds while visible (5-second timeout), on reconnect/focus, and through the retry control. The response identifies `documind-api` / `v1`; it proves API reachability, not database, OCR, or Gemini readiness. `/health/readiness` remains the dependency check. Network failures are no longer labelled invalid credentials.

Credentialed CORS and mutation protection share the exact `CORS_ORIGIN` allowlist. Multiple configured origins may be comma-separated, with no wildcard, paths, or trailing slash. Preflight permits Content-Type, Authorization, and Idempotency-Key. Unknown origins and mutations without Origin remain forbidden. Use `http://localhost:3000` consistently for local cookie authentication; mixing localhost and 127.0.0.1 can prevent SameSite cookies from working.

If WSL or another PostgreSQL occupies port 5432, start the existing project database on a separate port:

```powershell
./scripts/start-secure-local.ps1 -SkipBuild -DatabasePort 5434
```

This overrides only the inherited runtime database host/port, retains configured credentials and existing postgres-data, and does not edit `.env`. The secure startup restores the caller's environment afterward. Do not reset database passwords to resolve a listener conflict.

---

## Architecture

```
┌─────────────────┐       REST        ┌─────────────────────┐      HTTP     ┌──────────────────────┐
│   Next.js 15    │ ◄────────────────► │    Express.js API   │ ◄────────────► │   FastAPI ML Service │
│   Frontend      │                   │                     │               │                      │
│                 │                   │  Auth / Users       │               │  PDF Extraction      │
│  Dashboard      │                   │  Documents          │               │  Chunking            │
│  Documents      │                   │  Chat Sessions      │               │  Embeddings          │
│  Chat           │                   │  File Storage       │               │  Qdrant Retrieval    │
│  Settings       │                   │  PostgreSQL         │               │  Reranking           │
└─────────────────┘                   └─────────────────────┘               │  LLM Generation      │
                                                │                           │  Citation Extraction │
                                         PostgreSQL                         └──────────┬───────────┘
                                                                                       │
                                                                          ┌────────────┴───────────┐
                                                                          │        Qdrant          │    Google Gemini
                                                                          │     Vector DB          │ ◄──────────────
                                                                          └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query |
| Backend | Express.js, TypeScript, Drizzle ORM, PostgreSQL |
| ML Service | FastAPI, Pydantic v2, Python 3.11 |
| PDF Processing | PyMuPDF, pdfplumber, pytesseract (OCR) |
| Embeddings | Google gemini-embedding-2 (768 dimensions) |
| Vector DB | Qdrant |
| Reranking | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| LLM | Google Gemini (gemini-3.8-flash) |
| Auth | JWT in httpOnly cookies |

---

## Prerequisites

- **Docker & Docker Compose** (recommended)
- Node.js 22+ (tested local/Docker runtime)
- Python 3.11+ (for local dev)
- A **Google Gemini API key** (free tier available at https://aistudio.google.com)

---

## Quick Start (Docker)

Docker is not installed on the verified Windows host; this path has not been built or deployed there. Real Redis runs separately in WSL as described below.

```bash
# 1. Clone and enter the project
cd Rag

# 2. Set up environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env

# 3. Fill in your API keys
# Edit ml-service/.env and set:
#   GEMINI_API_KEY=your-key-here
#   ML_SERVICE_TOKEN=any-long-random-string
# Edit backend/.env and set:
#   JWT_SECRET=any-long-random-string
#   ML_SERVICE_TOKEN=same-token-as-above

# 4. Build and start all services
docker-compose up -d --build

# 5. Run committed database migrations (first time and after schema changes)
docker-compose exec backend npm run db:migrate

# 6. Open the app
open http://localhost:3000
```

## Secure local Windows / WSL startup

With Ubuntu-24.04 in WSL and the existing local app dependencies installed:

```powershell
./scripts/install-local-redis.ps1 # initial installation only
./scripts/start-secure-local.ps1
./scripts/verify-local-redis.ps1
# Later starts with current compiled output:
./scripts/start-secure-local.ps1 -SkipBuild
```

The verified instance is Redis 7.4.11 on loopback port 6380, separate from existing WSL Redis. Its systemd service uses password authentication, AOF `everysec`, a 256 MiB cap and `noeviction`. Startup passes queue configuration and retained secrets through process environment; existing `.env` files remain untouched. The key/password file `.tools/secrets/runtime-secrets.clixml` is ignored, owner/SYSTEM-only and Windows CurrentUser DPAPI protected. Do not regenerate it while encrypted jobs exist. DPAPI depends on the Windows profile: the file alone is not a portable backup. Production needs a managed secret store and tested data/key restoration.

Backend and ML queue readiness, real Redis checks, 30 backend tests, 49 ML tests, frontend lint/typecheck/build and desktop/mobile end-to-end checks passed. Full npm audits and the installed Python environment's pip-audit report no known vulnerabilities at verification time. See SECURITY_OVERVIEW.md for remaining deployment risks; clean scans do not certify public-production security.

---

## Manual Setup (Local Development)

### 1. Start Infrastructure

```bash
# Start only PostgreSQL and Qdrant
docker-compose up -d postgres qdrant
```

### 2. Backend (Express.js)

```bash
cd backend
npm install
cp .env.example .env   # Edit values
npm run build
npm run db:migrate     # Apply committed migrations from backend/drizzle
npm run dev            # Starts on :3001
```

### 3. ML Service (FastAPI)

```bash
cd ml-service
pip install -r requirements.txt
cp .env.example .env   # Edit values (GEMINI_API_KEY required)
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev            # Starts on :3000
```

---

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN` | JWT expiry (e.g. `7d`) |
| `ML_SERVICE_URL` | URL of FastAPI service |
| `ML_SERVICE_TOKEN` | Shared secret for service-to-service auth |
| `UPLOAD_DIR` | Directory for PDF storage (default `./uploads`) |
| `CORS_ORIGIN` | Allowed frontend origin |

### `ml-service/.env`

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `LLM_MODEL` | Gemini model (default `gemini-3.8-flash`) |
| `EMBEDDING_MODEL` | Embedding model (default `gemini-embedding-2`) |
| `QDRANT_URL` | Qdrant server URL |
| `ML_SERVICE_TOKEN` | Must match backend's token |
| `RERANKER_ENABLED` | Enable/disable cross-encoder reranking |
| `CHUNK_SIZE` | Characters per chunk (default `1000`) |
| `RETRIEVAL_TOP_K` | Chunks to retrieve from Qdrant (default `10`) |
| `RETRIEVAL_TOP_N` | Chunks after reranking (default `5`) |
| `TESSERACT_CMD` | Optional path to the Tesseract OCR executable |

Exact legacy defaults (`gemini-1.5-flash`, `text-embedding-004`, and
`rag_documents`) are migrated in memory to the current model and collection
defaults without editing `.env`. Existing documents must be reindexed into
`rag_documents_v2`; the previous Qdrant collection is left untouched.

---

## API Reference

### Express.js API (`http://localhost:3001/api/v1`)

#### Auth
```
POST   /auth/register      Register new user
POST   /auth/login         Login, returns JWT cookie
POST   /auth/logout        Clear auth cookie
GET    /auth/me            Get current user
```

#### Documents
```
GET    /documents          List user's documents
POST   /documents          Upload PDF (multipart/form-data, field: file)
GET    /documents/:id      Get document details
DELETE /documents/:id      Delete document + vectors
POST   /documents/:id/reindex  Re-process document
```

#### Chat
```
POST   /chat               Create chat session
GET    /chat               List user's sessions
GET    /chat/:id           Get session details
DELETE /chat/:id           Delete session
GET    /chat/:id/messages  Get message history
POST   /chat/:id/messages  Send message, get RAG answer
```

#### Health
```
GET    /health             Express process status and uptime (does not query the database)
GET    /health/ml          FastAPI service status
```

### FastAPI ML Service (`http://localhost:8000/api/v1/ml`)

All routes except `/health` require an `Authorization: Bearer <ML_SERVICE_TOKEN>` header.

```
POST   /documents/process  Extract, chunk, embed, index PDF
POST   /documents/reindex  Re-index existing document
DELETE /documents/:id      Delete document vectors from Qdrant
POST   /retrieve           Semantic search
POST   /chat               Full RAG pipeline (retrieve → rerank → generate → cite)
GET    /health             Service health check
```

---

## RAG Pipeline

```
User Question
      ↓
  Embed query (Gemini gemini-embedding-2, 768 dimensions)
      ↓
  Qdrant semantic search (top-K=10, filtered by user_id + document_ids)
      ↓
  Cross-encoder reranking (top-N=5)
      ↓
  Context assembly (max 12,000 chars)
      ↓
  Gemini LLM generation (grounded by context only)
      ↓
  Citation extraction ([Source N] → document, page, excerpt)
      ↓
  Response with citations
```

---

## Testing

```bash
# Start the isolated test database (port 5433)
docker compose --profile test up -d postgres-test

# Backend tests are destructive and refuse to run unless the database name in
# DATABASE_URL contains "test".
cd backend
npm run build
# PowerShell example; substitute the POSTGRES_TEST_* values configured at root:
$env:DATABASE_URL="postgresql://<test-user>:<test-password>@localhost:5433/<test-database>"
npm run db:migrate
npm test

# ML service tests
cd ml-service && pytest tests/ -v
```

The Jest safety guard runs before all suites and prevents their cleanup hooks from
touching a database whose name does not contain `test`.

---

## Project Structure

```
Rag/
├── docker-compose.yml
├── README.md
├── .env.example
├── frontend/                    # Next.js 14 App Router
│   └── src/
│       ├── app/(auth)/          # /login, /register
│       ├── app/(app)/           # /dashboard, /documents, /chat, /settings
│       ├── components/          # UI, layout, chat, documents
│       └── hooks/               # TanStack Query hooks
├── backend/                     # Express.js + TypeScript
│   └── src/
│       ├── config/              # Env, DB
│       ├── models/              # Drizzle ORM schemas
│       ├── middleware/          # Auth, errors, upload
│       ├── services/            # Auth, document, chat, ML client
│       ├── controllers/         # Route handlers
│       ├── routes/              # Express routers
│       └── validators/          # Zod schemas
└── ml-service/                  # FastAPI + Pydantic
    └── app/
        ├── core/                # Config, auth, logging
        ├── schemas/             # Pydantic models
        ├── services/            # PDF, extraction, chunking, embedding, LLM...
        ├── rag/                 # Pipeline, retriever, prompts
        ├── vector/              # Qdrant client
        └── api/                 # FastAPI routes
```

---

## Security

- JWT tokens stored in httpOnly cookies (not accessible to JavaScript)
- bcrypt password hashing
- User-level document isolation enforced in every query
- FastAPI protected with internal bearer token (never exposed to browser)
- Multer validates PDF MIME type and enforces 50MB limit
- Helmet + CORS configured on Express
- Rate limiting: 600 req/15min general; stricter limits on login/register and per-user chat sends.

## Native Windows startup

With the project-local Python dependencies and bundled PostgreSQL/Qdrant installed, run
`powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1` from the project root.
The script builds both Node services, applies migrations, and starts missing services
in hidden windows. Stop an existing frontend before rebuilding its production output.
Use `-SkipBuild` only when the current sources are already built. Existing listeners
are preserved, not restarted. Logs are written to `.tools/`; open http://localhost:3000
(use the same hostname consistently for cookie authentication).

Frontend `npm start` runs `scripts/start-standalone.cjs`, which copies the local public
assets and static build output into Next's standalone server before starting it.
Backend tests use a fresh temporary upload directory in addition to requiring a test database.

## OCR analysis and coordinated inference

Uploads/reindexing produce per-page extractive summaries, tokenized important terms,
date matches and OCR confidence metrics, shown on the document detail page. Confidence
is not ground-truth accuracy. Native tables retain exact PNR association where spatial
evidence is unambiguous. `check pnr` returns source identifiers, not live railway status.
Reindex older PDFs to create this metadata and revised searchable text.

Compose now includes password-protected Redis and enables encrypted durable jobs.
Supply `REDIS_PASSWORD` and a securely retained, random, base64-encoded 32-byte
`DATA_ENCRYPTION_KEY` through your deployment environment. Both backend and ML need
the same encryption key. Never use the Gemini API key as this key. Existing native
configuration remains direct mode until Redis/key settings are supplied.

In queue mode, upload/reindex/chat sends require `Idempotency-Key`; retain the same key
when retrying the same request. Chat sends return 202 with `jobId`; poll authenticated
`GET /api/v1/jobs/:id`. Identical owner/key/body replays reuse the job; different bodies
return 409. The frontend handles queued chat polling. Scheduling uses priority tiers,
shortest estimated duration first, and five-minute aging; running jobs are not preempted.

Read [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md) before deployment. It records the
remaining dependency/encryption/infrastructure blockers and the limits of local ACID
transactions. [REQUEST_TRANSACTION.schema.json](REQUEST_TRANSACTION.schema.json)
defines the owner-visible JSON status/audit envelope. `/api/v1/health/readiness` returns
503 while Redis/queue readiness is incomplete; `/health` remains liveness only.

---

## License

MIT
# Structured OCR / document enhancement

Uploads now support docTR word/layout JSON alongside existing summaries and extraction metrics. Optional cGAN enhancement uses the official CycleGAN/pix2pix generator and requires document-trained weights; no weights were provided, so enhancement is not active by default. Installation, configuration, safeguards and CER/WER benchmarking are documented in [OCR_ARCHITECTURE.md](OCR_ARCHITECTURE.md). Existing `.env` files and uploaded PDFs are preserved.
