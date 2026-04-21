---
id: TASK-051
title: Fix literal search semantics for LIKE wildcard characters
status: Done
assignee:
  - codex
created_date: '2026-04-21 08:56'
updated_date: '2026-04-21 09:04'
labels:
  - backend
  - bug
  - search
dependencies: []
references:
  - >-
    /Users/mama/dev/pina/backend/src/main/java/dev/pina/backend/service/SearchService.java
  - >-
    /Users/mama/dev/pina/backend/src/test/java/dev/pina/backend/api/SearchResourceTest.java
documentation:
  - README.md
  - backend/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Search query parameter `q` is documented and used as plain text, but `%` and `_` currently change SQL LIKE semantics in backend search. Fix search so filename and album queries containing LIKE metacharacters are treated literally while preserving existing relevance behavior and parameterized query safety.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Search treats `%`, `_`, and escape characters in `q` as literal text for library and space search results.
- [x] #2 Backend search remains parameterized and does not broaden matches for SQL-injection-like input strings.
- [x] #3 Regression coverage verifies literal matching and preserves existing search behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update SearchService to build a LIKE-safe contains pattern by normalizing the query and escaping `\\`, `%`, and `_` before binding it as a parameter.
2. Add explicit `ESCAPE '\\'` clauses to every JPQL LIKE predicate used by search so escaped metacharacters are treated literally in filenames, album names, and descriptions.
3. Extend SearchResourceTest with regression coverage for literal underscore/percent searches and an injection-shaped query string to confirm the endpoint remains parameterized and returns only literal matches.
4. Run focused backend tests for SearchResourceTest and, if green, summarize the injection-safety conclusion from the implementation and test evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated SearchService to escape `LIKE` metacharacters using an explicit `!` escape character and added `ESCAPE '!'` to all search JPQL predicates so `%` and `_` are treated as literal user input.

Extended SearchResourceTest with regression coverage for literal `_`, `%`, backslash-containing text, and an injection-shaped query string; also fixed local test JSON helpers to escape special characters correctly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Treated search query `q` as literal text before binding it into JPQL `LIKE` predicates by introducing a dedicated contains-pattern escaping step in `SearchService` and adding explicit `ESCAPE '!'` clauses for filename, album name, and album description matching. This preserves substring search behavior while preventing `%` and `_` from broadening matches.

Added API-level regression tests in `SearchResourceTest` for literal underscore and percent searches, literal backslash-containing text, and an injection-shaped query string (`%' OR 1=1 --`) to verify the endpoint still returns only literal matches. While adding that coverage, updated the local JSON payload helpers in the test to correctly escape backslashes and quotes.

Validation performed: `./gradlew test --tests dev.pina.backend.api.SearchResourceTest` and `./gradlew spotlessCheck`. The search endpoint remains parameterized through named JPQL parameters, so this change addresses wildcard-semantics regression rather than raw SQL injection; the injection-shaped regression test confirms the input does not expand result scope.
<!-- SECTION:FINAL_SUMMARY:END -->
