# Versioning Strategy

## Goal

Keep a stable base you can reuse safely across freelance projects.

## Scheme

- Use Semantic Versioning: `MAJOR.MINOR.PATCH`.
- `MAJOR`: breaking change in API/architecture/contracts.
- `MINOR`: backward-compatible feature additions.
- `PATCH`: backward-compatible fixes/docs/test improvements.

## Branching (simple)

- `master`: stable branch.
- Feature branches: `feat/<short-name>`.
- Fix branches: `fix/<short-name>`.

## Release flow

1. Update docs/tests/changelog.
2. Ensure CI is green.
3. Bump version in `package.json`.
4. Commit release changes:
   - `chore(release): vX.Y.Z`
5. Tag release:
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
   - `git push origin master --tags`

## Baseline tag

Recommended baseline tag for this boilerplate state:

- `v1.0.0-base`
