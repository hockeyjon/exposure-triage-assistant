#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/deploy.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing ${ENV_FILE}."
  echo "Copy scripts/deploy.env.example to scripts/deploy.env and fill in your real deploy target."
  exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

cd "${FRONTEND_ROOT}"

ARCHIVE="vulnerabilityscanner-frontend.tar.gz"

# Remove existing static export
if [ -d "out" ]; then
  echo "Removing existing out directory..."
  rm -rf out
fi

# Build
# Next.js's env-file precedence puts .env.local ABOVE .env.production, so a
# local dev .env.local (NEXT_PUBLIC_API_URL=http://localhost:8001) would
# otherwise silently win and ship a build that calls localhost from every
# visitor's browser. Force-export .env.production's values into the real
# process environment first — process.env outranks every .env file,
# including .env.local — so the real backend URL always wins here.
echo "Building..."
unset NEXT_PUBLIC_API_URL
if [ -f "${FRONTEND_ROOT}/.env.production" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${FRONTEND_ROOT}/.env.production"
  set +a
fi
npm run build

# Archive
echo "Creating archive..."
(cd ./out && tar czf "../${ARCHIVE}" .)

# Deploy
echo "Deploying to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${ARCHIVE}"

scp -i "${SSH_KEY}" "${ARCHIVE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"

echo
echo "Uploaded ${ARCHIVE}. On the server:"
echo "  mkdir -p ${REMOTE_PATH} && cd ${REMOTE_PATH} && tar xzf ${ARCHIVE}"
echo "Successfully deployed into GoDaddy!"
