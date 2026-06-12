-- Face clustering foundation: stable per-owner clusters of face descriptors.

CREATE TABLE face_clusters
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    owner_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            VARCHAR(100),
    centroid        vector(512) NOT NULL,
    -- Running count of descriptors absorbed into the centroid (monotonic;
    -- visible face counts are derived from photo_faces at query time).
    centroid_weight INT         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_face_clusters_owner ON face_clusters (owner_id);

ALTER TABLE photo_faces
    ADD COLUMN cluster_id UUID REFERENCES face_clusters (id) ON DELETE SET NULL;

CREATE INDEX idx_photo_faces_cluster ON photo_faces (cluster_id);
