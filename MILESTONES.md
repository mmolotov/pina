# Milestones

Development roadmap for PINA (Private Image Network Archive).

Legend: ✅ done · 🔲 todo

---

## Phase 1: Foundation (MVP skeleton)

- ✅ Scaffold monorepo: backend (Quarkus), ML (Python), proto, docker
- ✅ Gradle + Java + Quarkus setup
- ✅ CI: GitHub Actions for backend (build, format check, test, SpotBugs, coverage)
- ✅ Temporary dev user context with auto-created Personal Library
- ✅ DB schema V1: users, personal_libraries, photos, photo_variants, albums, album_photos (Flyway)
- ✅ Storage SPI + local FS implementation
- ✅ Photo upload pipeline: validate → per-uploader SHA-256 dedup → compress → 3 thumbnails → EXIF extraction (JPEG/PNG only)
- ✅ Media Asset model: uploaded photos belong to uploader and are anchored in Personal Library
- ✅ Album reference model: albums point to existing photos via references, not copies
- ✅ REST API: photo upload/get/file/delete, album create/list/update/delete, add/remove photo references, health
- ✅ OpenAPI / Swagger UI
- ✅ Docker Compose: backend + PostgreSQL (dev services via Testcontainers)
- ✅ Dockerfile for backend
- ✅ Code quality: Spotless (eclipse format), SpotBugs
- ✅ Frontend skeleton (React + React Router 7 + Vite + Tailwind CSS)

## Phase 2: Auth + Spaces

- ✅ Consolidated Flyway core schema now includes auth and Spaces tables: linked_accounts, spaces, space_memberships, invite_links, favorites, refresh_tokens
- ✅ JWT authentication: username/password registration & login (SmallRye JWT + BCrypt)
- ✅ Replace hardcoded temp user with authenticated user context (JWT-based UserResolver)
- ✅ Ownership enforcement: users can only access their own photos/albums (404 for non-owners)
- ✅ Space entity + Subspace hierarchy (adjacency list, max depth 5)
- ✅ SpaceMembership: roles (Owner, Admin, Member, Viewer) with role-based authorization
- ✅ Space CRUD + member management REST API (11 endpoints)
- ✅ OIDC providers: Google login + account linking (jose4j JWKS verification)
- ✅ Invite link generation, validation, join flow (atomic usage tracking, expiration, usage limits)
- ✅ Space albums (shared access via references to uploader-owned assets, role-based access)
- ✅ Subspace visibility restrictions (inheritMembers flag, per-subspace admin overrides)
- ✅ Subspace role inheritance (inherited roles from parent, per-member overrides, max depth 5)
- ✅ Favorites: per-user favorite photos and albums (videos pending Phase 7)

## Phase 3: Frontend

- ✅ Framework selection: React + React Router 7 + Vite + Tailwind CSS
- 🔲 Gallery view (grid, timeline) — mixed photos & videos
- 🔲 Photo viewer (zoom, swipe, EXIF panel)
- 🔲 Video player (inline, adaptive streaming, playback controls)
- 🔲 Upload UI (drag & drop, progress, batch) — photos & videos
- 🔲 Album management
- 🔲 Search: text, faces, tags
- 🔲 Admin panel: Space management, users, invite links, ML pipeline config, transcoding config, storage stats, system health dashboard
- 🔲 Responsive / mobile-friendly

## Phase 4: ML Service (basic)

- 🔲 gRPC contract (proto definitions)
- 🔲 Python service scaffold: FastAPI (admin) + gRPC server
- 🔲 Pipeline engine: configurable processing steps
- 🔲 Model registry with YAML manifests
- 🔲 Model download from HuggingFace on first startup
- 🔲 CLIP model: embeddings + auto-tagging
- 🔲 InsightFace model: face detection + recognition
- 🔲 Backend integration: photo upload → gRPC ML task → results in DB
- 🔲 pgvector: store and query embeddings
- 🔲 Search by tags
- 🔲 Face clustering and grouping
- 🔲 Video keyframe extraction for ML analysis

## Phase 5: Telegram

- 🔲 TG Bot: auto-collect photos and videos from group chats
- 🔲 TG Bot: link chat to Space
- 🔲 TG Bot: basic commands (browse, search)
- 🔲 TG Mini App: browse & upload client (photos & videos)
- 🔲 TG Mini App: inline video playback
- 🔲 Telegram Login Widget auth
- 🔲 QR-code join for Spaces

## Phase 6: Advanced Features

- 🔲 Additional ML models: captioning, OCR, NSFW detection, aesthetic scoring, geo estimation
- 🔲 Custom user-uploaded ONNX models
- 🔲 Duplicate detection (perceptual hashing)
- 🔲 Background reindexing (re-run ML on existing media)
- 🔲 S3 storage backend (full implementation)
- 🔲 WebDAV storage backend
- 🔲 Retention / compression policies
- 🔲 Shared links (public read-only, no auth)
- 🔲 Scalable ML worker pool (multi-GPU)

## Phase 7: Video Support (backend)

- 🔲 Video entity + DB migration: videos, video_variants tables
- 🔲 Video upload endpoint (multipart, size limit up to 2 GB)
- 🔲 Video metadata extraction (FFprobe): duration, resolution, FPS, codecs, bitrate, GPS
- 🔲 Poster image generation (representative keyframe)
- 🔲 Animated thumbnail generation (3–5 sec loop, muted WebM/GIF)
- 🔲 Poster thumbnails: SM / MD / LG (same pipeline as photos)
- 🔲 SHA-256 dedup for videos
- 🔲 Video streaming via HTTP range requests (serve original)
- 🔲 Async transcoding pipeline (FFmpeg)
- 🔲 Transcoding profiles: 360p, 720p, 1080p (H.264), configurable
- 🔲 Hardware acceleration support (VAAPI, NVENC, VideoToolbox)
- 🔲 Transcoding progress API
- 🔲 Re-transcode trigger (admin)
- 🔲 Video storage policies: store originals toggle, max upload size
- 🔲 Unified album media endpoint (photos + videos)
- 🔲 Video deletion (cascade: all variants, poster, animated thumbnail)
- 🔲 FFmpeg bundled in Docker image
- 🔲 Audio transcription (speech-to-text) as optional ML pipeline step
