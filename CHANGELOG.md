# Changelog

All notable changes to this boilerplate are documented in this file.

## [1.2.0] - 2026-02-19

### Added

- Cash movement workflow endpoints:
  - `POST /cash-movements/:id/approve`
  - `POST /cash-movements/:id/reject`
  - `POST /cash-movements/:id/deliver`
- Transition validator with `409 CASHFLOW_INVALID_TRANSITION` and structured `details` payload.
- New `cashflow` module with `GET /cashflow/stats` and decimal-string cards output.
- `BranchAccessService` for centralized branch scoping logic.
- Demo Postman collection: `postman/opsflow-demo.postman_collection.json`.
- Demo business seed for org `Demo Pacific Treasury`, branches `HQ`/`Sucursal Norte`, and deterministic cash movement dataset.

### Changed

- Prisma `CashMovement` model migrated to workflow schema:
  - enums `CashMovementType` (`IN|OUT`) and `CashMovementStatus` (`PENDING|APPROVED|REJECTED|DELIVERED`)
  - new fields `currency`, `description`, `approvedById`, `deliveredById`, `updatedAt`
  - renamed creator field to `createdById`
  - optimized indexes for status/branch/date filters.
- `GET /cash-movements` now returns paginated payload `{ data, meta }`.
- `POST /cash-movements` now expects `amount` as decimal string and always starts in `PENDING`.
- Swagger documentation upgraded with explicit `CashMovements` and `Cashflow` tags, examples, and refresh cookie security scheme.
- Demo seed upgraded for higher-volume scenarios: configurable branch count, operators per branch, and movements per branch while keeping deterministic/idempotent behavior.

### Tests

- Added unit tests for:
  - `BranchAccessService`
  - cash movement transition validator
  - `CashflowService` / `CashflowController`
  - permissions guard missing-permission path.
- Added e2e tests for:
  - cross-tenant movement scope (`404 RESOURCE_NOT_FOUND`)
  - operator create branch inference + pending status
  - invalid transitions (`409`)
  - operator forbidden transitions (`403`)
  - cashflow decimal-string stats response.

## [1.1.0] - 2026-02-19

### Added

- Multi-tenant core entities in Prisma: `Organization`, `Branch`, `CashMovement`.
- Business modules:
  - `branches` (tenant-scoped branch management)
  - `cash-movements` (tenant/branch scoped movement create/list)
  - `stats` (`GET /stats/cash-summary` aggregated cash totals)
- New permissions:
  - `BRANCH_READ`, `BRANCH_CREATE`, `BRANCH_UPDATE`
  - `USER_READ`, `USER_CREATE`, `USER_UPDATE`
  - `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASH_MOVEMENT_APPROVE`, `CASH_MOVEMENT_REJECT`, `CASH_MOVEMENT_DELIVER`
  - `CASHFLOW_STATS_READ`
- Runtime authenticated user context enrichment in `JwtStrategy`:
  - `id`, `organizationId`, `role`, `branchId`, `roles`, `permissions` (plus canonical `sub`).

### Changed

- Auth registration now defaults to tenant-aware user creation (`organizationId`) with `OPERATOR` role.
- `/auth/me` response now includes tenant/role context while preserving existing fields.
- Users module is now tenant-scoped (`organizationId`) with stricter scope enforcement.
- Seed process now provisions default org/branch and canonical roles (`ADMIN`, `MANAGER`, `OPERATOR`) while keeping legacy `USER` compatibility mapping.
- Added stable error codes for branch and date-range scope errors.
- Business services now enforce organization scoping through dedicated organization-scoped repositories (`findById/list/create` with explicit `organizationId`).
- Anti data-leak policy hardened: cross-tenant resource ids return `404 RESOURCE_NOT_FOUND` instead of `403`.

### Tests

- Added unit tests for `branches`, `cash-movements`, and `stats` services/controllers.
- Updated auth/users tests and e2e mocks for enriched JWT request context and tenant-aware behavior.

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
