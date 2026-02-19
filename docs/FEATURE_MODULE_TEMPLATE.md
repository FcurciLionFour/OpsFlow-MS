# Feature Module Template

Use this structure for new features to keep consistency and speed.

## Recommended structure

```text
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
  <feature>.controller.spec.ts
  <feature>.service.spec.ts
test/
  <feature>.e2e-spec.ts
```

## Fast scaffold

```bash
npm run feature:new -- --name invoices
```

This command creates:

- `src/invoices/invoices.module.ts`
- `src/invoices/invoices.controller.ts`
- `src/invoices/invoices.service.ts`
- `src/invoices/dto/create-invoices.dto.ts`
- `src/invoices/dto/update-invoices.dto.ts`
- `src/invoices/invoices.controller.spec.ts`
- `src/invoices/invoices.service.spec.ts`
- `test/invoices.e2e-spec.ts`

## Next steps after scaffold

1. Register module in `src/app.module.ts`.
2. Add DTO validation rules.
3. Add auth/permissions decorators where needed.
4. Implement service logic and persistence.
5. Update OpenAPI decorators in controller.
