# RBAC and Scope

**Date:** 2026-02-19

This boilerplate separates:

- **RBAC (roles/permissions)** = capability control.
- **Scope (tenant/ownership)** = resource-level access.

## 1. Roles and runtime context

Canonical runtime roles:

- `ADMIN`
- `MANAGER`
- `OPERATOR`

Legacy `USER` is still accepted in DB but mapped to `OPERATOR` in runtime context.

Per authenticated request, backend exposes:

- `request.user.sub`
- `request.user.id`
- `request.user.organizationId`
- `request.user.role`
- `request.user.branchId` (nullable)
- `request.user.roles`
- `request.user.permissions`

## 2. Capability vs scope

- RBAC answers: what can the user do?
- Scope answers: over which records can the user act?

Rules:

- Capabilities are enforced with `PermissionsGuard` + permission decorators.
- Scope is enforced in services (`organizationId` and `branchId` checks).

## 3. Tenant-first policy

All business reads/writes must include tenant boundary:

- never query or mutate outside `request.user.organizationId`.
- avoid leaking existence of records from other tenants.
- cross-tenant resource ids must return `404` with code `RESOURCE_NOT_FOUND` (never `403`).

## 4. Branch-aware policy

Default behavior used in cash/stats:

- `OPERATOR`: only own `branchId`.
- `MANAGER` with `branchId` assigned: only that branch.
- `MANAGER` without assigned branch: org-wide.
- `ADMIN`: org-wide (optional branch filters allowed).

En implementacion, este scope se centraliza en `BranchAccessService` para:

- inferir branch en `POST /cash-movements` cuando corresponde;
- validar filtros de branch en `GET /cash-movements` y `GET /cashflow/stats`;
- bloquear accesos fuera de scope con `403 ACCESS_DENIED`;
- mantener anti-leak cross-tenant con `404 RESOURCE_NOT_FOUND`.

## 5. Permission examples

- `USER_READ`, `USER_CREATE`, `USER_UPDATE`
- `BRANCH_READ`, `BRANCH_CREATE`, `BRANCH_UPDATE`
- `CASH_MOVEMENT_READ`, `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_APPROVE`, `CASH_MOVEMENT_REJECT`, `CASH_MOVEMENT_DELIVER`
- `CASHFLOW_STATS_READ`

Workflow de estados de caja:

- `PENDING -> APPROVED | REJECTED`
- `APPROVED -> DELIVERED`
- transicion invalida -> `409 CASHFLOW_INVALID_TRANSITION`

## 6. Controller/Service split

Controller:

- thin, validates DTOs, delegates.
- can require permissions.

Service:

- single source of truth for tenant/branch/ownership checks.
- no duplicated access logic in controllers.

## 7. Seed defaults

Recommended matrix:

- `ADMIN`: all permissions above.
- `MANAGER`: `BRANCH_READ`, `USER_READ`, `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASH_MOVEMENT_APPROVE`, `CASH_MOVEMENT_REJECT`, `CASH_MOVEMENT_DELIVER`, `CASHFLOW_STATS_READ`.
- `OPERATOR`: `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASHFLOW_STATS_READ`.
