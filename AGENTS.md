# AGENTS.md - Backend NestJS Boilerplate Rules

## 1) Scope

Este repo es un boilerplate para iniciar proyectos freelance.
No es un producto final.

Meta:
- mantener un core de seguridad estable y reutilizable;
- agregar negocio sin romper contratos base;
- reducir retrabajo entre proyectos.

## 2) Non-Negotiables (MUST)

- `JwtGlobalGuard` global en `AppModule`.
- JWT canonico: `request.user.sub`.
- `refresh_token` en cookie HttpOnly con rotacion de sesion.
- CSRF obligatorio en endpoints cookie-based mutativos.
- RBAC para capacidad global; scope/ownership en servicios.
- `GlobalExceptionFilter` como contrato unico de errores.
- No exponer secretos, passwords ni hashes en respuestas o logs.

## 3) Fixed API Contracts (MUST)

Estos contratos no se cambian sin versionado mayor:

- `POST /auth/register` -> `201`
- `POST /auth/login` -> `200`
- `POST /auth/refresh` -> `200`
- `POST /auth/logout` -> `204` (sin body)

Si una feature nueva rompe esto:
1. bump de version mayor,
2. actualizacion de docs de integracion front,
3. plan de migracion para consumidores.

## 4) Rules For AI In Derived Projects

La IA debe seguir este orden en cada tarea:

1. Clasificar endpoint:
- Admin/global capability -> RBAC.
- Ownership/self -> scope helper en service.
- Mixed -> RBAC + scope.

2. Implementar con estas reglas:
- Controller fino, sin Prisma directo.
- DTO obligatorio para body/query/params complejos.
- Service como fuente unica de reglas de negocio/acceso.
- Errores con `code` estable del catalogo.

3. Verificar seguridad:
- CORS sin wildcard si hay credentials.
- cookies `sameSite`/`secure` segun entorno.
- rate-limit y lockout en endpoints publicos sensibles.

4. Cerrar con validacion y docs.

## 5) Forbidden Changes (NEVER)

- Desactivar guard global por conveniencia.
- Mover reglas de acceso al controller.
- Dejar endpoints mutativos cookie-based sin CSRF.
- Cambiar payload JWT (`sub`) sin migracion total.
- Introducir respuestas ambiguas entre docs y codigo.

## 6) Definition Of Done (MUST PASS)

Antes de merge/release:

1. `npm run lint`
2. `npm run build`
3. `npm test -- --runInBand`
4. `npm run test:e2e -- --runInBand`
5. `npm run test:cov -- --runInBand`

Adicional recomendado:

1. `npm run smoke:test`
2. validacion manual de auth/refresh/logout en browser o Postman.

## 7) Mandatory Docs Sync

Si cambia comportamiento real, actualizar en el mismo PR:

- `README.md`
- `docs/FRONTEND_BACKEND_ALIGNMENT.md`
- `docs/POSTMAN_AUTH_TESTS.md`
- docs tecnicas afectadas (`AUTH_AND_SECURITY`, `ARCHITECTURE`, etc.)
- `CHANGELOG.md` cuando aplique

## 8) Core Change Policy

Tocar `src/auth`, `src/common/guards`, `src/common/filters`, `prisma/` solo si:

- bug de seguridad,
- deuda tecnica transversal,
- requisito repetible en multiples proyectos.

Cada cambio de core debe incluir:

- motivo tecnico claro;
- tests nuevos o ajustados;
- impacto en env/migraciones;
- actualizacion de docs.

## 9) Bootstrap Rules For New Projects

Al clonar este boilerplate para cliente nuevo:

1. Ejecutar `npm run new-project`.
2. Definir env del cliente.
3. Ejecutar migraciones + seed.
4. Verificar contratos auth en Postman.
5. Crear modulos de negocio en `src/<feature>/`.
6. No tocar core salvo necesidad transversal.

## 10) Quick Prompt For Future AI Sessions

Usar esta directiva al iniciar un proyecto derivado:

"Trabaja sobre este backend como boilerplate base. Respeta AGENTS.md. No rompas contratos auth ni seguridad core. Implementa negocio en modulos nuevos, con controllers finos y reglas en services. Si cambias comportamiento, actualiza docs y pruebas en el mismo cambio."
