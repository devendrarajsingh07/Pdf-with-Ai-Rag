# Structured OCR and optional document enhancement

## Dependency remediation — 2026-10-08

The current requirements use docTR 1.1.0 with upgraded PyMuPDF/pdfplumber/Pillow, Sentence Transformers 6.1.0 and Transformers 5.19.0. Any older version/benchmark references below are historical. Detector/recognizer architecture and Gemini models are unchanged. Official updated CRNN weights were prewarmed locally; clean synthetic inference had zero CER/WER and 92.9% mean confidence, not a general accuracy guarantee. Real reranker inference and 49 ML tests passed; installed-environment pip-audit and pip check are clean. No document-trained GAN checkpoint was provided, so optional GAN enhancement remains inactive. Real Redis is now deployed locally and encrypted queue mode is verified; see SECURITY_OVERVIEW.md for its key/recovery limits.

## Implemented flow

`PDF -> PyMuPDF RGB raster (up to 300 DPI, 16 million pixels/page) -> optional trusted CycleGAN/pix2pix generator -> docTR -> layout JSON + text -> existing per-page analysis -> chunking -> Gemini embeddings -> Qdrant -> RAG`

`app/services/extraction_service.py:ExtractionService.extract` retains native PDF text, including coordinate-associated PNR fields. With the default `OCR_BACKEND=doctr`, every page is also rendered and read for layout. Lightweight `tesseract` mode keeps the previous scan/image-coverage heuristic. The original PDF is never rewritten.

`app/services/structured_ocr.py:StructuredOCR._predict` lazily loads one DB-ResNet50 detector and CRNN-VGG16-BN recognizer using `ocr_predictor(..., pretrained=True)`. These are the architectures in the supplied example; this recognizer is a CRNN, not a transformer. RGB arrays are passed directly, equivalent to `DocumentFile.from_images` without writing sensitive intermediate files. Inference is serialized per process, uses `torch.inference_mode`, and defaults to CPU with four PyTorch threads.

`result.export()` supplies page dimensions, blocks, lines, words, word confidence, and normalized geometry. `export_reading` reconstructs text in exported block/line order. This is OCR structure, **not** semantic table, invoice-field, or reading-order ground truth.

`app/services/document_analysis.py:analyze_document` includes `structuredPages[{pageNumber,layout,originalReading}]` in the existing `analysis` JSON. Each page's metrics includes `ocrBackend`, `enhancementApplied`, optional `checkpointSha256`, confidence and warnings. Existing backend document/status DTOs already return `analysis`; it is stored in PostgreSQL JSONB and in encrypted Redis checkpoints when enabled. No schema migration is needed. The current frontend displays summaries and existing metrics, not bounding-box overlays.

## GAN integration and prerequisites

The requested **pytorch-cyclegan-and-pix2pix** project is an upstream source repository, not an installed pip distribution under that name. It is cloned locally under ignored `.tools/pytorch-cyclegan-and-pix2pix` and pinned to `2a7afba2895d52556dd5dfe07e8555ef657ced6f`. Docker clones the same revision to `/opt/pytorch-cyclegan-and-pix2pix`.

`app/services/cgan_service.py:CGANService` imports upstream `models/networks.py` under an isolated module name and uses its actual `define_G`. There is no placeholder denoiser or randomly initialized model used for extraction. A trained generator state_dict must be supplied. `CGAN_NET_G`, `CGAN_NORM`, dropout, channels, filter count and patch resolution must match training. A paired dirty-page/clean-page pix2pix model is conditional; CycleGAN is an unpaired domain-translation alternative, not itself a conditional GAN.

Only administrator-controlled local checkpoint paths are accepted through settings, never through an upload/API body. Loading uses `torch.load(weights_only=True)` and strict state_dict matching, with a 1 GB file-size cap and optional SHA-256 validation. Upstream source is executable trusted code; the digest only verifies the checkpoint's identity, not its quality.

`CGANService.enhance` normalizes pixels to [-1,1], runs overlapping padded tiles, feathers overlaps, and reconstructs the original raster dimensions. It does not shrink a whole page to 256 pixels. Tile size defaults to 256, overlap 32, maximum 512 tiles. These inference choices need validation against the checkpoint's training distribution; patch seams and domain shift can worsen results.

No document-cleanup checkpoint or training dataset was found/provided. Therefore **cGAN enhancement is not enabled by default** and improved accuracy has not been established. Do not use unrelated horse/zebra or facade checkpoints. No GAN training was performed.

## Integrity and fallback

In `cgan_doctr` mode, docTR reads both original and enhanced rasters. `preservation_issues` rejects enhancement when fewer than 80% of baseline tokens survive, baseline numeric fields disappear/change, or output is empty. A lower-confidence enhanced reading is also rejected. Accepted enhancement retains the original text and original layout in `originalReading`. Missing weights, invalid weights, unavailable CUDA, tile-budget overflow, or enhancement exceptions retain the original docTR result with a warning. docTR exceptions/empty output fall back to Tesseract; failed Tesseract preserves native text.

These checks **cannot guarantee that no OCR data is lost**. The baseline may already be incorrect and GANs can alter characters. Confidence is not accuracy. Dates and PNRs require comparison with source imagery, especially on handwriting, skew, poor contrast or unfamiliar scripts. Existing transactional jobs, checksum checks, extracted/indexed/complete checkpoints, and idempotency behavior remain unchanged; external OCR/vector/provider actions are not a distributed ACID transaction.

## Install and run (from repository root)

```powershell
.\.tools\python311-portable\python.exe -m pip install -r ml-service/requirements.txt -r ml-service/requirements-ocr.txt
git clone https://github.com/junyanz/pytorch-CycleGAN-and-pix2pix.git .tools/pytorch-cyclegan-and-pix2pix
git -C .tools/pytorch-cyclegan-and-pix2pix checkout --detach 2a7afba2895d52556dd5dfe07e8555ef657ced6f
```

Skip clone when the checkout already exists. A standard Python 3.11 environment may replace the portable interpreter. The pinned Torch/Torchvision pair must be installed together. The Dockerfile installs the optional OCR stack by default; `--build-arg ENABLE_STRUCTURED_OCR=false` builds the lightweight variant (use `OCR_BACKEND=tesseract`). No Docker build was verified locally because Docker is unavailable.

No actual `.env` files were changed. `.env.example` documents every new setting. Set process/deployment variables before starting ML:

```powershell
$env:OCR_BACKEND = 'doctr'
# Only after obtaining a trusted, document-trained checkpoint:
$env:OCR_BACKEND = 'cgan_doctr'
$env:CGAN_CHECKPOINT = 'C:/models/document-cleanup/latest_net_G.pth'
# Match all CGAN_* settings to the training configuration; optionally set digest.
```

For Compose, supply OCR/GAN configuration in the ML service's deployment environment and mount the checkpoint directory **read-only**, e.g. `C:/models/document-cleanup:/models:ro` and `CGAN_CHECKPOINT=/models/latest_net_G.pth`. The native default repository path must not override Docker's `/opt/...` path. Pretrained docTR weights download on first use; prewarm before accepting jobs. Network-unavailable first use falls back with a warning, not a fabricated confidence. Weights are cached by docTR; checkpoint files are deliberately not committed.

## Quality checks

```powershell
cd ml-service
..\.tools\python311-portable\python.exe -m pytest -q
..\.tools\python311-portable\python.exe scripts/benchmark_ocr.py
..\.tools\python311-portable\python.exe scripts/benchmark_ocr.py --manifest C:/benchmarks/pages.json --backend cgan_doctr
```

The benchmark's manifest contains image paths and independently verified transcriptions. It reports character error rate (CER), word error rate (WER), confidence, latency, applied backend and fallback warnings, without printing source text. Its default is a clean synthetic English ticket, **not a representative messy-document benchmark**. Run the same labeled corpus with and without enhancement before enabling GANs in production; inspect PNR/date exact-match errors as well as aggregate CER/WER. The benchmark uses full dynamic-programming edit distance and is intended for bounded evaluation pages, not public API input.

Remaining limitations: no trained cleanup weights; no dirty/clean evaluation corpus; no GPU validation; straight-page docTR assumptions do not correct every skew/orientation; no dedicated multilingual model or table parser; full-page OCR increases CPU time, weight-cache disk use, JSONB/Redis size and job timeout risk. A distributed worker pool can load one model per process and exhaust RAM. There is no claimed accuracy improvement or guarantee that GAN inference is beneficial.

Primary references: https://github.com/junyanz/pytorch-CycleGAN-and-pix2pix and https://mindee.github.io/doctr/v0.12.0/using_doctr/using_models.html.

## Verification and changed files (2026-10-08)

Phase 1 - integration/configuration: `ml-service/app/core/config.py`, `ml-service/app/services/cgan_service.py` (new), `ml-service/app/services/structured_ocr.py` (new), `ml-service/app/services/extraction_service.py`, `ml-service/app/services/document_analysis.py`, `ml-service/app/api/health_routes.py`, `ml-service/requirements-ocr.txt` (new), `ml-service/Dockerfile`, `ml-service/.env.example`, `frontend/src/types/index.ts`. Dependencies installed locally, upstream revision verified, docTR import successful and `pip check` passed. No actual `.env` file was edited.

Phase 2 - verification/documentation: `ml-service/tests/conftest.py`, `ml-service/tests/test_structured_ocr.py` (new), `ml-service/scripts/benchmark_ocr.py` (new), `OCR_ARCHITECTURE.md` (new), `README.md`, `PROJECT_CONTEXT.md`, `SECURITY_OVERVIEW.md`.

Final checks: **49 ML tests passed**, backend `npm run build` passed, frontend `npm run lint` and `npx tsc --noEmit` passed. The test suite does not fetch neural weights; the optional upstream adapter test uses explicitly random fixture weights only to verify state_dict compatibility and output dimensions, not OCR quality. All 49 tests ran locally without skips.

Separate real docTR smoke benchmark: clean synthetic English ticket, CER 0, WER 0, mean confidence 99.6%, 35.45 seconds including first model initialization/download. This is a single easy example, not generalizable accuracy evidence.

Read-only extraction of the existing two-page uploaded ticket: 45.89 seconds including initialization, two structured layouts, two summaries, one PNR match and four date matches; page mean confidence 95.4% and 96.5%. Source SHA-256 unchanged. This check did **not** update the saved analysis or reindex existing documents. Reprocess existing uploads to save the new layout metadata; new uploads use the new path automatically.

Local ML was restarted, and ML/backend/frontend liveness endpoints returned HTTP 200. ML health reports `ocr_backend=doctr`, CPU, no GAN checkpoint, Redis disabled. Previous Redis/readiness and public-deployment limitations remain; liveness is not a full readiness/security certification. Docker image building and trained-GAN quality testing remain unverified because Docker and a document-cleanup checkpoint are unavailable.
