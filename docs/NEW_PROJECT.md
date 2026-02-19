# New Project Quickstart

Guia para clonar este boilerplate y arrancar un proyecto nuevo en 10-15 minutos.

## 1. Bootstrap de nombre/base

```bash
npm run new-project -- --name "client-api" --description "API for Client X" --port 3001
```

Parametros:

- `--name` obligatorio. Se usa para `package.json.name` y titulo base del README.
- `--description` opcional.
- `--port` opcional (default `3000`).

## 2. Variables de entorno

```bash
cp .env.example .env
```

Configurar como minimo:

- `NODE_ENV=development`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (>=32 chars)
- `CORS_ORIGINS`
- `COOKIE_SAME_SITE` y `COOKIE_SECURE`
- `SWAGGER_ENABLED=true` (en dev)

## 3. Base de datos

```bash
npm run db:migrate:dev
npm run db:seed
```

Opcional:

- `SEED_ADMIN_EMAIL=mail@dominio.com` para asignar rol `ADMIN` durante seed.

## 4. Ejecutar proyecto

```bash
npm run start:dev
```

Endpoints de operacion:

- `GET /health`
- `GET /ready`
- Swagger: `GET /docs` (o ruta definida por `SWAGGER_PATH`)

## 5. Validacion minima antes de arrancar features

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

## 6. Antes de entregar a cliente

- Ejecutar checklist: `docs/RELEASE_CHECKLIST.md`
- Confirmar CI en verde
- Validar auth/refresh/logout/rate-limit/RBAC en entorno objetivo
