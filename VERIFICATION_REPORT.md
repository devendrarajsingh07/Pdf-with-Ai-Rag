# Verification and repair report — 2026-10-07

## Phase A: Application and browser integration

Changed files:

- `frontend/src/lib/api.ts`: removed global JSON Content-Type so FormData is not serialized as JSON.
- `frontend/src/hooks/useDocuments.ts`: explicit multipart upload, typed status, active-document polling, and cache invalidation.
- `frontend/src/hooks/useAuth.ts`: correct registration type and real profile-update mutation.
- `frontend/src/components/documents/PDFViewer.tsx`: authenticated PDF loading, labelled controls and bounded zoom.
- `frontend/src/components/chat/ChatInterface.tsx`: error toast and correct scroll viewport.
- `frontend/src/components/chat/CitationCard.tsx`: native keyboard-accessible expansion button and score handling.
- `frontend/src/app/(app)/documents/[id]/page.tsx`: lazy PDF viewer, real document-specific chat creation and honest processing-state text.
- `frontend/src/app/(app)/settings/page.tsx`: persistent profile changes; unavailable account deletion is disabled.
- `frontend/src/app/(app)/layout.tsx`: flexible content width prevents overflow.
- `frontend/src/middleware.ts`: invalid cookies no longer force an authentication-page redirect loop.

Checks: `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. Chromium desktop/mobile checks passed against the final production frontend and isolated QA backend/ML configuration.

## Phase B: Backend and ingestion reliability

Changed files:

- `backend/src/services/chat.service.ts`: rejects empty document scope; saves each exchange atomically after the remote call succeeds.
- `backend/src/services/document.service.ts`: normalizes legacy stored paths within configured uploads, passes original names and catches asynchronous status-save failures.
- `backend/src/services/ml.service.ts`: includes original document names in processing/reindex requests.
- `backend/src/app.ts`: general rate limit accommodates status polling; strict authentication limit applies to login/register.
- `backend/Dockerfile`: copies Drizzle migrations into the runtime image.
- `docker-compose.yml`: backend and ML use the same upload-volume path.
- `ml-service/requirements.txt`: Qdrant client updated from 1.7.3 to 1.19.1 for the running 1.19.1 server.
- `ml-service/app/vector/qdrant_client.py`: current query_points API, synchronous upsert acknowledgement and vector/chunk count validation.
- `ml-service/app/schemas/document.py`: optional original document_name request field.
- `ml-service/app/services/pdf_service.py`: original source names and confined realpath validation.
- `ml-service/app/services/chunking_service.py`: validates parameters, honors zero overlap, and excludes separator boundaries inside overlap.
- `ml-service/app/services/embedding_service.py`: retries query embeddings too; validates dimensions and finite values.
- `ml-service/app/main.py`: startup fails if collection initialization/validation fails; blocking startup check runs in a threadpool.

Checks: backend build passed. Real two-page PDF extraction, Gemini batch embedding, Qdrant indexing/search, cross-encoder reranking and Gemini generation passed. Source citations use the original filename. Qdrant storage and existing uploads were not removed.

## Phase C: Tests, startup and documentation

Changed files:

- `backend/tests/chat.test.ts`: empty scope and ML-failure atomicity coverage.
- `backend/tests/auth.test.ts`: foreign-key-safe cleanup of the isolated test database.
- `backend/tests/test-guard.ts`: fresh temporary test upload directory; existing test-database-name guard retained.
- `ml-service/tests/conftest.py`: test setting overrides restore automatically.
- `ml-service/tests/test_chunking.py`: zero-overlap/invalid-parameter coverage.
- `ml-service/tests/test_embedding.py`: batch, query-retry and invalid-vector coverage.
- `frontend/package.json`, `frontend/scripts/start-standalone.cjs`: production standalone startup with public/static assets.
- `scripts/start-local.ps1`: native Windows service startup, migrations and health checks, preserving existing listeners.
- `README.md`, `PROJECT_CONTEXT.md`: corrected behavior, runtime/dependency versions, startup instructions and verification status.
- `VERIFICATION_REPORT.md`: this report.

Checks: all 18 backend Jest tests and 20 ML pytest tests passed; Python `pip check` found no broken requirements. PostgreSQL migrations passed. Production frontend, backend, ML and Qdrant health URLs returned HTTP 200.

## Browser evidence

The temporary Playwright harness is outside the repository. It forwards frontend API requests to an isolated test backend, uses a test database and separate QA upload directory/Qdrant collection, and uses real Gemini calls. Assertions cover registration/cookie login, multipart upload, ready status, two-page authenticated PDF preview with the local worker, page navigation, document-specific chat, grounded budget/owner answer, original-name citations, keyboard expansion, profile persistence, and mobile overflow. No application console errors or page exceptions were observed. The final harness exited successfully.

Screenshots: `C:/Users/KIIT/AppData/Local/Temp/documind-pdf-desktop.png`, `documind-chat-desktop.png`, and `documind-documents-mobile.png` in that same directory.

## Remaining limitations

- Account deletion is not implemented; the control is explicitly disabled.
- Legacy documents need reindexing into the current embedding collection. Legacy vectors remain preserved.
- Upload progress remains simulated, rather than network-byte progress.
- No durable processing queue, per-session send serialization or committed browser regression suite exists.
- Live OCR of a scanned PDF and a Docker Compose build were not verified in this pass.
- The workspace has no Git repository; no commit was made.
- Existing `.env` files were not changed. Provider credentials and future quotas were not modified or guaranteed.
- This report summarizes this verification pass, not every change made in previous conversations.
