# Postman Auth Tests

Checklist rapido para validar auth, refresh y logout desde Postman.

## 1. Preparacion

Variables de coleccion recomendadas:

- `baseUrl` (ejemplo: `http://localhost:3000`)
- `email`
- `password`
- `accessToken`
- `csrfToken`

Notas:

- Usar Postman Cookie Jar habilitado.
- En requests con cookie auth (`refresh`, `logout`) no borrar cookies entre pasos.

## 2. Flujo base (happy path)

1. `GET {{baseUrl}}/auth/csrf`
   - Esperado: `200`
   - Esperado: cookie `csrf_token` seteada
   - Copiar valor de cookie a variable `csrfToken`

2. `POST {{baseUrl}}/auth/register`
   - Body JSON:
   ```json
   {
     "email": "{{email}}",
     "password": "{{password}}"
   }
   ```
   - Esperado: `201`
   - Esperado: body con `accessToken`
   - Esperado: cookie `refresh_token` seteada

3. `POST {{baseUrl}}/auth/login`
   - Body JSON:
   ```json
   {
     "email": "{{email}}",
     "password": "{{password}}"
   }
   ```
   - Esperado: `200`
   - Esperado: body con `accessToken`
   - Guardar `accessToken` en variable
   - Esperado: cookie `refresh_token` actualizada

4. `GET {{baseUrl}}/auth/me`
   - Header: `Authorization: Bearer {{accessToken}}`
   - Esperado: `200`
   - Esperado: payload de sesion (user, roles, permissions)

5. `POST {{baseUrl}}/auth/refresh`
   - Header: `x-csrf-token: {{csrfToken}}`
   - Sin body
   - Esperado: `200`
   - Esperado: body con nuevo `accessToken`
   - Esperado: cookie `refresh_token` rotada

6. `POST {{baseUrl}}/auth/logout`
   - Header: `x-csrf-token: {{csrfToken}}`
   - Sin body
   - Esperado: `204` (sin body)
   - Esperado: cookie `refresh_token` limpiada

7. `POST {{baseUrl}}/auth/refresh` (despues de logout)
   - Header: `x-csrf-token: {{csrfToken}}`
   - Esperado: `401`

## 3. Casos negativos clave

1. `POST /auth/refresh` sin `x-csrf-token`
   - Esperado: `403`
   - `code`: `AUTH_CSRF_TOKEN_MISSING`

2. `POST /auth/logout` sin `x-csrf-token`
   - Esperado: `403`
   - `code`: `AUTH_CSRF_TOKEN_MISSING`

3. `POST /auth/login` con password invalida repetidas veces
   - Esperado: `401` al inicio
   - Luego `429` por lockout
   - `code`: `AUTH_LOGIN_LOCKED`

## 4. Validacion especifica de logout (problema tipico)

Si logout "parece no funcionar":

1. Confirmar que el request incluye `x-csrf-token` y cookie `csrf_token`.
2. Confirmar que llega cookie `refresh_token` antes de logout.
3. Confirmar status exacto: debe ser `204`.
4. Reintentar `POST /auth/refresh`: debe devolver `401`.
5. Si `refresh` sigue dando `200`, revisar dominio/path/samesite/secure de cookies en entorno real.
