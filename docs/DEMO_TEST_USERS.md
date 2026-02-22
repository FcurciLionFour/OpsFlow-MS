# Demo Test Users

Credenciales de prueba generadas por `npm run db:seed` para el tenant demo `pacific-treasury-demo`.

## Password demo

- Password comun por defecto: `Demo1234!`
- Variable para cambiarla: `SEED_DEMO_PASSWORD`

## Usuarios demo base

- `demo.admin@pacifictreasury.local` -> `Demo1234!` (`ADMIN`, org-wide)
- `demo.manager@pacifictreasury.local` -> `Demo1234!` (`MANAGER`, branch `HQ`)
- `demo.operator@pacifictreasury.local` -> `Demo1234!` (`OPERATOR`, branch `HQ`)
- `demo.manager.org@pacifictreasury.local` -> `Demo1234!` (`MANAGER`, org-wide)

## Usuarios demo masivos (config actual)

Configuracion usada:

- `SEED_DEMO_BRANCH_COUNT=6`
- `SEED_DEMO_OPERATORS_PER_BRANCH=3`
- Sucursales activas: `HQ`, `NORTE`, `SUR`, `CENTRO`, `OESTE`, `ESTE`

Managers por sucursal:

- `demo.manager.hq@pacifictreasury.local` -> `Demo1234!`
- `demo.manager.norte@pacifictreasury.local` -> `Demo1234!`
- `demo.manager.sur@pacifictreasury.local` -> `Demo1234!`
- `demo.manager.centro@pacifictreasury.local` -> `Demo1234!`
- `demo.manager.oeste@pacifictreasury.local` -> `Demo1234!`
- `demo.manager.este@pacifictreasury.local` -> `Demo1234!`

Operators por sucursal:

- `demo.operator.hq.1@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.hq.2@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.hq.3@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.norte.1@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.norte.2@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.norte.3@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.sur.1@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.sur.2@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.sur.3@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.centro.1@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.centro.2@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.centro.3@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.oeste.1@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.oeste.2@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.oeste.3@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.este.1@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.este.2@pacifictreasury.local` -> `Demo1234!`
- `demo.operator.este.3@pacifictreasury.local` -> `Demo1234!`

Total actual esperado en org demo:

- `28` usuarios (`4` base + `6` managers de sucursal + `18` operators de sucursal)

## Usuarios opcionales del seed default-org

Estos se crean solo si se configuran en `.env`:

- `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (rol `ADMIN`)
- `SEED_USER_EMAIL` + `SEED_USER_PASSWORD` (rol `OPERATOR`)
