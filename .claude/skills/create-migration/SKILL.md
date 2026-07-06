---
name: create-migration
description: Create a new Flyway SQL migration for the backend with correct versioning and naming. Use whenever a schema change is needed — Flyway migrations are the source of truth for DDL (never hand-edit the DB or rely on Hibernate auto-DDL).
---

# Create Migration

Flyway is the single source of truth for the schema (`quarkus.flyway.migrate-at-start=true`).
Every schema change ships as a new, immutable, forward-only migration file.

## Location & naming

- Directory: `backend/src/main/resources/db/migration/`
- Pattern: `V<NN>__<snake_case_description>.sql` (zero-padded 2-digit version, e.g. `V01__core_schema.sql`)

## Steps

1. Find the highest existing version and pick the next:
   ```bash
   ls backend/src/main/resources/db/migration/ | sort
   ```
2. Create `V<next>__<description>.sql` from the template below.
3. Validate it applies cleanly by booting the backend (`./gradlew quarkusDev`) or running tests
   (`./gradlew test` — Dev Services applies migrations against a real PostgreSQL).

## Template

```sql
-- V<NN>__<description>.sql
-- Purpose: <one line — what schema change and why>

-- Forward-only DDL. Use IF NOT EXISTS sparingly; prefer deterministic statements.
-- Example:
-- ALTER TABLE photo ADD COLUMN taken_at timestamptz;
-- CREATE INDEX idx_photo_taken_at ON photo (taken_at);
```

## Rules

- **Never edit an already-applied migration** — add a new one to change course.
- Keep each migration focused on one logical change.
- Match existing SQL style (table/column naming, `snake_case`) in earlier migrations.
- Data backfills go in their own migration, after the DDL that enables them.
- If the change touches an entity, update the matching Panache `@Entity` in `domain/` in the same PR.
