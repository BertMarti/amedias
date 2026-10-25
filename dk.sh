#!/usr/bin/env sh
# Ejecuta un comando dentro de Node 24 (el Node local puede ser más antiguo).
# Imagen fijada por digest: lo que se ejecuta aquí no cambia sin que se vea en un commit.
exec docker run --rm -i -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/app -w /app ${DK_PORTS:-} node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 "$@"
