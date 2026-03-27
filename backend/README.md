# PINA Backend

Phase 1 backend for PINA: photo ingestion, derived variants, Personal Library ownership, and album
references. The current implementation is intentionally backend-first and still uses a temporary
single-user resolver instead of real authentication.

What is implemented today:

- Photo upload, metadata retrieval, file serving, and deletion
- Media Asset model backed by `photos` + `photo_variants`
- Auto-created `PersonalLibrary` for the current user
- Albums stored in the user's Personal Library
- Album entries as references to existing photo assets (`album_photos`), not copies
- Local filesystem storage, PostgreSQL, Flyway, OpenAPI, health endpoint

What is not implemented yet:

- OIDC or email/password auth
- Spaces, memberships, invite links, shared/public access
- Video pipeline
- ML/gRPC integration

## Quick Reference

```bash
./gradlew quarkusDev
./gradlew build
./gradlew test
./gradlew spotlessApply
./gradlew spotlessCheck
./gradlew spotbugsMain
```

Once running:

- API: `http://localhost:8080/api/v1/`
- Swagger UI: `http://localhost:8080/q/swagger-ui`
- Health: `http://localhost:8080/q/health`

## Stack

| Dependency         | Version | Notes                             |
|--------------------|---------|-----------------------------------|
| Java               | 25 LTS  | no preview features               |
| Quarkus            | 3.32.4  | pinned via platform BOM           |
| Gradle             | 9.4.1   | Kotlin DSL                        |
| PostgreSQL         | 17      | via Dev Services / Testcontainers |
| Spotless           | 8.4.0   | eclipse formatter                 |
| SpotBugs           | 6.4.8   | static analysis                   |
| Thumbnailator      | 0.4.21  | image compression + resize        |
| metadata-extractor | 2.19.0  | EXIF extraction                   |

## Current Domain Model

Phase 1 uses a minimal ownership model that is compatible with the PRD direction:

- `User`: current owner/uploader; still resolved from a temporary dev stub
- `PersonalLibrary`: one per user, created automatically
- `Photo`: media asset owned by a user and anchored in that user's Personal Library
- `PhotoVariant`: stored derivative files (`ORIGINAL`, `COMPRESSED`, `THUMB_*`)
- `Album`: user-owned collection inside the same Personal Library
- `AlbumPhoto`: reference edge from album to existing photo asset

Important semantics:

- Upload creates or reuses a `Photo` asset and stores it in the uploader's Personal Library.
- Adding a photo to an album creates a reference row in `album_photos`; files are not copied.
- Deleting an album removes only album references.
- Deleting a photo deletes the asset and all variant files only when no album references exist.
- If references still exist, `DELETE /api/v1/photos/{id}` returns `409 Conflict`.

This is groundwork for future Space albums. Phase 2 will add Spaces and memberships on top of the
same asset/reference concept instead of replacing it.

## Package Layout

```text
dev.pina.backend/
├── api/        REST resources
├── api/dto/    request/response DTOs
├── config/     typed config mappings
├── domain/     Panache entities
├── service/    business logic
└── storage/    storage SPI + provider implementations
```

Main services:

- `PhotoService`: upload pipeline, dedup, variant generation, delete rules
- `AlbumService`: create/update/delete albums, manage album references
- `PersonalLibraryService`: resolve or create the user's Personal Library
- `UserResolver`: temporary Phase 1 identity stub — returns a hardcoded dev user
  (`admin@pina.dev`); will be replaced in Phase 2 with SecurityIdentity / OIDC-based resolution

## Upload Pipeline

`POST /api/v1/photos`:

1. Stream multipart upload into a temp file.
2. Compute SHA-256 content hash.
3. Reuse existing asset on duplicate hash.
4. Decode image and extract EXIF.
5. Persist `Photo` in the uploader's Personal Library.
6. Generate original/compressed/thumbnail variants.
7. Store variant metadata in `photo_variants`.

Supported input formats today:

- JPEG
- PNG

Compression output format is configurable, but the current implementation supports `jpeg`, `jpg`,
and `png`. Default is `jpeg`.

## API

### Photos

| Method   | Path                                          | Description                                             |
|----------|-----------------------------------------------|---------------------------------------------------------|
| `GET`    | `/api/v1/photos?page=&size=&needsTotal=`      | List current user's uploaded photos with pagination     |
| `POST`   | `/api/v1/photos`                              | Upload photo from multipart field `file`                |
| `GET`    | `/api/v1/photos/{id}`                         | Get photo metadata                                      |
| `GET`    | `/api/v1/photos/{id}/file?variant=COMPRESSED` | Stream a stored variant                                 |
| `DELETE` | `/api/v1/photos/{id}`                         | Delete asset and variants if no album references remain |

### Albums

| Method   | Path                                     | Description                                     |
|----------|------------------------------------------|-------------------------------------------------|
| `POST`   | `/api/v1/albums`                         | Create album in current user's Personal Library |
| `GET`    | `/api/v1/albums`                         | List current user's albums                      |
| `PUT`    | `/api/v1/albums/{id}`                    | Rename/update description                       |
| `DELETE` | `/api/v1/albums/{id}`                    | Delete album and its references                 |
| `GET`    | `/api/v1/albums/{id}/photos?page=&size=&needsTotal=` | List referenced photos with paged response      |
| `POST`   | `/api/v1/albums/{id}/photos/{photoId}`   | Add existing photo reference                    |
| `DELETE` | `/api/v1/albums/{id}/photos/{photoId}`   | Remove photo reference                          |

Album photo listing response:

```json
{
  "items": [{ "...": "PhotoDto" }],
  "page": 0,
  "size": 50,
  "hasNext": true,
  "totalItems": 137,
  "totalPages": 3
}
```

Notes:

- `needsTotal=false` by default; in that mode `totalItems` and `totalPages` are omitted.
- The server caps requested `size` to `100`.
- `hasNext` is computed without a full count query; totals are populated only when `needsTotal=true`.

### Health

| Method | Path             | Description                  |
|--------|------------------|------------------------------|
| `GET`  | `/api/v1/health` | App status and storage stats |

## Storage

Storage is selected via `pina.storage.provider`.

- `local`: implemented and used in Phase 1
- `s3`: stub only
- `webdav`: stub only

Local files are written under `pina.storage.local.base-path`. The file layout is
date-partitioned by variant type:

```text
data/
├── originals/2026/03/{sha256}.jpg
├── compressed/2026/03/{sha256}.jpeg
└── thumbnails/
    ├── sm/2026/03/{sha256}.jpeg
    ├── md/2026/03/{sha256}.jpeg
    └── lg/2026/03/{sha256}.jpeg
```

S3 and WebDAV providers implement the `StorageProvider` interface but currently throw
`UnsupportedOperationException`. They will be completed in Phase 6.

## Database

Schema is managed by Flyway migrations in `src/main/resources/db/migration/`.

Current Phase 1 tables:

- `users`
- `personal_libraries`
- `photos`
- `photo_variants`
- `albums`
- `album_photos`

Quarkus Dev Services starts PostgreSQL automatically in dev/test mode. Docker is required.

## Configuration

Key properties from `src/main/resources/application.properties`:

| Property                                | Default | Description                    |
|-----------------------------------------|---------|--------------------------------|
| `pina.storage.provider`                 | `local` | active storage backend         |
| `pina.storage.local.base-path`          | `data`  | local storage root             |
| `pina.photo.store-original`             | `true`  | keep original uploaded file    |
| `pina.photo.compression.format`         | `jpeg`  | compressed output format       |
| `pina.photo.compression.quality`        | `82`    | quality for compressed variant |
| `pina.photo.compression.max-resolution` | `2560`  | max longest side               |
| `pina.photo.thumbnails.sm-size`         | `256`   | square small thumbnail         |
| `pina.photo.thumbnails.md-width`        | `1280`  | medium thumbnail width         |
| `pina.photo.thumbnails.lg-width`        | `1920`  | large thumbnail width          |

## Testing

Tests are integration-style `@QuarkusTest` tests with REST Assured and real PostgreSQL via Dev
Services.

Useful commands:

- `./gradlew test`
- `./gradlew test --tests "dev.pina.backend.api.PhotoResourceTest"`

Current coverage focus:

- Photo upload / dedup / file serving / delete rules
- Album create/update/delete and reference management
- Storage provider behavior
- Health endpoint

## Development Notes

- Use `PanacheEntityBase` with explicit `UUID` IDs.
- Keep resource classes thin; put behavior in services.
- Use `StorageProvider` for all file access.
- Do not add production DB URLs to `application.properties`; use environment variables.
- Flyway is the source of truth for schema changes.
- `UserResolver` is temporary and must be replaced in Phase 2 by authenticated user context.
