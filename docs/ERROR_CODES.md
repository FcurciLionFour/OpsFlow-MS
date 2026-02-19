# Error Codes

Contrato de errores estable para frontend/monitoring.

## Formato de respuesta de error

- `code`: codigo estable del error
- `errorCode`: alias de `code`
- `error_code`: alias snake_case de `code`
- `message`: mensaje legible
- `statusCode`: status HTTP
- `retryAfterSeconds` (opcional): para throttling/lockout

## Catalogo actual

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_REFRESH_REUSE_DETECTED`
- `AUTH_INVALID_OR_EXPIRED_RESET_TOKEN`
- `AUTH_INVALID_CURRENT_PASSWORD`
- `AUTH_USER_INACTIVE`
- `AUTH_CSRF_TOKEN_MISSING`
- `AUTH_CSRF_TOKEN_INVALID`
- `AUTH_LOGIN_LOCKED`
- `AUTH_USER_HAS_NO_ROLES`
- `AUTH_MISSING_REQUIRED_ROLE`
- `AUTH_MISSING_REQUIRED_PERMISSION`
- `USER_NOT_FOUND`
- `USER_ALREADY_EXISTS`
- `USER_ROLE_REQUIRED`
- `USER_INVALID_ROLE`
- `ACCESS_DENIED`
- `RATE_LIMIT_EXCEEDED`
- `DB_UNAVAILABLE`
