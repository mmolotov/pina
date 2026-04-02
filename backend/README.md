# PINA Backend

Backend for PINA: photo ingestion, derived variants, Personal Library ownership, album references,
JWT authentication, ownership enforcement, and Spaces with role-based access.

What is implemented today (Phase 1 + Phase 2):

- JWT authentication: username/password registration & login (SmallRye JWT + BCrypt)
- Refresh token flow: short-lived access tokens (15 min) + long-lived refresh tokens (30 days) with
  rotation
- Google OIDC login + account linking (jose4j JWKS token verification)
- Linked accounts model supporting multiple auth providers (LOCAL, GOOGLE, TELEGRAM)
- Ownership enforcement: users can only access their own photos/albums (404 for non-owners)
- Spaces with subspace hierarchy (adjacency list, max depth 5)
- Space membership with roles: Owner, Admin, Member, Viewer
- Subspace role inheritance: `getEffectiveRole()` walks up parent chain
- Subspace visibility restrictions: `inheritMembers` flag per subspace
- Space albums: shared access via references to uploader-owned assets, role-based access, album-scoped
  file streaming
- Invite link generation, validation, active-link listing, and authenticated join flow (atomic usage
  tracking, expiration, usage limits)
- Favorites: per-user favorite photos and albums (videos pending Phase 7)
- Photo upload, metadata retrieval, file serving, and deletion
- Media Asset model backed by `photos` + `photo_variants`
- Auto-created `PersonalLibrary` for the current user
- Albums stored in the user's Personal Library
- Album entries as references to existing photo assets (`album_photos`), not copies
- Local filesystem storage, PostgreSQL, Flyway, OpenAPI, health endpoint

What is not implemented yet:

- GitHub OIDC provider
- Telegram Login Widget
- Video pipeline
- ML/gRPC integration

## Getting Started

### 1. Generate JWT keys

JWT signing requires an RSA key pair. Keys are **not** checked into the repository.

```bash
mkdir -p dev-keys
openssl genrsa -out dev-keys/privateKey.pem 2048
openssl rsa -in dev-keys/privateKey.pem -pubout -out dev-keys/publicKey.pem
```

By default the application looks for keys in `dev-keys/`. For production, override via
environment variables:

```bash
export PINA_JWT_PRIVATE_KEY=/path/to/privateKey.pem
export PINA_JWT_PUBLIC_KEY=/path/to/publicKey.pem
```

### 2. Build & run

```bash
./gradlew quarkusDev          # dev mode with hot reload
./gradlew build                # build + test
./gradlew test                 # run tests only
./gradlew spotlessApply        # auto-format code
./gradlew spotlessCheck        # verify formatting
./gradlew spotbugsMain         # static analysis
```

Once running:

- API: `http://localhost:8080/api/v1/`
- Swagger UI: `http://localhost:8080/q/swagger-ui`
- Health: `http://localhost:8080/q/health`

## Stack

| Dependency         | Version | Notes                                                          |
|--------------------|---------|----------------------------------------------------------------|
| Java               | 25 LTS  | no preview features                                            |
| Quarkus            | 3.32.4  | pinned via platform BOM                                        |
| SmallRye JWT       | —       | via Quarkus extension                                          |
| jose4j             | —       | transitive via SmallRye JWT; used for Google JWKS verification |
| BCrypt (favrdb)    | 0.10.2  | password hashing                                               |
| Gradle             | 9.4.1   | Kotlin DSL                                                     |
| PostgreSQL         | 17      | via Dev Services / Testcontainers                              |
| Spotless           | 8.4.0   | eclipse formatter                                              |
| SpotBugs           | 6.4.8   | static analysis                                                |
| Thumbnailator      | 0.4.21  | image compression + resize                                     |
| metadata-extractor | 2.19.0  | EXIF extraction                                                |

## Current Domain Model

- `User`: authenticated user; resolved from JWT subject claim
- `LinkedAccount`: links a user to an auth provider (LOCAL, GOOGLE, TELEGRAM) with provider-specific
  credentials
- `PersonalLibrary`: one per user, created automatically on registration
- `Photo`: media asset owned by a user and anchored in that user's Personal Library
- `PhotoVariant`: stored derivative files (`ORIGINAL`, `COMPRESSED`, `THUMB_*`)
- `Album`: user-owned collection inside the same Personal Library (or a Space)
- `AlbumPhoto`: reference edge from album to existing photo asset
- `Space`: collaborative group with visibility (PRIVATE/PUBLIC), optional parent (subspaces, max
  depth 5), `inheritMembers` flag for visibility control
- `SpaceMembership`: composite PK (space, user) with role (OWNER, ADMIN, MEMBER, VIEWER)
- `InviteLink`: space invite with code, default role, expiration, usage limits; public preview +
  authenticated join flow
- `Favorite`: per-user favorite for photos and albums today; VIDEO target type is reserved for a
  future phase

Important semantics:

- Upload reuses an existing `Photo` asset only for the same uploader. Different users can upload
  the same file content independently into their own libraries.
- Adding a photo to an album creates a reference row in `album_photos`; files are not copied.
- Deleting an album removes only album references.
- Deleting a photo deletes the asset and all variant files only when no album references exist.
- If references still exist, `DELETE /api/v1/photos/{id}` returns `409 Conflict`.
- Space endpoints return 404 (not 403) to non-members for information hiding.
- Only OWNER and ADMIN can manage members; ADMIN cannot modify other ADMINs or the OWNER.
- Subspace role inheritance: `getEffectiveRole()` checks direct membership first, then walks up the
  parent chain respecting `inheritMembers` flags.

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

- `AuthService`: registration, authentication (BCrypt), JWT token generation, Google OIDC login +
  account linking
- `UserResolver`: resolves current user from JWT subject claim; profile updates
- `PhotoService`: upload pipeline, dedup, variant generation, delete rules
- `AlbumService`: create/update/delete albums, manage album references, Space album support
- `PersonalLibraryService`: resolve or create the user's Personal Library
- `SpaceService`: Space CRUD, subspace hierarchy, membership management, role checks, effective role
  resolution
- `InviteLinkService`: invite link creation, validation, atomic join flow, revocation
- `FavoriteService`: add/remove/list favorites, target existence validation
- `GoogleTokenVerifier`: Google ID token verification via jose4j JWKS

## Upload Pipeline

`POST /api/v1/photos`:

1. Stream multipart upload into a temp file.
2. Compute SHA-256 content hash.
3. Reuse existing asset on duplicate hash for the same uploader; allow separate `Photo` rows for
   different uploaders even when the file content is identical.
4. Decode image and extract EXIF.
5. Persist `Photo` in the uploader's Personal Library.
6. Generate original/compressed/thumbnail variants; stored file paths are keyed by `photo.id`, not
   by the content hash.
7. Store variant metadata in `photo_variants`.

Supported input formats today:

- JPEG
- PNG

Compression output format is configurable, but the current implementation supports `jpeg`, `jpg`,
and `png`. Default is `jpeg`.

## API

All endpoints under `/api/v1/*` require a valid JWT `Authorization: Bearer <token>` header,
except for registration, login, Google OIDC, refresh, logout, invite preview, health, and OpenAPI
endpoints.

### Auth

| Method | Path                       | Description                               |
|--------|----------------------------|-------------------------------------------|
| `POST` | `/api/v1/auth/register`    | Register with username + password         |
| `POST` | `/api/v1/auth/login`       | Login, returns JWT token                  |
| `POST` | `/api/v1/auth/google`      | Login/register via Google ID token        |
| `POST` | `/api/v1/auth/refresh`     | Exchange refresh token for new token pair |
| `POST` | `/api/v1/auth/logout`      | Revoke refresh token                      |
| `POST` | `/api/v1/auth/link/google` | Link Google account to current user       |
| `GET`  | `/api/v1/auth/me`          | Get current user profile                  |
| `PUT`  | `/api/v1/auth/me`          | Update current user profile               |

Auth response format (register, login, google, refresh):

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "a1b2c3d4...",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "name": "..."
  }
}
```

- `accessToken`: short-lived JWT (15 min default), used in `Authorization: Bearer` header
- `refreshToken`: opaque token (30 days default), used to obtain new token pairs via `/auth/refresh`
- `expiresIn`: access token lifetime in seconds
- Refresh tokens are single-use (rotation): each refresh invalidates the old token and issues a new
  one

### Photos

| Method   | Path                                          | Description                                             |
|----------|-----------------------------------------------|---------------------------------------------------------|
| `GET`    | `/api/v1/photos?page=&size=&needsTotal=`      | List current user's uploaded photos with pagination     |
| `POST`   | `/api/v1/photos`                              | Upload photo from multipart field `file`                |
| `GET`    | `/api/v1/photos/{id}`                         | Get photo metadata                                      |
| `GET`    | `/api/v1/photos/{id}/file?variant=COMPRESSED` | Stream a stored variant                                 |
| `DELETE` | `/api/v1/photos/{id}`                         | Delete asset and variants if no album references remain |

### Albums

| Method   | Path                                                 | Description                                     |
|----------|------------------------------------------------------|-------------------------------------------------|
| `POST`   | `/api/v1/albums`                                     | Create album in current user's Personal Library |
| `GET`    | `/api/v1/albums`                                     | List current user's albums                      |
| `PUT`    | `/api/v1/albums/{id}`                                | Rename/update description                       |
| `DELETE` | `/api/v1/albums/{id}`                                | Delete album and its references                 |
| `GET`    | `/api/v1/albums/{id}/photos?page=&size=&needsTotal=` | List referenced photos with paged response      |
| `POST`   | `/api/v1/albums/{id}/photos/{photoId}`               | Add existing photo reference                    |
| `DELETE` | `/api/v1/albums/{id}/photos/{photoId}`               | Remove photo reference                          |

Album photo listing response:

```json
{
  "items": [
    {
      "...": "PhotoDto"
    }
  ],
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
- `hasNext` is computed without a full count query; totals are populated only when`needsTotal=true`.

### Spaces

| Method   | Path                                   | Description                         | Required Role           |
|----------|----------------------------------------|-------------------------------------|-------------------------|
| `POST`   | `/api/v1/spaces`                       | Create a new Space                  | Any authenticated       |
| `GET`    | `/api/v1/spaces`                       | List current user's Spaces          | Any authenticated       |
| `GET`    | `/api/v1/spaces/{id}`                  | Get Space details                   | Any member              |
| `PUT`    | `/api/v1/spaces/{id}`                  | Update Space (incl. inheritMembers) | Owner or Admin          |
| `DELETE` | `/api/v1/spaces/{id}`                  | Delete Space                        | Owner only              |
| `GET`    | `/api/v1/spaces/{id}/members`          | List members                        | Any member              |
| `POST`   | `/api/v1/spaces/{id}/members`          | Add member                          | Owner or Admin          |
| `PUT`    | `/api/v1/spaces/{id}/members/{userId}` | Change member role                  | Owner; Admin restricted |
| `DELETE` | `/api/v1/spaces/{id}/members/{userId}` | Remove member (or self-leave)       | Owner; Admin restricted |
| `GET`    | `/api/v1/spaces/{id}/subspaces`        | List visible subspaces              | Any member              |
| `POST`   | `/api/v1/spaces/{id}/subspaces`        | Create subspace                     | Owner or Admin          |

### Space Albums

| Method   | Path                                                    | Description                                                         | Required Role           |
|----------|---------------------------------------------------------|---------------------------------------------------------------------|-------------------------|
| `POST`   | `/api/v1/spaces/{id}/albums`                            | Create album in Space                                               | Any member              |
| `GET`    | `/api/v1/spaces/{id}/albums`                            | List Space albums                                                   | Viewer+                 |
| `PUT`    | `/api/v1/spaces/{id}/albums/{albumId}`                  | Update album                                                        | Owner of album or Admin |
| `DELETE` | `/api/v1/spaces/{id}/albums/{albumId}`                  | Delete album                                                        | Owner of album or Admin |
| `POST`   | `/api/v1/spaces/{id}/albums/{albumId}/photos/{photoId}` | Add own photo to Space album                                        | Any member              |
| `DELETE` | `/api/v1/spaces/{id}/albums/{albumId}/photos/{photoId}` | Remove own photo from Space album; Admin/album owner can remove any | Member+                 |
| `GET`    | `/api/v1/spaces/{id}/albums/{albumId}/photos`           | List photos in Space album                                          | Viewer+                 |
| `GET`    | `/api/v1/spaces/{id}/albums/{albumId}/photos/{photoId}/file?variant=COMPRESSED` | Stream a photo variant through the Space album context | Viewer+                 |

### Space Invite Links

| Method   | Path                                     | Description              | Required Role  |
|----------|------------------------------------------|--------------------------|----------------|
| `POST`   | `/api/v1/spaces/{id}/invites`            | Create invite link       | Owner or Admin |
| `GET`    | `/api/v1/spaces/{id}/invites`            | List active invite links | Owner or Admin |
| `DELETE` | `/api/v1/spaces/{id}/invites/{inviteId}` | Revoke invite link       | Owner or Admin |

### Invite Links

| Method | Path                          | Description                                              |
|--------|-------------------------------|----------------------------------------------------------|
| `GET`  | `/api/v1/invites/{code}`      | Public invite preview (space name, role)                 |
| `POST` | `/api/v1/invites/{code}/join` | Join Space via invite link (authenticated user required) |

### Favorites

| Method   | Path                                            | Description                                            |
|----------|-------------------------------------------------|--------------------------------------------------------|
| `POST`   | `/api/v1/favorites`                             | Add a favorite (photo or album today; video is future) |
| `DELETE` | `/api/v1/favorites/{id}`                        | Remove a favorite                                      |
| `GET`    | `/api/v1/favorites?type=`                       | List user's favorites (optional type filter)           |
| `GET`    | `/api/v1/favorites/check?targetType=&targetId=` | Check if a target is favorited                         |

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
date-partitioned by variant type and keyed by `photo.id`:

```text
data/
├── originals/2026/03/{photo-id}.jpg
├── compressed/2026/03/{photo-id}.jpeg
└── thumbnails/
    ├── sm/2026/03/{photo-id}.jpeg
    ├── md/2026/03/{photo-id}.jpeg
    └── lg/2026/03/{photo-id}.jpeg
```

S3 and WebDAV providers implement the `StorageProvider` interface but currently throw
`UnsupportedOperationException`. They will be completed in Phase 6.

## Database

Schema is managed by Flyway migrations in `src/main/resources/db/migration/`.

Current schema is defined by the consolidated `V01__core_schema.sql` file and includes:

- `users`
- `personal_libraries`
- `photos`
- `photo_variants`
- `albums`
- `album_photos`
- `linked_accounts`
- `spaces`
- `space_memberships`
- `invite_links`
- `favorites`
- `refresh_tokens`

Quarkus Dev Services starts PostgreSQL automatically in dev/test mode. Docker is required.

## Configuration

Key properties from `src/main/resources/application.properties`:

| Property                                | Default                   | Description                               |
|-----------------------------------------|---------------------------|-------------------------------------------|
| `pina.jwt.private-key`                  | `dev-keys/privateKey.pem` | RSA private key for JWT signing           |
| `pina.jwt.public-key`                   | `dev-keys/publicKey.pem`  | RSA public key for JWT verification       |
| `pina.auth.bcrypt.cost`                 | `12`                      | BCrypt hashing cost factor                |
| `pina.auth.google.client-id`            | —                         | Google OAuth client ID (empty = disabled) |
| `pina.auth.refresh-token.lifespan`      | `2592000`                 | Refresh token TTL in seconds (30 days)    |
| `pina.storage.provider`                 | `local`                   | active storage backend                    |
| `pina.storage.local.base-path`          | `data`                    | local storage root                        |
| `pina.photo.store-original`             | `true`                    | keep original uploaded file               |
| `pina.photo.compression.format`         | `jpeg`                    | compressed output format                  |
| `pina.photo.compression.quality`        | `82`                      | quality for compressed variant            |
| `pina.photo.compression.max-resolution` | `2560`                    | max longest side                          |
| `pina.photo.thumbnails.sm-size`         | `256`                     | square small thumbnail                    |
| `pina.photo.thumbnails.md-width`        | `1280`                    | medium thumbnail width                    |
| `pina.photo.thumbnails.lg-width`        | `1920`                    | large thumbnail width                     |

## Testing

Tests are integration-style `@QuarkusTest` tests with REST Assured and real PostgreSQL via Dev
Services.

Useful commands:

- `./gradlew test`
- `./gradlew test --tests "dev.pina.backend.api.PhotoResourceTest"`

Current coverage focus:

- Auth: registration, login, duplicate username, token generation, /me endpoint
- Refresh tokens: refresh, rotation, revocation after use, logout, invalid token handling
- Google OIDC: login, account creation, account linking, disabled provider (
  `@InjectMock GoogleTokenVerifier`)
- Ownership enforcement: photos and albums only accessible by owner (404 for non-owners)
- Spaces: CRUD, subspace depth limits, membership management, role-based authorization
- Subspace role inheritance: direct, inherited from parent, deep inheritance, override behavior
- Subspace visibility: `inheritMembers` flag enable/disable/re-enable, deep blocking
- Space albums: create, list, update, delete, add/remove photos, role-based access
- Invite links: create, list, revoke, preview, join, usage limits, expiration, already member
- Favorites: add, remove, list with type filter, check, duplicate prevention, target validation
- Photo upload / dedup / file serving / delete rules
- Album create/update/delete and reference management
- Storage provider behavior
- Health endpoint

Test helpers:

- `TestAuthHelper`: registers a test user via REST and caches the JWT token for resource tests
- `TestUserHelper`: creates User + LinkedAccount + PersonalLibrary directly in DB for service tests
