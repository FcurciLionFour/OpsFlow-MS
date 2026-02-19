#!/usr/bin/env bash
set -euo pipefail

event_name="${GITHUB_EVENT_NAME:-}"
base_sha=""
head_sha=""

case "$event_name" in
  pull_request)
    base_sha="${GITHUB_BASE_SHA:-}"
    head_sha="${GITHUB_HEAD_SHA:-}"
    ;;
  push)
    base_sha="${GITHUB_BEFORE_SHA:-}"
    head_sha="${GITHUB_SHA:-}"
    ;;
  *)
    echo "Auth docs sync check skipped: unsupported event '$event_name'."
    exit 0
    ;;
esac

if [[ -z "$head_sha" ]]; then
  echo "Auth docs sync check skipped: missing head SHA."
  exit 0
fi

if [[ -z "$base_sha" ]]; then
  echo "Auth docs sync check skipped: missing base SHA."
  exit 0
fi

if [[ "$base_sha" =~ ^0+$ ]]; then
  echo "Auth docs sync check skipped: zero base SHA (new branch/initial push)."
  exit 0
fi

changed_files="$(git diff --name-only "$base_sha" "$head_sha")"
if [[ -z "$changed_files" ]]; then
  echo "No file changes detected between $base_sha and $head_sha."
  exit 0
fi

auth_runtime_changes="$(echo "$changed_files" | grep -E '^src/auth/.*\.ts$' | grep -vE '\.spec\.ts$' || true)"
if [[ -z "$auth_runtime_changes" ]]; then
  echo "No runtime auth changes detected."
  exit 0
fi

docs_changes="$(echo "$changed_files" | grep -E '^(README\.md|docs/(AUTH_AND_SECURITY\.md|BACKEND_TEST_PLAN\.md|FRONTEND_BACKEND_ALIGNMENT\.md|POSTMAN_AUTH_TESTS\.md|RELEASE_CHECKLIST\.md))$' || true)"
if [[ -n "$docs_changes" ]]; then
  echo "Auth runtime changes detected and docs updated. Check passed."
  exit 0
fi

echo "ERROR: Runtime auth files changed but required docs were not updated."
echo
echo "Auth runtime changes:"
echo "$auth_runtime_changes"
echo
echo "Update at least one of:"
echo "- README.md"
echo "- docs/AUTH_AND_SECURITY.md"
echo "- docs/BACKEND_TEST_PLAN.md"
echo "- docs/FRONTEND_BACKEND_ALIGNMENT.md"
echo "- docs/POSTMAN_AUTH_TESTS.md"
echo "- docs/RELEASE_CHECKLIST.md"
exit 1
