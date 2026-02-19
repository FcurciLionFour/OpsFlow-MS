# Release Checklist (SaaS)

Checklist operativo para validar una salida a produccion de este backend.

## 1. Variables de entorno obligatorias y seguras

- [ ] `NODE_ENV=production`.
- [ ] `DATABASE_URL` apunta a la base productiva correcta (sin credenciales hardcodeadas en repositorio).
- [ ] `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` tienen al menos 32 caracteres y son distintos entre si.
- [ ] `JWT_ACCESS_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN` estan definidos segun politica de seguridad.
- [ ] `COOKIE_SAME_SITE` y `COOKIE_SECURE` estan alineados al deployment real:
  - [ ] Mismo dominio: `sameSite=lax|strict` y `secure=true` en HTTPS.
  - [ ] Cross-domain: `sameSite=none` y `secure=true` (obligatorio en navegadores modernos).
- [ ] `COOKIE_CSRF_MAX_AGE_MS` y `COOKIE_REFRESH_MAX_AGE_MS` tienen valores razonables (no excesivos).
- [ ] `CORS_ORIGINS` incluye solo origins permitidos (sin wildcard en produccion).

## 2. Cookies cross-domain y CSRF

- [ ] Validar en navegador real (no solo Postman) que las cookies se setean con flags correctos.
- [ ] Confirmar envio de cookies con `credentials: include` desde frontend.
- [ ] Verificar flujo CSRF double-submit:
  - [ ] `GET /auth/csrf` entrega cookie CSRF.
  - [ ] `POST /auth/refresh` sin header `x-csrf-token` responde `403`.
  - [ ] `POST /auth/refresh` con header valido responde `200`.
  - [ ] `POST /auth/logout` sin CSRF responde `403`.
  - [ ] `POST /auth/logout` con CSRF valido responde `204`.

## 3. Prisma migrations y seed en entorno limpio

- [ ] En una base vacia del entorno objetivo, correr:
  - [ ] `npm run db:migrate:deploy`
  - [ ] `npm run db:seed`
- [ ] Confirmar tablas esperadas y datos semilla minimos (usuarios/roles/permisos basicos).
- [ ] Validar que la app levanta correctamente luego de migrar y seedear.

## 4. Seguridad funcional minima

- [ ] Login exitoso entrega access token + refresh cookie.
- [ ] Refresh rota el token de sesion y mantiene reglas CSRF.
- [ ] Logout revoca sesion y limpia cookie de refresh.
- [ ] Endpoints protegidos por JWT devuelven `401` cuando falta token o es invalido.
- [ ] Endpoints RBAC devuelven `403` cuando faltan roles/permisos.
- [ ] Rate-limit devuelve `429` al exceder intentos.

## 5. Status codes y errores esperados

- [ ] `401 Unauthorized`: token ausente/expirado/invalido.
- [ ] `403 Forbidden`: fallo de CSRF o permisos RBAC insuficientes.
- [ ] `429 Too Many Requests`: rate-limit excedido.
- [ ] Respuestas de error siguen un formato consistente para el frontend.

## 6. Smoke tests post-deploy

- [ ] `GET /health` (o endpoint equivalente) responde `200`.
- [ ] Flujo auth minimo en ambiente desplegado:
  - [ ] `POST /auth/login` -> `200`
  - [ ] `POST /auth/refresh` con CSRF valido -> `200`
  - [ ] `POST /auth/logout` con CSRF valido -> `204`
- [ ] Un endpoint protegido por JWT responde `200` con token valido.
- [ ] Un endpoint protegido por RBAC responde `403` para usuario sin permiso.
- [ ] Logs y metricas sin errores criticos durante los primeros minutos post-release.

## 7. Evidencia de release

- [ ] Adjuntar resultado de CI (lint, unit, e2e, cov) en PR/tag de release.
- [ ] Adjuntar version/tag desplegado.
- [ ] Registrar fecha, responsable y resultado de checklist en ticket de release.
