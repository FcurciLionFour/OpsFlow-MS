# Frontend-Backend Alignment Guide

Documento de contrato para alinear integracion frontend con este backend.

## 1. Convenciones globales

Base URL:

- `http://localhost:3000` (local default)

Formato global de errores:

```json
{
  "statusCode": 403,
  "code": "AUTH_CSRF_TOKEN_MISSING",
  "errorCode": "AUTH_CSRF_TOKEN_MISSING",
  "error_code": "AUTH_CSRF_TOKEN_MISSING",
  "message": "CSRF token missing",
  "path": "/auth/refresh",
  "timestamp": "2026-02-18T10:00:00.000Z",
  "requestId": "..."
}
```

Campos opcionales de error:

- `errors`: lista de errores de validacion (400)
- `retryAfterSeconds`: para throttling/lockout (429)

Headers de rate limit (cuando aplica):

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (cuando hay 429)

## 2. Modelo de autenticacion

- Access token en header `Authorization: Bearer <token>`.
- Refresh token en cookie HttpOnly `refresh_token`.
- CSRF double submit:
  - Cookie `csrf_token` (no HttpOnly).
  - Header `x-csrf-token` con el mismo valor de cookie.
- Frontend web debe usar `credentials: 'include'` en requests con cookies.

## 3. Endpoints de Auth

## `GET /auth/csrf`

Uso:

- Publico.
- Sin body.

Exito:

- `200`
- Body:
```json
{ "ok": true }
```
- Side effect: setea cookie `csrf_token`.

Errores:

- No esperados en flujo normal.

## `POST /auth/register`

Uso:

- Publico.
- Body:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

Exito:

- `201`
- Body:
```json
{
  "accessToken": "..."
}
```
- Side effect: setea cookie `refresh_token`.

Errores:

- `400` validacion DTO.
- `403` `USER_ALREADY_EXISTS`.

## `POST /auth/login`

Uso:

- Publico.
- Body:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

Exito:

- `200`
- Body:
```json
{
  "accessToken": "..."
}
```
- Side effect: actualiza cookie `refresh_token`.

Errores:

- `400` validacion DTO.
- `401` `AUTH_INVALID_CREDENTIALS`.
- `429` `AUTH_LOGIN_LOCKED` (lockout progresivo).
- `429` `RATE_LIMIT_EXCEEDED` (rate-limit del endpoint).

## `GET /auth/me`

Uso:

- Requiere Bearer token.
- Header: `Authorization: Bearer <accessToken>`.

Exito:

- `200`
- Body:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "roles": ["USER"],
  "permissions": []
}
```

Errores:

- `401` `UNAUTHORIZED`.
- `401` `AUTH_USER_INACTIVE`.

## `POST /auth/refresh`

Uso:

- Publico (sin Bearer), pero requiere cookies + CSRF header.
- Header: `x-csrf-token: <csrf_token>`
- Cookie requerida: `refresh_token`

Exito:

- `200`
- Body:
```json
{
  "accessToken": "..."
}
```
- Side effect: rota cookie `refresh_token`.

Errores:

- `401` `UNAUTHORIZED` (token invalido, sesion revocada/expirada, usuario inactivo).
- `403` `AUTH_CSRF_TOKEN_MISSING`.
- `403` `AUTH_CSRF_TOKEN_INVALID`.
- `403` `AUTH_REFRESH_REUSE_DETECTED`.
- `429` `RATE_LIMIT_EXCEEDED`.

## `POST /auth/logout`

Uso:

- Publico (sin Bearer), requiere CSRF.
- Header: `x-csrf-token: <csrf_token>`
- Cookie `refresh_token` recomendada (si no existe, logout sigue siendo idempotente).

Exito:

- `204` (sin body)
- Side effect: limpia cookie `refresh_token`.

Errores:

- `403` `AUTH_CSRF_TOKEN_MISSING`.
- `403` `AUTH_CSRF_TOKEN_INVALID`.
- `429` `RATE_LIMIT_EXCEEDED`.

## `POST /auth/forgot-password`

Uso:

- Publico.
- Body:
```json
{
  "email": "user@example.com"
}
```

Exito:

- `200`
- Body (siempre neutro):
```json
{
  "message": "If the email exists, a reset link has been sent"
}
```

Errores:

- `400` validacion DTO.
- `429` `RATE_LIMIT_EXCEEDED`.

## `POST /auth/reset-password`

Uso:

- Publico.
- Body:
```json
{
  "token": "uuid",
  "newPassword": "NewPassword123"
}
```

Exito:

- `200`
- Body:
```json
{
  "message": "Password updated successfully"
}
```

Errores:

- `400` validacion DTO.
- `403` `AUTH_INVALID_OR_EXPIRED_RESET_TOKEN`.
- `429` `RATE_LIMIT_EXCEEDED`.

## `POST /auth/change-password`

Uso:

- Requiere Bearer token.
- Header: `Authorization: Bearer <accessToken>`.
- Body:
```json
{
  "currentPassword": "Current123",
  "newPassword": "NewPassword123"
}
```

Exito:

- `200`
- Body:
```json
{
  "message": "Password updated successfully"
}
```

Errores:

- `400` validacion DTO.
- `401` `UNAUTHORIZED` (sin token/invalido).
- `403` `AUTH_INVALID_CURRENT_PASSWORD`.
- `403` `ACCESS_DENIED`.
- `429` `RATE_LIMIT_EXCEEDED`.

## 4. Endpoints de Users

## `GET /users`

Uso:

- Requiere Bearer token.
- Requiere RBAC: `Role ADMIN` + permiso `users.read`.

Exito:

- `200`
- Body:
```json
[
  {
    "id": "uuid",
    "email": "admin@example.com",
    "roles": ["ADMIN"]
  }
]
```

Errores:

- `401` `UNAUTHORIZED`.
- `401` `AUTH_USER_INACTIVE`.
- `403` `AUTH_USER_HAS_NO_ROLES`.
- `403` `AUTH_MISSING_REQUIRED_ROLE`.
- `403` `AUTH_MISSING_REQUIRED_PERMISSION`.

## `GET /users/me`

Uso:

- Requiere Bearer token.

Exito:

- `200`
- Body:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "roles": ["USER"]
}
```

Errores:

- `401` `UNAUTHORIZED`.
- `404` `USER_NOT_FOUND`.

## `GET /users/:id`

Uso:

- Requiere Bearer token.
- Scope:
  - self permitido,
  - admin permitido,
  - otro usuario no admin: denegado.

Exito:

- `200`
- Body:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "roles": ["USER"]
}
```

Errores:

- `401` `UNAUTHORIZED`.
- `403` `ACCESS_DENIED`.
- `404` `USER_NOT_FOUND`.

## `POST /users`

Uso:

- Requiere Bearer token.
- Requiere permiso `users.write`.
- Body:
```json
{
  "email": "new@example.com",
  "password": "Password123",
  "roles": ["USER"]
}
```

Exito:

- `201`
- Body:
```json
{
  "id": "uuid",
  "email": "new@example.com",
  "roles": ["USER"]
}
```

Errores:

- `400` validacion DTO.
- `401` `UNAUTHORIZED`.
- `403` `AUTH_MISSING_REQUIRED_PERMISSION`.
- `403` `USER_ALREADY_EXISTS`.
- `403` `USER_ROLE_REQUIRED`.
- `403` `USER_INVALID_ROLE`.

## `PATCH /users/:id`

Uso:

- Requiere Bearer token.
- Requiere permiso `users.write`.
- Body (todos opcionales):
```json
{
  "email": "updated@example.com",
  "isActive": true,
  "roles": ["ADMIN"]
}
```

Exito:

- `200`
- Body:
```json
{
  "id": "uuid",
  "email": "updated@example.com",
  "isActive": true,
  "roles": ["ADMIN"]
}
```

Errores:

- `400` validacion DTO.
- `401` `UNAUTHORIZED`.
- `403` `AUTH_MISSING_REQUIRED_PERMISSION`.
- `403` `ACCESS_DENIED`.
- `403` `USER_ALREADY_EXISTS`.
- `403` `USER_ROLE_REQUIRED`.
- `403` `USER_INVALID_ROLE`.
- `404` `USER_NOT_FOUND`.

## `DELETE /users/:id`

Uso:

- Requiere Bearer token.
- Requiere permiso `users.write`.
- Hace soft delete (`isActive=false`).

Exito:

- `200`
- Body:
```json
{
  "success": true
}
```

Errores:

- `401` `UNAUTHORIZED`.
- `403` `AUTH_MISSING_REQUIRED_PERMISSION`.
- `403` `ACCESS_DENIED`.
- `404` `USER_NOT_FOUND`.

## 5. Endpoints operativos

## `GET /health`

Uso:

- Publico.

Exito:

- `200`
- Body:
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

## `GET /ready`

Uso:

- Publico.

Exito:

- `200`
- Body:
```json
{
  "status": "ready",
  "checks": {
    "database": "up"
  },
  "timestamp": "..."
}
```

Errores:

- `503` `DB_UNAVAILABLE`.

## `GET /metrics`

Uso:

- Publico.
- Respuesta en formato Prometheus (`text/plain`).

Exito:

- `200`
- Body de texto con metricas.

## 6. Endpoint base del boilerplate

## `GET /`

Uso:

- Requiere Bearer token por guard global.

Exito:

- `200`
- Body:
```json
"Hello World!"
```

Nota:

- Este endpoint es de ejemplo y se puede eliminar en proyectos cliente.

## 7. Recomendaciones para frontend

1. Centralizar manejo de `401` para refresh automatico controlado.
2. Si `refresh` falla, limpiar estado local y redirigir a login.
3. Tratar `403` por codigo de error (`code`) para mensajes precisos.
4. Con cookies cross-domain, validar `sameSite`/`secure`/`credentials`.
5. En logout, esperar `204` sin body como resultado correcto.
