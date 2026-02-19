# Deploy Guide (Provider-Agnostic)

Esta guia define un flujo de deploy repetible para cualquier infraestructura.

## 1. Predeploy

1. Configurar variables del entorno objetivo usando una plantilla de `docs/env/`.
2. Validar CI en verde:
   - `npm run lint`
   - `npm test -- --runInBand`
   - `npm run test:e2e -- --runInBand`
   - `npm run test:cov -- --runInBand`
3. Confirmar backup reciente de base de datos.
4. Confirmar que `DATABASE_URL` apunta al entorno correcto.

## 2. Imagen y ejecucion

### Opcion A: Docker local/referencia

```bash
docker compose up -d --build
```

Comandos utiles:

```bash
docker compose logs -f api
docker compose down
```

### Opcion B: Cualquier runtime de contenedores

Build:

```bash
docker build -t backend-nestjs-boilerplate:latest .
```

Run:

```bash
docker run --rm -p 3000:3000 --env-file .env backend-nestjs-boilerplate:latest
```

Nota:

- El entrypoint ejecuta `npm run db:migrate:deploy` antes de levantar la API.
- Si queres desactivar migraciones automaticas, setear `RUN_MIGRATIONS=false`.

## 3. Post-deploy

Ejecutar smoke test basico:

```bash
SMOKE_BASE_URL=https://api.example.com npm run smoke:test
```

Smoke auth opcional:

```bash
SMOKE_BASE_URL=https://api.example.com SMOKE_EMAIL=user@example.com SMOKE_PASSWORD=Password123 npm run smoke:test
```

Verificaciones minimas:

1. `GET /health` retorna `200`.
2. `GET /ready` retorna `200`.
3. Login + `GET /auth/me` con bearer (opcional) funciona.

## 4. Rollback basico

1. Revertir a imagen/tag anterior estable.
2. Restaurar backup si una migracion genero incompatibilidad.
3. Repetir smoke tests contra la version restaurada.
4. Documentar causa raiz y correccion antes de redeploy.

## 5. Seguridad operativa

1. `NODE_ENV=production`.
2. `COOKIE_SECURE=true`.
3. `COOKIE_SAME_SITE=none` en cross-domain.
4. `JWT_*_SECRET` con longitud minima 32 y rotacion controlada.
5. `SWAGGER_ENABLED=false` en produccion publica salvo necesidad operativa.
