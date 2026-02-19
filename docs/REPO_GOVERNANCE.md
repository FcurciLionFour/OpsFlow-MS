# Repository Governance

Checklist para dejar el repositorio en modo production-ready en GitHub.

## Branch Protection (rama `master`)

1. Require a pull request before merging.
2. Require approvals: minimo 1.
3. Dismiss stale approvals when new commits are pushed.
4. Require review from Code Owners.
5. Require status checks to pass:
   - `CI / test`
   - `CodeQL / Analyze (javascript-typescript)`
6. Require branches to be up to date before merging.
7. Restrict force pushes and branch deletion.
8. Include administrators (recomendado).

## Required Files

- `.github/CODEOWNERS`
- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/pull_request_template.md`

## Release Discipline

1. Merge only through PR (no direct pushes a `master`).
2. Attach evidence from CI and coverage in every release PR.
3. Track env changes in release notes section of the PR template.
