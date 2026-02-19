# backend-nestjs-boilerplate

Boilerplate backend con NestJS para aplicaciones SaaS, con autenticacion JWT, refresh token por cookie HttpOnly, CSRF, RBAC, rate-limit y Prisma.

## Requisitos

- Node.js 22+
- npm 10+
- Base de datos PostgreSQL accesible por `DATABASE_URL`

## Configuracion local

1. Instalar dependencias:

```bash
npm ci
```

2. Crear variables de entorno:

```bash
cp .env.example .env
```

3. Ajustar valores de `.env`:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (>= 32 chars)
- `JWT_REFRESH_SECRET` (>= 32 chars)
- `CORS_ORIGINS`
- `COOKIE_SAME_SITE` y `COOKIE_SECURE`
- `SWAGGER_ENABLED=true` (opcional en local)
- `SWAGGER_ALLOW_IN_PRODUCTION=true` (solo si queres exponer docs en prod)
- `RATE_LIMIT_REDIS_URL` (recomendado para rate-limit distribuido en multi-instancia)
- `LOGIN_LOCK_ENABLED`, `LOGIN_LOCK_REDIS_URL`, `LOGIN_MAX_FAILURES`, `LOGIN_ATTEMPT_WINDOW_MS`, `LOGIN_LOCK_BASE_MS`, `LOGIN_LOCK_MAX_MS` para lockout progresivo por `ip+email`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` para crear usuarios de prueba via seed

4. Ejecutar migraciones y seed:

```bash
npm run db:migrate:dev
npm run db:seed
```

5. Levantar el servidor:

```bash
npm run start:dev
```

6. Ver API docs:

```bash
http://localhost:3000/docs
```

## Scripts principales

- `npm run lint`: lint del proyecto.
- `npm run lint:fix`: lint con autofix para desarrollo local.
- `npm test`: pruebas unitarias.
- `npm run test:e2e`: pruebas e2e.
- `npm run test:cov`: cobertura (falla si no cumple `coverageThreshold` en `package.json`).
- `npm run db:migrate:deploy`: ejecutar migraciones en deploy.
- `npm run db:seed`: correr seed idempotente.
- `npm run db:reset`: reset de DB en local.
- `npm run new-project -- --name "my-api"`: bootstrap rapido para un proyecto nuevo.
- `npm run feature:new -- --name invoices`: scaffold base de un modulo feature reusable.
- `npm run start:prod:with-migrate`: corre migraciones y levanta app en modo prod.
- `npm run docker:up`: levanta `api + postgres` con Docker Compose.
- `npm run docker:down`: baja los contenedores locales.
- `npm run smoke:test`: smoke test de `/health` y `/ready` (auth opcional por env vars).
- `npm run build`: build de produccion.
- `npm run start:prod`: ejecutar build compilado.

## CI

Se define en `.github/workflows/ci.yml` y se ejecuta en:

- `push` a `master`
- `pull_request` contra `master`

Pasos del pipeline:

1. `npm ci`
2. `npm run lint`
3. `npm test -- --runInBand`
4. `npm run test:e2e -- --runInBand`
5. `npm run test:cov -- --runInBand`

El paso de cobertura falla automaticamente si cae por debajo de los umbrales definidos en `package.json`.

## Calidad y seguridad

- Validacion de variables de entorno al bootstrap (`src/config/env.validation.ts`).
- Auth con access token (Bearer) y refresh token por cookie.
- Proteccion CSRF para endpoints sensibles (refresh/logout).
- Autorizacion por roles/permisos (RBAC).
- Rate-limit configurable por endpoint.
- Rate-limit con fallback en memoria y soporte Redis opcional (`RATE_LIMIT_REDIS_URL`).
- Lockout progresivo de login por `ip+email` con backoff exponencial y `429` (`LOGIN_LOCKED`), con Redis opcional para multi-instancia.
- Endpoints de operacion: `GET /health` y `GET /ready`.
- Endpoint de metricas Prometheus: `GET /metrics`.
- OpenAPI/Swagger deshabilitado por defecto; requiere `SWAGGER_ENABLED=true` y en produccion tambien `SWAGGER_ALLOW_IN_PRODUCTION=true`.

## Documentacion operativa

- Nueva instancia de proyecto: `docs/NEW_PROJECT.md`
- Checklist de release SaaS: `docs/RELEASE_CHECKLIST.md`
- Deploy agnostico de proveedor: `docs/DEPLOY.md`
- Templates de entorno por ambiente: `docs/env/`
- Versionado y releases: `docs/VERSIONING.md`
- Template de modulo feature: `docs/FEATURE_MODULE_TEMPLATE.md`
- Seguridad y auth: `docs/AUTH_AND_SECURITY.md`
- Pruebas manuales en Postman: `docs/POSTMAN_AUTH_TESTS.md`
- Contrato de integracion frontend-backend: `docs/FRONTEND_BACKEND_ALIGNMENT.md`
- Catalogo de errores de dominio: `docs/ERROR_CODES.md`
- Governance de repositorio (branch protection + checks): `docs/REPO_GOVERNANCE.md`
- Arquitectura: `docs/ARCHITECTURE.md`
- Plan de pruebas backend: `docs/BACKEND_TEST_PLAN.md`
