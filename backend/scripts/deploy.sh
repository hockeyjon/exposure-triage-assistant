#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/deploy.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing ${ENV_FILE}."
  echo "Copy scripts/deploy.env.example to scripts/deploy.env and fill in your real deploy target."
  exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

ARCHIVE="vulnerabilityscanner-backend.tar.gz"

# Bundle the app, excluding anything that's regeneratable on the server
# (.venv, __pycache__, data/ — the SQLite inventory is rebuilt fresh at
# startup from requirements.txt/package.json), unique to this machine's
# local setup (.env, logs/, supervisor's runtime files), deploy-only
# tooling the server has no use for (scripts/), or just not needed to run
# the app. Never ship .env — that would overwrite the server's real
# production secrets with local ones.
echo "Creating archive..."
# Suppress macOS's AppleDouble ._* sidecar files in the archive.
export COPYFILE_DISABLE=1
tar -czf "${BACKEND_ROOT}/${ARCHIVE}" \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='.env' \
  --exclude='data' \
  --exclude='logs' \
  --exclude='supervisord.pid' \
  --exclude='supervisor.sock' \
  --exclude='tests' \
  --exclude='scripts' \
  --exclude='*.tar' \
  --exclude='*.tar.gz' \
  -C "${BACKEND_ROOT}" .

# Deploy
echo "Uploading to ${REMOTE_HOST}:${REMOTE_PATH}..."
scp -i "${SSH_KEY}" "${BACKEND_ROOT}/${ARCHIVE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${ARCHIVE}"

echo
echo "Uploaded ${ARCHIVE}. On the server:"
echo "  mkdir -p ${REMOTE_PATH} && cd ${REMOTE_PATH} && tar xzf ${ARCHIVE}"
echo "  python3 -m venv --copies .venv # first deploy only — plain 'venv' fails under CageFS (common on shared hosting)"
echo "  # if that then fails on ensurepip, see gbs-fastapi's README Deployment section for the --without-pip + get-pip.py fallback"
echo "  .venv/bin/pip install -r requirements.txt   # includes supervisor"
echo "  cp .env.example .env           # first deploy only — then fill in real values"
echo "  mkdir -p logs                  # first deploy only"
echo "  .venv/bin/supervisorctl -c supervisord.conf restart vulnerabilityscanner-backend   # or supervisord -c supervisord.conf if not already running"
