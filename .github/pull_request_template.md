## Summary

- What changed?
- Why was it needed?

## Checklist

- [ ] Scope and acceptance criteria are clear
- [ ] `npm run lint` passes locally
- [ ] `npm test -- --runInBand` passes locally
- [ ] `npm run test:e2e -- --runInBand` passes locally
- [ ] `npm run test:cov -- --runInBand` passes locally
- [ ] CodeQL workflow passes
- [ ] Required CODEOWNERS review approved
- [ ] Migration impact reviewed (`prisma migrate`)
- [ ] Security impact reviewed (auth/cookies/csrf/rbac/rate-limit)
- [ ] API contract changes documented (Swagger + docs)

## Release Notes

- Breaking changes:
- Required env changes:
- Manual deploy steps (if any):
