-- Phase 4 ML analysis: async job tracking and persisted analysis outputs.

CREATE EXTENSION IF NOT EXISTS vector;

-- One analysis job per photo. Lease-based retry: claiming bumps attempts and
-- pushes next_attempt_at forward, so a crashed worker self-heals.
CREATE TABLE photo_analysis_jobs
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    photo_id        UUID        NOT NULL UNIQUE REFERENCES photos (id) ON DELETE CASCADE,
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts        INT         NOT NULL DEFAULT 0,
    last_error      TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_analysis_jobs_due ON photo_analysis_jobs (status, next_attempt_at);

-- One current image embedding per photo (CLIP space, fixed 512 dims for v1).
CREATE TABLE photo_embeddings
(
    photo_id      UUID PRIMARY KEY REFERENCES photos (id) ON DELETE CASCADE,
    model_id      VARCHAR(100) NOT NULL,
    model_version VARCHAR(50)  NOT NULL,
    embedding     vector(512)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_embeddings_hnsw ON photo_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- Auto-tags from zero-shot classification.
CREATE TABLE photo_tags
(
    id            UUID PRIMARY KEY      DEFAULT gen_random_uuid(),
    photo_id      UUID         NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    label         VARCHAR(100) NOT NULL,
    confidence    REAL         NOT NULL,
    model_id      VARCHAR(100) NOT NULL,
    model_version VARCHAR(50)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_photo_tags_photo_label UNIQUE (photo_id, label)
);

CREATE INDEX idx_photo_tags_photo ON photo_tags (photo_id);
CREATE INDEX idx_photo_tags_label ON photo_tags (label);

-- Face detections with optional ArcFace descriptors for later clustering
-- (face_clusters and photo_faces.cluster_id arrive with the clustering task).
CREATE TABLE photo_faces
(
    id            UUID PRIMARY KEY      DEFAULT gen_random_uuid(),
    photo_id      UUID         NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    bbox_x        REAL         NOT NULL,
    bbox_y        REAL         NOT NULL,
    bbox_width    REAL         NOT NULL,
    bbox_height   REAL         NOT NULL,
    confidence    REAL         NOT NULL,
    descriptor    vector(512),
    model_id      VARCHAR(100) NOT NULL,
    model_version VARCHAR(50)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_faces_photo ON photo_faces (photo_id);
