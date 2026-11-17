#!/bin/sh
set -eu
# No leading/trailing slash; nested paths are supported.
case "${SHIP_CONTEXT_PATH:-}" in
  ''|/*|*/|*..*|*//*|*[!A-Za-z0-9_/-]*) echo 'Invalid SHIP_CONTEXT_PATH' >&2; exit 1 ;;
esac
