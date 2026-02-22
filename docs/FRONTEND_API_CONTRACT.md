# Frontend API Contract

Last updated: 2026-02-19
Source of truth: backend code in `src/**` (controllers, services, DTOs, guards, global filter).

## 1) Global Contract

### 1.1 Base URL and content type

- Base URL: `http(s)://<host>:<port>`
- API prefix: none
- JSON endpoints use:
  - Request header: `Content-Type: application/json`
  - Response header: `Content-Type: application/json`

Exception:
- `GET /metrics` returns Prometheus text (`text/plain`).

### 1.2 Authentication

- Protected endpoints require:
  - `Authorization: Bearer <accessToken>`
- Session refresh/logout uses:
  - HttpOnly cookie: `refresh_token`
- CSRF flow for cookie-based mutating auth endpoints:
  1. Call `GET /auth/csrf` to receive cookie `csrf_token`
  2. Send header `x-csrf-token: <csrf_token>` + cookie in:
     - `POST /auth/refresh`
     - `POST /auth/logout`

### 1.3 Multi-tenant and scope

- Every business query is scoped by `user.organizationId`.
- Cross-tenant resource access returns:
  - `404` with `code: RESOURCE_NOT_FOUND`
- Branch scope:
  - `OPERATOR`: only own `branchId`
  - `MANAGER` with `branchId`: only that branch
  - `MANAGER` without `branchId`: org-wide
  - `ADMIN`: org-wide

### 1.4 Request id

- Backend sets `x-request-id` on every response.
- If frontend sends `x-request-id`, backend reuses it.

### 1.5 Error envelope (all errors)

```json
{
  "statusCode": 403,
  "code": "ACCESS_DENIED",
  "errorCode": "ACCESS_DENIED",
  "error_code": "ACCESS_DENIED",
  "message": "Access denied",
  "path": "/cashflow/stats",
  "timestamp": "2026-02-19T20:30:00.000Z",
  "requestId": "9e399153-2df5-4f70-9d00-4f7875b746f5",
  "traceId": "9e399153-2df5-4f70-9d00-4f7875b746f5",
  "details": {},
  "errors": ["field must be an email"],
  "retryAfterSeconds": 60
}
```

Notes:
- `details`, `errors`, `retryAfterSeconds` are optional.
- Validation errors are `400` and usually include `errors[]`.
- Rate-limit errors are `429` and include `retryAfterSeconds`.

### 1.6 Runtime roles and permissions

Canonical roles:
- `ADMIN`
- `MANAGER`
- `OPERATOR`

Legacy runtime mapping:
- `USER` is treated as `OPERATOR`.

Canonical permissions:
- `BRANCH_READ`, `BRANCH_CREATE`, `BRANCH_UPDATE`
- `USER_READ`, `USER_CREATE`, `USER_UPDATE`
- `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASH_MOVEMENT_APPROVE`, `CASH_MOVEMENT_REJECT`, `CASH_MOVEMENT_DELIVER`
- `CASHFLOW_STATS_READ`

Role mapping:
- `ADMIN`: all permissions
- `MANAGER`: `BRANCH_READ`, `USER_READ`, all cash movement actions, `CASHFLOW_STATS_READ`
- `OPERATOR`: `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASHFLOW_STATS_READ`

## 2) Response Models

### 2.1 Branch

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "name": "HQ",
  "code": "HQ",
  "isActive": true
}
```

### 2.2 User

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "branchId": "uuid or null",
  "role": "ADMIN|MANAGER|OPERATOR",
  "email": "user@company.com",
  "roles": ["ADMIN"]
}
```

### 2.3 CashMovement

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "branchId": "uuid",
  "createdById": "uuid",
  "approvedById": "uuid or null",
  "deliveredById": "uuid or null",
  "type": "IN|OUT",
  "status": "PENDING|APPROVED|REJECTED|DELIVERED",
  "amount": "1500.50",
  "currency": "ARS",
  "description": "optional text or null",
  "createdAt": "2026-02-19T20:30:00.000Z",
  "updatedAt": "2026-02-19T20:30:00.000Z"
}
```

Rules:
- `amount` is always string in API responses.
- Datetimes are ISO-8601 UTC strings.

### 2.4 CashflowStats

```json
{
  "range": {
    "from": "2026-02-01T00:00:00.000Z",
    "to": "2026-02-19T23:59:59.999Z"
  },
  "branchId": "uuid or null",
  "cards": {
    "totalIn": "12345.00",
    "totalOut": "6789.00",
    "net": "5556.00",
    "pendingCount": 3,
    "approvedCount": 2,
    "deliveredCount": 5,
    "rejectedCount": 1
  }
}
```

## 3) Services and Endpoints

## 3.1 Health Service

### `GET /health`

- Auth: Public
- Success `200`:

```json
{
  "status": "ok",
  "timestamp": "2026-02-19T20:30:00.000Z"
}
```

### `GET /ready`

- Auth: Public
- Success `200`:

```json
{
  "status": "ready",
  "checks": { "database": "up" },
  "timestamp": "2026-02-19T20:30:00.000Z"
}
```

- Errors:
  - `503 DB_UNAVAILABLE`

### `GET /metrics`

- Auth: Public
- Success `200`: Prometheus text.

## 3.2 Root Service

### `GET /`

- Auth: Bearer required
- Success `200`:

```json
"Hello World!"
```

- Errors:
  - `401 UNAUTHORIZED`

## 3.3 Auth Service

### `POST /auth/register`

- Auth: Public
- Body:

```json
{
  "email": "new@company.com",
  "password": "min6chars"
}
```

- Success `201`:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

- Errors:
  - `400 BAD_REQUEST` (validation)
  - `403 USER_ALREADY_EXISTS`

### `POST /auth/login`

- Auth: Public
- Body:

```json
{
  "email": "admin@company.com",
  "password": "secret"
}
```

- Success `200`:

```json
{
  "accessToken": "<jwt>"
}
```

- Side effect: sets cookie `refresh_token` (HttpOnly).
- Errors:
  - `400 BAD_REQUEST`
  - `401 AUTH_INVALID_CREDENTIALS` or `UNAUTHORIZED`
  - `429 AUTH_LOGIN_LOCKED` or `RATE_LIMIT_EXCEEDED`

### `GET /auth/me`

- Auth: Bearer required
- Success `200`:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@company.com",
    "organizationId": "uuid",
    "branchId": "uuid or null",
    "role": "ADMIN|MANAGER|OPERATOR"
  },
  "role": "ADMIN|MANAGER|OPERATOR",
  "roles": ["ADMIN"],
  "permissions": ["BRANCH_READ", "CASH_MOVEMENT_READ"]
}
```

- Errors:
  - `401 UNAUTHORIZED`
  - `401 AUTH_USER_INACTIVE`

### `GET /auth/csrf`

- Auth: Public
- Success `200`:

```json
{
  "ok": true
}
```

- Side effect: sets cookie `csrf_token` (not HttpOnly).

### `POST /auth/refresh`

- Auth: Public endpoint with CSRF + cookie requirements
- Required:
  - cookie `refresh_token`
  - cookie `csrf_token`
  - header `x-csrf-token` equal to cookie value
- Success `200`:

```json
{
  "accessToken": "<jwt>"
}
```

- Side effect: rotates cookie `refresh_token`.
- Errors:
  - `401 UNAUTHORIZED`
  - `403 AUTH_CSRF_TOKEN_MISSING`
  - `403 AUTH_CSRF_TOKEN_INVALID`
  - `403 AUTH_REFRESH_REUSE_DETECTED`
  - `429 RATE_LIMIT_EXCEEDED`

### `POST /auth/logout`

- Auth: Public endpoint with CSRF + cookie requirements
- Required:
  - cookie `csrf_token`
  - header `x-csrf-token`
- Success: `204` (no body)
- Side effect: clears `refresh_token`.
- Errors:
  - `403 AUTH_CSRF_TOKEN_MISSING`
  - `403 AUTH_CSRF_TOKEN_INVALID`
  - `429 RATE_LIMIT_EXCEEDED`

### `POST /auth/forgot-password`

- Auth: Public
- Body:

```json
{
  "email": "user@company.com"
}
```

- Success `200`:

```json
{
  "message": "If the email exists, a reset link has been sent"
}
```

- Errors:
  - `400 BAD_REQUEST`
  - `429 RATE_LIMIT_EXCEEDED`

### `POST /auth/reset-password`

- Auth: Public
- Body:

```json
{
  "token": "uuid",
  "newPassword": "min8chars"
}
```

- Success `200`:

```json
{
  "message": "Password updated successfully"
}
```

- Errors:
  - `400 BAD_REQUEST`
  - `403 AUTH_INVALID_OR_EXPIRED_RESET_TOKEN`
  - `429 RATE_LIMIT_EXCEEDED`

### `POST /auth/change-password`

- Auth: Bearer required
- Body:

```json
{
  "currentPassword": "min8chars",
  "newPassword": "min8chars"
}
```

- Success `200`:

```json
{
  "message": "Password updated successfully"
}
```

- Errors:
  - `400 BAD_REQUEST`
  - `401 UNAUTHORIZED`
  - `403 AUTH_INVALID_CURRENT_PASSWORD`
  - `403 ACCESS_DENIED`
  - `429 RATE_LIMIT_EXCEEDED`

## 3.4 Branches Service

### `GET /branches`

- Auth: Bearer required
- Permission: `BRANCH_READ`
- Query params:
  - `includeInactive?: boolean` (default false)
- Success `200`: `Branch[]`
- Errors:
  - `401 UNAUTHORIZED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `403 AUTH_USER_HAS_NO_ROLES`

### `GET /branches/:id`

- Auth: Bearer required
- Permission: `BRANCH_READ`
- Success `200`: `Branch`
- Errors:
  - `401 UNAUTHORIZED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 BRANCH_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

### `POST /branches`

- Auth: Bearer required
- Permission: `BRANCH_CREATE`
- Role: `ADMIN`
- Body:

```json
{
  "name": "Main Branch",
  "code": "MAIN",
  "isActive": true
}
```

- Success `201`: `Branch`
- Errors:
  - `400 BAD_REQUEST`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `403 AUTH_MISSING_REQUIRED_ROLE`
  - `403 BRANCH_CODE_ALREADY_EXISTS`

### `PATCH /branches/:id`

- Auth: Bearer required
- Permission: `BRANCH_UPDATE`
- Body:

```json
{
  "name": "Secondary Branch",
  "isActive": true
}
```

- Success `200`: `Branch`
- Errors:
  - `400 BAD_REQUEST`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 BRANCH_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

## 3.5 Users Service

### `GET /users`

- Auth: Bearer required
- Permission: `USER_READ`
- Success `200`: `User[]`
- Errors:
  - `401 UNAUTHORIZED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `403 AUTH_USER_HAS_NO_ROLES`

### `GET /users/me`

- Auth: Bearer required
- Success `200`: `User`
- Errors:
  - `401 UNAUTHORIZED`
  - `404 USER_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

### `GET /users/:id`

- Auth: Bearer required
- Access rule:
  - `ADMIN` can access any user in org
  - non-admin can access only self
- Success `200`: `User`
- Errors:
  - `401 UNAUTHORIZED`
  - `403 ACCESS_DENIED`
  - `404 USER_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

### `POST /users`

- Auth: Bearer required
- Permission: `USER_CREATE`
- Service rule: only runtime `ADMIN` can create (extra service check)
- Body:

```json
{
  "email": "new.user@company.com",
  "password": "min8chars",
  "roles": ["OPERATOR"],
  "branchId": "uuid"
}
```

- Success `201`: `User`
- Errors:
  - `400 BAD_REQUEST`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `403 ACCESS_DENIED`
  - `403 USER_ALREADY_EXISTS`
  - `403 USER_ROLE_REQUIRED`
  - `403 USER_INVALID_ROLE`
  - `404 BRANCH_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

### `PATCH /users/:id`

- Auth: Bearer required
- Permission: `USER_UPDATE`
- Access rule:
  - `ADMIN` any user in org
  - non-admin only self
- Body:

```json
{
  "email": "updated@company.com",
  "isActive": true,
  "roles": ["MANAGER"],
  "branchId": null
}
```

- Success `200`: `User`
- Errors:
  - `400 BAD_REQUEST`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `403 ACCESS_DENIED`
  - `403 USER_ALREADY_EXISTS`
  - `403 USER_ROLE_REQUIRED`
  - `403 USER_INVALID_ROLE`
  - `404 USER_NOT_FOUND`
  - `404 BRANCH_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

### `DELETE /users/:id`

- Auth: Bearer required
- Permission: `USER_UPDATE`
- Behavior: soft delete (`isActive=false`)
- Success `200`:

```json
{
  "success": true
}
```

- Errors:
  - `401 UNAUTHORIZED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `403 ACCESS_DENIED`
  - `404 USER_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

## 3.6 Cash Movements Service

Enums:
- `type`: `IN | OUT`
- `status`: `PENDING | APPROVED | REJECTED | DELIVERED`

Transition rules:
- `PENDING -> APPROVED | REJECTED`
- `APPROVED -> DELIVERED`
- Invalid transition returns `409 CASHFLOW_INVALID_TRANSITION`.

### `POST /cash-movements`

- Auth: Bearer required
- Permission: `CASH_MOVEMENT_CREATE`
- Body:

```json
{
  "amount": "1500.50",
  "type": "OUT",
  "currency": "ARS",
  "description": "Petty cash payment",
  "branchId": "uuid-optional"
}
```

Scope behavior:
- `OPERATOR`: `branchId` is forced to `user.branchId` (body value is ignored)
- `MANAGER` with fixed branch: forced to own branch
- `MANAGER`/`ADMIN` org-wide: may send `branchId` (required if no fixed branch scope)
- `organizationId` always from token
- `status` always starts as `PENDING`

- Success `201`: `CashMovement`
- Errors:
  - `400 BAD_REQUEST` (validation)
  - `400 CASH_MOVEMENTS_INVALID_AMOUNT`
  - `400 BRANCH_SCOPE_REQUIRED`
  - `403 ACCESS_DENIED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 BRANCH_NOT_FOUND`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

### `GET /cash-movements`

- Auth: Bearer required
- Permission: `CASH_MOVEMENT_READ`
- Query params:
  - `page?: number` (default 1, min 1)
  - `pageSize?: number` (default 20, min 1, max 100)
  - `status?: PENDING|APPROVED|REJECTED|DELIVERED`
  - `branchId?: string`
  - `from?: ISO-8601`
  - `to?: ISO-8601`
- Success `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "branchId": "uuid",
      "createdById": "uuid",
      "approvedById": null,
      "deliveredById": null,
      "type": "IN",
      "status": "PENDING",
      "amount": "100.00",
      "currency": "ARS",
      "description": null,
      "createdAt": "2026-02-19T20:30:00.000Z",
      "updatedAt": "2026-02-19T20:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

- Errors:
  - `400 BAD_REQUEST` (validation)
  - `400 CASH_MOVEMENTS_INVALID_DATE_RANGE`
  - `403 ACCESS_DENIED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant resources)

### `POST /cash-movements/:id/approve`

- Auth: Bearer required
- Permission: `CASH_MOVEMENT_APPROVE`
- Success `201`: updated `CashMovement` with `status=APPROVED`, `approvedById=<actor>`
- Errors:
  - `401 UNAUTHORIZED`
  - `403 ACCESS_DENIED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 RESOURCE_NOT_FOUND`
  - `409 CASHFLOW_INVALID_TRANSITION` with:

```json
{
  "details": {
    "from": "PENDING",
    "to": "DELIVERED"
  }
}
```

### `POST /cash-movements/:id/reject`

- Auth: Bearer required
- Permission: `CASH_MOVEMENT_REJECT`
- Success `201`: updated `CashMovement` with `status=REJECTED` (`approvedById` may be null)
- Errors:
  - `401 UNAUTHORIZED`
  - `403 ACCESS_DENIED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 RESOURCE_NOT_FOUND`
  - `409 CASHFLOW_INVALID_TRANSITION`

### `POST /cash-movements/:id/deliver`

- Auth: Bearer required
- Permission: `CASH_MOVEMENT_DELIVER`
- Success `201`: updated `CashMovement` with `status=DELIVERED`, `deliveredById=<actor>`
- Errors:
  - `401 UNAUTHORIZED`
  - `403 ACCESS_DENIED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 RESOURCE_NOT_FOUND`
  - `409 CASHFLOW_INVALID_TRANSITION`

## 3.7 Cashflow Service

### `GET /cashflow/stats`

- Auth: Bearer required
- Permission: `CASHFLOW_STATS_READ`
- Query params:
  - `branchId?: string`
  - `from?: ISO-8601`
  - `to?: ISO-8601`
- Success `200`: `CashflowStats`
- Date behavior:
  - If `from` and `to` are missing, backend uses last 30 days.
- Scope behavior:
  - `OPERATOR`: forced to own branch
  - `MANAGER` with branch: forced to own branch
  - `MANAGER`/`ADMIN` org-wide: optional branch filter if accessible
- Errors:
  - `400 BAD_REQUEST` (validation)
  - `400 STATS_INVALID_DATE_RANGE`
  - `401 UNAUTHORIZED`
  - `403 ACCESS_DENIED`
  - `403 AUTH_MISSING_REQUIRED_PERMISSION`
  - `404 RESOURCE_NOT_FOUND` (cross-tenant)

## 4) Frontend Implementation Notes

- Always use `amount` as string in request/response payloads.
- Always send ISO dates in UTC (`.toISOString()`).
- Keep both `requestId` and `traceId` in error logs for support.
- For `429`, apply retry strategy using `retryAfterSeconds`.
- For auth cookie flows in browser:
  - requests must include credentials (`withCredentials: true` in axios or `credentials: 'include'` in fetch).
