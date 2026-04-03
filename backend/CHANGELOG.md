# Changelog — Backend

All notable changes to the PINA backend module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Cookie-backed browser session authentication with persistent `browser_sessions` storage
- Browser-session auth endpoints: `/auth/session/register`, `/auth/session/login`, and `/auth/session/logout`
- CSRF protection for mutating requests authenticated by session cookie
- Scheduled cleanup for expired and revoked browser sessions
- Rate limiting for auth endpoints that create or refresh sessions
- Unified auth resolution across bearer JWT and browser session identities
- Geo search for personal photos via `GET /api/v1/photos/geo` (bounding box query)
- Nearby photo search via `GET /api/v1/photos/geo/nearby`
- Dedicated `latitude` and `longitude` fields in `Photo` and `PhotoDto`
- EXIF GPS extraction promoted to typed geo fields in `ExifExtractor.ExifResult`
- Geo-focused API tests covering upload response mapping, bounding box search, nearby search, pole handling,
  antimeridian queries, and exclusion of photos without GPS coordinates

### Changed

- Auth resources and `UserResolver` now work with either bearer tokens or browser sessions without
  per-endpoint branching
- Flyway schema consolidated so photo geo columns and index are now defined directly in `V01__core_schema.sql`
- Geo query validation hardened for inverted latitude ranges and non-finite numeric inputs
- Nearby longitude expansion normalized for pole-adjacent searches and antimeridian-safe bounding boxes
- Bounding box pagination now keeps the same concurrent-change protection used by regular photo listing

## Phase 2

### Added

- JWT authentication: username/password registration & login (SmallRye JWT + BCrypt)
- Linked accounts model (LOCAL, GOOGLE, TELEGRAM providers)
- Auth REST API: register, login, get/update profile
- Google OIDC login + account linking via jose4j JWKS token verification
- Google auth REST API: login/register via ID token, link Google account to existing user
- Refresh token flow: short-lived access tokens (15 min) + long-lived refresh tokens (30 days)
- Refresh token rotation: each refresh invalidates the old token and issues a new pair
- Auth endpoints: refresh (`POST /auth/refresh`), logout (`POST /auth/logout`)
- Consolidated Flyway core schema covering auth, Spaces, favorites, and refresh tokens
- JWT keys moved out of git — generated locally in `dev-keys/`, configurable via env vars for production
- Ownership enforcement on photos and albums (404 for non-owners — information hiding)
- Space entity with subspace hierarchy (adjacency list, max depth 5)
- Space membership with roles: Owner, Admin, Member, Viewer
- Subspace role inheritance: `getEffectiveRole()` walks up parent chain, respects `inheritMembers` flag
- Subspace visibility restrictions: `inheritMembers` boolean flag per subspace, admin-controlled
- Space REST API: 11 core endpoints with role-based authorization
- Space albums: shared access via references to uploader-owned assets with role-based access (7 endpoints)
- Invite link generation with configurable default role, expiration, and usage limits
- Invite link join flow with atomic usage count tracking (UPDATE ... WHERE count check)
- Invite link public endpoints: preview (space name, role) and join
- Invite link management endpoints: create, list, revoke (under Space resource)
- Favorites API: add, remove, list (with optional type filter), check if favorited
- Favorites support PHOTO and ALBUM targets (VIDEO pending Phase 7)
- Domain entities: Space, SpaceMembership, LinkedAccount, InviteLink, Favorite
- Services: InviteLinkService, FavoriteService, GoogleTokenVerifier
- Per-uploader photo deduplication: same uploader reuses the existing asset, different uploaders may store identical files independently
- Photo variant storage paths keyed by `photo.id` to keep physical files isolated per asset
- Test helpers: TestAuthHelper (JWT for resource tests), TestUserHelper (DB-level for service tests)
- Test dependency: quarkus-junit5-mockito for `@InjectMock` support (GoogleTokenVerifier mocking)

### Changed

- UserResolver rewritten from hardcoded dev user to JWT-based resolution
- SpaceResource uses `getEffectiveRole()` instead of `getUserRole()` for inherited role support
- Subspace listing filtered by effective role (hides restricted subspaces from non-members)
- All existing resource tests updated to use authenticated requests
- All existing service tests updated to use TestUserHelper

## Phase 1

### Added

- Java project with Quarkus and Gradle
- JPA entities
- Flyway migration V01
- REST API under `/api/v1/`
- Photo upload pipeline
- Storage SPI with CDI Producer pattern
- OpenAPI spec auto-generation + Swagger UI
- Health checks
- Spotless 8.4.0 with eclipse format
- SpotBugs 6.4.8
- JaCoCo coverage verification
