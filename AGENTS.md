# AGENTS.md

Guidance for all AI agents working in this repository.

> **Single source of truth: [CLAUDE.md](CLAUDE.md).** Build & test commands, project
> conventions, architecture, and current phase are maintained there. This file intentionally
> does not duplicate them — that avoids the two drifting apart. Read CLAUDE.md before changing code.

## Key Documents

- [CLAUDE.md](CLAUDE.md) — conventions, build/test commands, architecture (start here)
- [README.md](README.md) for project overview
- [backend/README.md](backend/README.md) for backend guide
- [frontend/README.md](frontend/README.md) for frontend guide
- [docs/product-requirements.adoc](docs/product-requirements.adoc) for feature specifications
- [docs/adr.adoc](docs/adr.adoc) for architecture decisions
- [MILESTONES.md](MILESTONES.md) for scope and progress

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_backlog_instructions()` to load the tool-oriented overview. Use the `instruction` selector when you need `task-creation`, `task-execution`, or `task-finalization`.

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
