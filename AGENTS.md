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
- RBAC para capacidad global; scope/ownership en services.
- `GlobalExceptionFilter` como contrato unico de errores.
- No exponer secretos, passwords ni hashes en respuestas o logs.
- Scope multi-tenant estricto: nunca cruzar `organizationId` entre tenants.
- Reglas de acceso en services; controllers siempre finos.
- Acceso a datos de negocio via repos/helpers organization-scoped con `orgId` explicito.
- Anti data leak obligatorio: recurso de otro tenant -> `404` con `RESOURCE_NOT_FOUND` (no `403`).

## 3) Auth Contract (MUST)

No modificar el flujo base de auth ni romper contratos fijos:

- `POST /auth/register` -> `201`
- `POST /auth/login` -> `200`
- `POST /auth/refresh` -> `200`
- `POST /auth/logout` -> `204` (sin body)

Solo se permite ajuste minimo y compatible en `/auth/me` para exponer contexto de tenant/role/branch.

En cada request autenticado debe existir contexto equivalente a:

- `user.id`
- `user.sub` (canonico)
- `user.organizationId`
- `user.role` (`ADMIN|MANAGER|OPERATOR`)
- `user.branchId` (nullable)
- `user.roles` (opcional pero recomendado)
- `user.permissions` (opcional pero recomendado)

Compatibilidad:
- Si existe rol legacy `USER`, se considera equivalente runtime de `OPERATOR`.

Si una feature rompe contratos auth:
1. bump de version mayor,
2. actualizacion de docs de integracion front,
3. plan de migracion para consumidores.

## 4) Multi-Tenant + Branch Scope Rules (MUST)

Toda feature nueva debe definir explicitamente:

1. Boundary de tenant:
- todas las queries mutativas/lectura filtran por `organizationId` del usuario.
- toda operacion de acceso a negocio debe pasar por repo/helper con `orgId` explicito:
  - `findById(orgId, id)`
  - `list(orgId, filters)`
  - `create(orgId, data)`

2. Boundary de branch:
- `OPERATOR`: solo su `branchId`.
- `MANAGER` con `branchId` asignado: solo ese branch.
- `MANAGER` sin `branchId`: alcance org-wide.
- `ADMIN`: alcance org-wide (opcional filtro por branch).

3. Errores:
- usar `code` estable del catalogo (`ACCESS_DENIED`, `BRANCH_NOT_FOUND`, etc.).
- si el recurso existe pero pertenece a otra `organizationId`: responder `404` + `RESOURCE_NOT_FOUND`.

## 5) RBAC/Permissions Canonical Policy

Roles canonicos:
- `ADMIN`
- `MANAGER`
- `OPERATOR`

Permisos canonicos:
- `BRANCH_READ`, `BRANCH_CREATE`, `BRANCH_UPDATE`
- `USER_READ`, `USER_CREATE`, `USER_UPDATE`
- `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASH_MOVEMENT_APPROVE`, `CASH_MOVEMENT_REJECT`, `CASH_MOVEMENT_DELIVER`
- `CASHFLOW_STATS_READ`

Mapping central role -> permissions:
- `ADMIN`: todos.
- `MANAGER`: `BRANCH_READ`, `USER_READ`, acciones de cash movements + `CASHFLOW_STATS_READ`.
- `OPERATOR`: `CASH_MOVEMENT_CREATE`, `CASH_MOVEMENT_READ`, `CASHFLOW_STATS_READ`.
- `USER` legacy: equivalente runtime de `OPERATOR`.

Helpers canonicos:
- `getPermissionsForRole(role)`
- `hasPermissions(userPerms, requiredPerms)`

Regla de diseno:
- RBAC decide "que puede hacer".
- Scope decide "sobre que recursos concretos".

## 6) Business Modules Included (Current Baseline)

Estos modulos ya son parte del baseline reusable:

- `branches`:
  - CRUD/listado de sucursales dentro de la organizacion actual.
- `cash-movements`:
  - alta/listado + flujo de estados `approve/reject/deliver` con scope tenant+branch por rol.
- `cashflow`:
  - agregados de caja en `GET /cashflow/stats` con mismo scope tenant+branch.
- `users`:
  - listado organization-scoped con permisos (`USER_READ`) para `ADMIN/MANAGER`.

## 7) Rules For AI In Derived Projects

La IA debe seguir este orden en cada tarea:

1. Clasificar endpoint:
- Admin/global capability -> RBAC.
- Ownership/self -> scope helper en service.
- Mixed -> RBAC + scope.

2. Implementar con estas reglas:
- Controller fino, sin Prisma directo.
- DTO obligatorio para body/query/params complejos.
- Service como fuente unica de reglas de negocio/acceso.
- Repos/helpers organization-scoped para acceso a negocio (siempre reciben `orgId` explicito).
- Errores con `code` estable del catalogo.

3. Verificar seguridad:
- CORS sin wildcard si hay credentials.
- cookies `sameSite`/`secure` segun entorno.
- rate-limit y lockout en endpoints publicos sensibles.

4. Cerrar con validacion y docs.

## 8) Forbidden Changes (NEVER)

- Desactivar guard global por conveniencia.
- Mover reglas de acceso al controller.
- Dejar endpoints mutativos cookie-based sin CSRF.
- Cambiar payload JWT (`sub`) sin migracion total.
- Introducir respuestas ambiguas entre docs y codigo.
- Saltarse filtro por `organizationId` en features multi-tenant.
- Devolver `403` cuando el recurso existe en otro tenant (debe ser `404 RESOURCE_NOT_FOUND`).

## 9) Definition Of Done (MUST PASS)

Antes de merge/release:

1. `npm run lint`
2. `npm run build`
3. `npm test -- --runInBand`
4. `npm run test:e2e -- --runInBand`
5. `npm run test:cov -- --runInBand`

Adicional recomendado:

1. `npm run smoke:test`
2. validacion manual de auth/refresh/logout en browser o Postman.

## 10) Mandatory Docs Sync

Si cambia comportamiento real, actualizar en el mismo PR:

- `README.md`
- `docs/FRONTEND_BACKEND_ALIGNMENT.md`
- `docs/POSTMAN_AUTH_TESTS.md`
- docs tecnicas afectadas (`AUTH_AND_SECURITY`, `ARCHITECTURE`, `RBAC_AND_SCOPE`, etc.)
- `CHANGELOG.md` cuando aplique

## 11) Core Change Policy

Tocar `src/auth`, `src/common/guards`, `src/common/filters`, `prisma/` solo si:

- bug de seguridad,
- deuda tecnica transversal,
- requisito repetible en multiples proyectos.

Cada cambio de core debe incluir:

- motivo tecnico claro;
- tests nuevos o ajustados;
- impacto en env/migraciones;
- actualizacion de docs.

## 12) Data & Seed Policy (Current Baseline)

Modelo base esperado:

- `Organization`
- `Branch`
- `User` con `organizationId` + `branchId` nullable
- `CashMovement`

Seed baseline:

- crear tenant/branch default
- asegurar roles `ADMIN|MANAGER|OPERATOR`
- mantener compatibilidad con rol legacy `USER`
- mapear permisos por rol con least-privilege usando catalogo canonico (`PermissionCatalog` + `ROLE_PERMISSIONS_MAP`)
- `USER` legacy debe recibir mapping de permisos equivalente a `OPERATOR`

## 13) Bootstrap Rules For New Projects

Al clonar este boilerplate para cliente nuevo:

1. Ejecutar `npm run new-project`.
2. Definir env del cliente.
3. Ejecutar migraciones + seed.
4. Verificar contratos auth en Postman.
5. Crear modulos de negocio en `src/<feature>/`.
6. No tocar core salvo necesidad transversal.

## 14) Quick Prompt For Future AI Sessions

Usar esta directiva al iniciar un proyecto derivado:

"Trabaja sobre este backend como boilerplate base. Respeta AGENTS.md. No rompas contratos auth ni seguridad core. Manten scope multi-tenant estricto por organization/branch. Implementa negocio en modulos nuevos, con controllers finos y reglas en services y repos organization-scoped. Si cambias comportamiento, actualiza docs y pruebas en el mismo cambio."

## 15) Cash Movement Contract (Current Baseline)

Modelo base de `CashMovement`:

- `organizationId`, `branchId`, `createdById` obligatorios
- `approvedById`, `deliveredById` nullable
- `amount Decimal(14,2)` no nulo
- `currency` default `ARS`
- `type`: enum `IN|OUT`
- `status`: enum `PENDING|APPROVED|REJECTED|DELIVERED` (default `PENDING`)
- `createdAt`, `updatedAt`

Indices baseline:

- `@@index([organizationId, status, createdAt])`
- `@@index([organizationId, branchId, createdAt])`
- `@@index([organizationId, branchId, status])`

Transiciones validas:

- `PENDING -> APPROVED | REJECTED`
- `APPROVED -> DELIVERED`
- Transicion invalida -> `409` con `code: CASHFLOW_INVALID_TRANSITION` y `details { from, to }`.

Contrato API:

- `amount` SIEMPRE string en responses.
- Fechas SIEMPRE ISO-8601 UTC.
- Recurso fuera de tenant SIEMPRE `404 RESOURCE_NOT_FOUND`.

## 16) Cashflow Stats Contract (Current Baseline)

Endpoint baseline:

- `GET /cashflow/stats` con permiso `CASHFLOW_STATS_READ`.

Scope:

- `organizationId` siempre desde token.
- `OPERATOR`: branch forzado a `user.branchId`.
- `MANAGER/ADMIN`: `branchId` permitido solo si es accesible.

Output:

- `cards.totalIn`, `cards.totalOut`, `cards.net` como string decimal.
- contadores por estado (`pendingCount`, `approvedCount`, `deliveredCount`, `rejectedCount`).
- rango por default razonable cuando no se informa `from/to` (baseline: ultimos 30 dias).

## 17) Branches/Users Minimal Endpoints (Demo Baseline)

- `GET /branches` -> requiere `BRANCH_READ`.
- `POST /branches` -> requiere `BRANCH_CREATE` y rol `ADMIN`.
- `GET /users` -> requiere `USER_READ` (permitido para `ADMIN/MANAGER` segun permisos).
- Todas las queries siempre organization-scoped por `organizationId` del token.

## 18) Seed + Demo Assets Policy (Current Baseline)

Seed demo debe ser deterministico e idempotente:

- tenant demo `Demo Pacific Treasury`
- branches demo `HQ` y `Sucursal Norte`
- cash movements demo con estados mixtos (`PENDING/APPROVED/DELIVERED/REJECTED`) y `type IN/OUT`
- datos recientes (ventana de 30 dias) para que stats sea util
- sin duplicados al re-ejecutar

Si el boiler no trae usuarios demo, crear `ADMIN|MANAGER|OPERATOR` con password demo configurable (default `Demo1234!`) y `branchId` para `OPERATOR`.

Asset demo obligatorio:

- coleccion Postman en `postman/` o `docs/` con flujo login->me->branches->cash movement->approve/deliver->stats (+ refresh).

## 19) Migration + Verification Policy For Business Changes

Cuando cambie `prisma/schema.prisma` en negocio:

1. generar migracion sin borrar datos existentes;
2. validar `prisma generate`;
3. ejecutar checklist de DoD (lint/build/tests unit/e2e/cov);
4. sincronizar docs + changelog en el mismo PR.

Comandos de referencia:

- `npm run db:migrate:dev`
- `npm run db:migrate:deploy`
- `npm run db:seed`
