# Changelog

All notable changes to this boilerplate are documented in this file.

## [1.0.0] - 2026-02-15

### Added

- CI workflow for lint, build, unit tests, e2e tests and coverage.
- Release checklist for SaaS production readiness.
- Global error contract and structured request logging.
- Health/readiness endpoints (`/health`, `/ready`) with DB check.
- Runtime hardening (`helmet`, strict validation, request-id, payload limits).
- Swagger/OpenAPI integration with auth and error response docs.
- Dockerfile (multi-stage, non-root) and `docker-compose.yml`.
- Provider-agnostic deploy guide and env templates per environment.
- Bootstrap scripts:
  - `new-project` (project metadata/bootstrap)
  - `smoke:test` (post-deploy checks)

### Changed

- `lint` script now runs without autofix; `lint:fix` added for local dev.
- Prisma seed updated to be idempotent and configurable via `SEED_ADMIN_EMAIL`.
- README replaced with boilerplate-specific operational documentation.

### Notes

- This release is intended as the reusable base snapshot for freelance projects.
